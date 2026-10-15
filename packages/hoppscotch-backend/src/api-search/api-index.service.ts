import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

/** Only structural metadata leaves the application; credentials and sample values are excluded. */
export function describeRequest(value: unknown): Record<string, unknown> {
  const req = typeof value === 'string' ? JSON.parse(value) : (value as any);
  if (!req || typeof req !== 'object') return {};
  const shape = (v: any, depth = 0): any => {
    if (depth > 8) return 'object';
    if (v === null) return 'null';
    if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1)] : [];
    if (typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, shape(x, depth + 1)]),
      );
    return typeof v;
  };
  let body: unknown;
  try {
    body = shape(JSON.parse(req.body?.body || '{}'));
  } catch {
    body = { contentType: req.body?.contentType };
  }
  return {
    method: req.method,
    path: String(req.endpoint || '')
      .split('?')[0]
      .replace(/\/\/[^/@]+:[^/@]+@/, '//'),
    description: req.description,
    headers: (req.headers || []).map((h: any) => h.key),
    params: (req.params || []).map((p: any) => p.key),
    body,
  };
}

@Injectable()
export class ApiIndexService {
  private readonly logger = new Logger(ApiIndexService.name);
  private running = false;
  private cursor = '';
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async enqueue(requestId: string) {
    const row = await this.prisma.teamRequest.findUnique({
      where: { id: requestId },
      include: { collection: { select: { title: true } } },
    });
    if (!row) return;
    const metadata = describeRequest(row.request);
    const text = JSON.stringify({
      title: row.title,
      category: row.collection.title,
      ...metadata,
    });
    const hash = createHash('sha256')
      .update(this.embeddings.modelIdentity + text)
      .digest('hex');
    // The INSERT SELECT and version condition prevent a delayed event from restoring old content.
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO "APISpec" (id,name,path,method,description,category,teamid,requestid,"contentHash","sourceText","sourceRequest","sourceVersion","syncStatus","createdAt","updatedAt")
      SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$12::jsonb,$11,'pending',NOW(),NOW()
      FROM "TeamRequest" tr WHERE tr.id=$8 AND tr."updatedOn"=$11 AND tr.request::jsonb=$12::jsonb AND tr.title=$2
      ON CONFLICT (requestid) DO UPDATE SET name=EXCLUDED.name,path=EXCLUDED.path,method=EXCLUDED.method,
        description=EXCLUDED.description,category=EXCLUDED.category,teamid=EXCLUDED.teamid,
        "contentHash"=EXCLUDED."contentHash","sourceText"=EXCLUDED."sourceText","sourceRequest"=EXCLUDED."sourceRequest","sourceVersion"=EXCLUDED."sourceVersion",
        "syncStatus"=CASE WHEN "APISpec"."contentHash"=EXCLUDED."contentHash" THEN "APISpec"."syncStatus" ELSE 'pending' END,
        attempts=CASE WHEN "APISpec"."contentHash"=EXCLUDED."contentHash" THEN "APISpec".attempts ELSE 0 END,
        "nextRetryAt"=CASE WHEN "APISpec"."contentHash"=EXCLUDED."contentHash" THEN "APISpec"."nextRetryAt" ELSE NOW() END,
        "updatedAt"=NOW()
      WHERE "APISpec"."sourceVersion" IS NULL OR "APISpec"."sourceVersion" <= EXCLUDED."sourceVersion"
    `,
      randomUUID(),
      row.title,
      String(metadata.path || ''),
      String(metadata.method || 'GET'),
      String(metadata.description || ''),
      row.collection.title,
      row.teamID,
      row.id,
      hash,
      text,
      row.updatedOn,
      JSON.stringify(row.request),
    );
  }

  async enqueueTeam(teamId: string) {
    let cursor = '',
      queued = 0;
    // Bounded request; reconciliation continues in the worker for large teams.
    const rows = await this.prisma.teamRequest.findMany({
      where: { teamID: teamId, id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: 100,
    });
    for (const row of rows) {
      await this.enqueue(row.id);
      queued++;
    }
    return {
      synced: 0,
      queued,
      message:
        'Queued for background indexing; remaining records are reconciled automatically.',
    };
  }

  @Interval(15000)
  async tick() {
    if (
      this.running ||
      process.env.GENERATE_GQL_SCHEMA === 'true' ||
      process.env.API_INDEX_WORKER === 'false'
    )
      return;
    this.running = true;
    try {
      // Cursor scan repairs missed events without coupling search latency to embedding calls.
      const rows = await this.prisma.teamRequest.findMany({
        where: { id: { gt: this.cursor } },
        orderBy: { id: 'asc' },
        take: 25,
      });
      for (const row of rows) {
        await this.enqueue(row.id);
        this.cursor = row.id;
      }
      if (rows.length < 25) this.cursor = '';
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "APISpec" a WHERE a.requestid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "TeamRequest" t WHERE t.id=a.requestid)`,
      );
      for (let i = 0; i < 5; i++) if (!(await this.processNext())) break;
    } catch (error) {
      this.logger.warn(
        'Index worker failed; verify database migration and embedding configuration',
      );
    } finally {
      this.running = false;
    }
  }

  async processNext(): Promise<boolean> {
    // Atomic lease supports multiple server processes and recovery after a crash.
    const jobs = await this.prisma.$queryRawUnsafe<any[]>(
      `
      UPDATE "APISpec" SET "syncStatus"='processing',"leaseToken"=$1,"nextRetryAt"=NOW()+INTERVAL '2 minutes'
      WHERE id=(SELECT id FROM "APISpec" WHERE "syncStatus" IN ('pending','failed','processing')
        AND attempts < 5 AND "nextRetryAt" <= NOW() ORDER BY "nextRetryAt",id FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING id,requestid,"contentHash","sourceText","sourceRequest","sourceVersion","leaseToken",attempts
    `,
      randomUUID(),
    );
    const job = jobs[0];
    if (!job) return false;
    try {
      const vector = await this.embeddings.generateEmbedding(job.sourceText);
      await this.prisma.$executeRawUnsafe(
        `UPDATE "APISpec" a SET embedding=$1::jsonb,embedding_vector=$2::vector,
        "embeddingModel"=$3,"syncStatus"='ready',"lastError"=NULL,attempts=0,"updatedAt"=NOW()
        WHERE a.id=$4 AND a."contentHash"=$5 AND a."leaseToken"=$6
        AND EXISTS (SELECT 1 FROM "TeamRequest" t WHERE t.id=a.requestid AND t."updatedOn"=a."sourceVersion" AND t.request::jsonb=a."sourceRequest" AND t.title=a.name)`,
        JSON.stringify(vector),
        `[${vector.join(',')}]`,
        this.embeddings.modelIdentity,
        job.id,
        job.contentHash,
        job.leaseToken,
      );
    } catch {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "APISpec" SET "syncStatus"='failed',attempts=attempts+1,
        "lastError"='Embedding provider failed',"nextRetryAt"=NOW()+($1 * INTERVAL '1 second')
        WHERE id=$2 AND "contentHash"=$3 AND "leaseToken"=$4`,
        Math.min(900, 15 * 2 ** job.attempts),
        job.id,
        job.contentHash,
        job.leaseToken,
      );
    }
    return true;
  }
}
