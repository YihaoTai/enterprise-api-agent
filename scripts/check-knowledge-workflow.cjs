/** Live-provider smoke test with synthetic fixtures; no real team records are read or sent. */
const path=require('path');const root=path.resolve(__dirname,'..');const b=path.join(root,'packages/hoppscotch-backend');
require(b+'/node_modules/dotenv').config({path:b+'/.env',quiet:true});process.env.TS_NODE_PROJECT=b+'/tsconfig.json';process.chdir(b);
require(b+'/node_modules/ts-node').register({transpileOnly:true});require(b+'/node_modules/tsconfig-paths/register');
const {ConfigService}=require(b+'/node_modules/@nestjs/config');const {LlmService}=require(b+'/src/ai-mock/services/llm.service.ts');const {KnowledgeService}=require(b+'/src/knowledge/knowledge.service.ts');const {JsonSchemaInferencer}=require(b+'/src/ai-mock/util/json-schema.inferencer.ts');
const record={id:'synthetic-members-update',title:'更新成员姓名',request:{method:'PATCH',endpoint:'/members/{id}',description:'根据路径中的成员ID修改成员姓名',body:{body:'{"name":"示例"}'}}};
const prisma={teamMember:{findUnique:async()=>({role:'OWNER'})},teamRequest:{findFirst:async({where})=>where.id===record.id?record:null},$executeRawUnsafe:async()=>1};
const search={search:async()=>[{id:record.id,name:record.title,path:'/members/{id}',method:'PATCH',description:record.request.description,score:0.04}]};
(async()=>{const service=new KnowledgeService(prisma,search,new LlmService(new ConfigService()),new JsonSchemaInferencer());
 for(const mode of ['rag','agent']){
   const result=await service.run('synthetic-team','synthetic-user',mode==='rag'?'如何修改成员姓名？':'找到修改成员姓名的接口，读取结构，生成一份Mock数据并调用工具校验，完成后总结。',mode);
   console.log(mode,JSON.stringify({status:result.status,citations:result.citations.length,tools:result.trace.map(t=>t.tool),validatedMocks:result.validatedMocks.length}));
   if(result.status!=='completed'||!result.citations.length||(mode==='agent'&&!result.validatedMocks.length))process.exitCode=1;
 }
})().catch(()=>{console.log('Workflow check failed');process.exitCode=1});
