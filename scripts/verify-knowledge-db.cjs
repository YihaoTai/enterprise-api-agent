/** Integration verification against an isolated local database restored from the pre-upgrade backup. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'packages/hoppscotch-backend');
const { Client } = require(backend + '/node_modules/pg');
const { parse } = require(backend + '/node_modules/dotenv');
const assert = require('assert/strict');
const name = 'hoppscotch_upgrade_verify_20261015';
(async () => {
  const env = parse(fs.readFileSync(path.join(root, '.env')));
  const url = new URL(env.DATABASE_URL);
  assert(['localhost','127.0.0.1'].includes(url.hostname), 'Only local database verification is allowed');
  const admin = new Client({ connectionString: env.DATABASE_URL });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name]);
  if (exists.rowCount) throw Error('Verification database already exists; refusing to overwrite');
  await admin.query(`CREATE DATABASE "${name}"`);
  const extension = spawnSync('/opt/homebrew/bin/psql', ['-d', name, '-c', 'CREATE EXTENSION IF NOT EXISTS vector'], {encoding:'utf8'});
  if(extension.status) throw Error('Cannot enable vector in verification database');
  await admin.end();
  const pgEnv = { ...process.env, PGHOST:url.hostname, PGPORT:url.port || '5432', PGDATABASE:name, PGUSER:decodeURIComponent(url.username), PGPASSWORD:decodeURIComponent(url.password) };
  const restore = spawnSync('/opt/homebrew/bin/pg_restore',['--no-owner','--no-privileges','--no-comments','-d',name,'/Users/yihao/project-backups/hoppscotch-database-before-upgrade-20261015.dump'],{env:pgEnv,encoding:'utf8'});
  if (restore.status !== 0) throw Error('Restore failed: ' + restore.stderr);
  url.pathname = '/' + name;
  const db = new Client({ connectionString:url.toString() }); await db.connect();
  await db.query(fs.readFileSync(path.join(backend,'prisma/migrations/20261015010000_knowledge_workflows/migration.sql'),'utf8'));
  process.env.TS_NODE_PROJECT = path.join(backend,'tsconfig.json');
  process.chdir(backend);
  require(backend+'/node_modules/ts-node').register({transpileOnly:true});
  require(backend+'/node_modules/tsconfig-paths/register');
  const { ApiIndexService } = require(backend+'/src/api-search/api-index.service.ts');
  const { ApiSearchService } = require(backend+'/src/api-search/api-search.service.ts');
  const readRequest = async ({where}) => {
    const r=(await db.query('SELECT t.*, c.title AS category FROM "TeamRequest" t JOIN "TeamCollection" c ON c.id=t."collectionID" WHERE t.id=$1',[where.id])).rows[0];
    return r ? {...r, collection:{title:r.category}} : null;
  };
  const prisma = {
    teamRequest:{findUnique:readRequest},
    $queryRawUnsafe:async(sql,...values)=>(await db.query(sql,values)).rows,
    $executeRawUnsafe:async(sql,...values)=>(await db.query(sql,values)).rowCount,
  };
  const vector = Array(1024).fill(1/32);
  const embeddings = {modelIdentity:'integration-test',generateEmbedding:async()=>vector};
  const index = new ApiIndexService(prisma,embeddings);
  await db.query('BEGIN');
  await db.query(`INSERT INTO "Team"(id,name) VALUES ('upgrade-team-a','A'),('upgrade-team-b','B')`);
  await db.query(`INSERT INTO "TeamCollection"(id,"teamID",title,"orderIndex","updatedOn") VALUES ('upgrade-col-a','upgrade-team-a','A',1,NOW()),('upgrade-col-b','upgrade-team-b','B',1,NOW())`);
  for(const [id,team,col] of [['upgrade-a','upgrade-team-a','upgrade-col-a'],['upgrade-b','upgrade-team-b','upgrade-col-b']]) {
    await db.query(`INSERT INTO "TeamRequest"(id,"collectionID","teamID",title,request,"orderIndex","updatedOn") VALUES ($1,$2,$3,'修改成员姓名',$4::jsonb,1,NOW())`,[id,col,team,JSON.stringify({method:'PATCH',endpoint:'/members/{id}',body:{body:'{"name":"Example"}'}})]);
    await index.enqueue(id);
  }
  // Prioritize our fixtures, leaving restored records untouched in the rolled-back transaction.
  await db.query(`UPDATE "APISpec" SET "nextRetryAt"=NOW()+INTERVAL '1 day' WHERE requestid NOT IN ('upgrade-a','upgrade-b') OR requestid IS NULL`);
  await index.processNext(); await index.processNext();
  assert.equal((await db.query(`SELECT COUNT(*)::int AS count FROM "APISpec" WHERE requestid IN ('upgrade-a','upgrade-b') AND "syncStatus"='ready'`)).rows[0].count,2);
  const search = new ApiSearchService(prisma,embeddings,{},index);
  const result = await search.search({teamId:'upgrade-team-a',query:'成员姓名'});
  assert(result.some(x=>x.id==='upgrade-a'));assert(!result.some(x=>x.id==='upgrade-b'));
  // Simulate an edit while an embedding call is in flight, including equal timestamps.
  await db.query(`UPDATE "APISpec" SET "syncStatus"='pending',"nextRetryAt"=NOW() WHERE requestid='upgrade-a'`);
  embeddings.generateEmbedding = async()=>{await db.query(`UPDATE "TeamRequest" SET title='V2 changed' WHERE id='upgrade-a'`);return vector};
  await index.processNext();
  assert.notEqual((await db.query(`SELECT "syncStatus" FROM "APISpec" WHERE requestid='upgrade-a'`)).rows[0].syncStatus,'ready');
  embeddings.generateEmbedding = async()=>vector;
  await index.enqueue('upgrade-a'); await index.processNext();
  assert.equal((await db.query(`SELECT name,"syncStatus" FROM "APISpec" WHERE requestid='upgrade-a'`)).rows[0].name,'V2 changed');
  const failed = new ApiIndexService(prisma,{...embeddings,generateEmbedding:async()=>{throw Error('offline')}});
  await db.query(`UPDATE "APISpec" SET "syncStatus"='pending',"nextRetryAt"=NOW() WHERE requestid='upgrade-b'`);
  await failed.processNext();
  assert.equal((await db.query(`SELECT "syncStatus" FROM "APISpec" WHERE requestid='upgrade-b'`)).rows[0].syncStatus,'failed');
  await db.query('ROLLBACK'); await db.end();
  console.log('PASS: migration, duplicate identity across teams, worker claims, vector search SQL, team isolation, stale-write rejection, reindex and retry persistence.');
  console.log('Isolated verification database retained:',name);
})().catch(e=>{console.error(e.message);process.exit(1)});
