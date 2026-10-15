-- Legacy duplicate vectors are preserved before deduplication. All vectors are rebuildable.
CREATE TABLE "APISpecUpgradeArchive" AS SELECT * FROM "APISpec";
DELETE FROM "APISpec" a USING "APISpec" b
 WHERE a.requestid IS NOT NULL AND a.requestid=b.requestid
 AND (a."updatedAt",a.id)<(b."updatedAt",b.id);
ALTER TABLE "APISpec" DROP CONSTRAINT IF EXISTS "APISpec_name_path_key";
DROP INDEX IF EXISTS "APISpec_name_path_key";
ALTER TABLE "APISpec" DROP CONSTRAINT IF EXISTS apispec_name_path_key;
-- Legacy installations used a serial integer ID although Prisma declared String.
ALTER TABLE "APISpec" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "APISpec" ALTER COLUMN id TYPE TEXT USING id::text;
CREATE UNIQUE INDEX "APISpec_requestid_key" ON "APISpec"(requestid);
ALTER TABLE "APISpec"
 ADD COLUMN "contentHash" TEXT,
 ADD COLUMN "sourceText" TEXT,
 ADD COLUMN "sourceRequest" JSONB,
 ADD COLUMN "sourceVersion" TIMESTAMPTZ(3),
 ADD COLUMN "embeddingModel" TEXT,
 ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'pending',
 ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "lastError" TEXT,
 ADD COLUMN "leaseToken" TEXT,
 ADD COLUMN "nextRetryAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX "APISpec_sync_queue_idx" ON "APISpec"("syncStatus","nextRetryAt");
CREATE TABLE "KnowledgeRun" (
 id TEXT PRIMARY KEY, "teamId" TEXT NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
 "userUid" TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL,
 result JSONB, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "finishedAt" TIMESTAMPTZ
);
CREATE INDEX "KnowledgeRun_team_user_created_idx" ON "KnowledgeRun"("teamId","userUid","createdAt");
