CREATE EXTENSION IF NOT EXISTS vector;
-- Create APISpec table for vector search
CREATE TABLE IF NOT EXISTS "APISpec" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "teamid" TEXT,
    "requestid" TEXT,
    "embedding" JSONB,
    "embedding_vector" vector(1024),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "APISpec_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "APISpec_teamid_idx" ON "APISpec"("teamid");
CREATE INDEX IF NOT EXISTS "APISpec_category_idx" ON "APISpec"("category");
CREATE UNIQUE INDEX IF NOT EXISTS "APISpec_name_path_key" ON "APISpec"("name", "path");

-- Enable pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;