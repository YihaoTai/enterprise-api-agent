# 语义搜索技术方案

## 概述

本文档记录了 Hoppscotch 项目中 AI 语义搜索功能的实现方案。

## 技术架构

### 1. 组件概览

| 组件 | 描述 | 位置 |
|------|------|------|
| EmbeddingService | 生成文本向量 | `packages/hoppscotch-backend/src/api-search/embedding.service.ts` |
| MeilisearchService | 搜索引擎 | `packages/hoppscotch-backend/src/api-search/meilisearch.service.ts` |
| UrlParserService | URL 语义解析 | `packages/hoppscotch-backend/src/api-search/url-parser.service.ts` |
| **pgvector** | 向量相似度搜索 | PostgreSQL 扩展 |
| APISpec 表 | 存储接口数据 + 向量 | PostgreSQL |
| Meilisearch 索引 | 关键词搜索 | 本地 7700 端口 |

### 2. 数据流

```
TeamRequest → (同步+解析) → APISpec (PostgreSQL) → Meilisearch (关键词搜索)
                    ↓                              ↓
              UrlParserService              EmbeddingService
              (URL 语义解析)                  (生成向量)
                    ↓                              
              description 字段                  
                    ↓                              
              embedding_vector (pgvector) ←─────────┘
              (向量相似度搜索)
```

### 3. 向量相似度搜索原理

#### 3.1 核心原理

向量相似性搜索基于**距离度量**，查找与查询向量最相似的 Top-K 结果：

```
查询向量 [0.1, 0.5, 0.3, ...] 
       ↓
  计算与数据库中所有向量的距离
       ↓
  按距离排序，返回最近的 Top-K
```

#### 3.2 距离计算方式

| 操作符 | 含义 | 公式 | 适用场景 |
|--------|------|------|--------|
| `<=>` | 余弦距离 | 1 - cos(θ) | 方向相似，忽略长度 |
| `<->` | 欧氏距离 | √((A₁-B₁)² + ...) | 物理距离最近 |
| `<#>` | 内积 | A·B | 性能和召回 |

#### 3.3 pgvector 优势

- **轻量级**：PostgreSQL 扩展，无需额外服务
- **高性能**：支持索引加速（HNSW、IVF）
- **SQL 兼容**：可直接用 SQL 查询
- **混合查询**：支持向量 + 过滤条件

### 4. 安装 pgvector

#### 4.1 编译安装（针对 PostgreSQL 16）

由于 Homebrew 的 pgvector 不兼容 PostgreSQL 16，需要手动编译：

```bash
# 1. 克隆源码
git clone --depth 1 https://github.com/pgvector/pgvector.git

# 2. 编译（指定 PGCONFIG）
make PGCONFIG=/opt/homebrew/opt/postgresql@16/bin/pg_config clean all

# 3. 安装
make PGCONFIG=/opt/homebrew/opt/postgresql@16/bin/pg_config install
```

#### 4.2 创建扩展

```sql
-- 创建 vector 扩展
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 4.3 数据迁移

```sql
-- 添加向量列
ALTER TABLE "APISpec" ADD COLUMN embedding_vector vector(1024);

-- 迁移数据（jsonb → vector）
UPDATE "APISpec"
SET embedding_vector = (
  SELECT ('[' || string_agg(e::text, ',') || ']')::vector
  FROM jsonb_array_elements_text(embedding) e
);

-- 创建索引（加速搜索）
CREATE INDEX ON "APISpec" USING hnsw (embedding_vector vector_cosine_ops);
```

## 实现细节

### 1. Embedding 服务

**模型**: 阿里云百炼 `text-embedding-v1` (1024 维)

**配置**:
```typescript
// .env
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_API_KEY=YOUR_API_KEY
```

**fallback**: 当 API 失败时，使用基于哈希的本地 fallback 向量生成

### 2. Meilisearch 搜索

**启动**:
```bash
brew install meilisearch
meilisearch --db-path /opt/homebrew/var/meilisearch/data.ms --http-addr "127.0.0.1:7700"
```

**索引**: `api-specs`

**搜索方式**: 预计算向�� + 关键词混合搜索

### 3. URL 语义解析服务

#### 3.1 实现背景

在实现 URL 语义解析之前，系统存在以下问题：
- 搜索 "查询邮箱" 无法匹配 `GET /v1/users/10086?fields=email,phone`
- 用户必须输入完全匹配的关键词才能找到 API
- 无法理解 URL 中的路径语义、参数名语义、参数值语义

#### 3.2 技术方案

**新增文件**: `url-parser.service.ts`

**核心功能**:
1. **路径解析**: 将 URL 路径转换为资源名
   - `/v1/users` → "用户"
   - `/v1/orders` → "订单"
   - `/api/products` → "商品"

2. **HTTP 方法解析**: 映射到操作动词
   - `GET` → "获取"
   - `POST` → "创建"
   - `PUT/PATCH` → "更新"
   - `DELETE` → "删除"

3. **参数解析**: 区分 ID 类参数和字段类参数
   - `fields=email,phone` → "返回字段：邮箱、电话"
   - `userId=10086` → 识别为 ID（不纳入描述）

4. **语义描述生成**: 组合生成可搜索的描述文本

#### 3.3 与同步流程集成

在 `api-search.service.ts` 的 `syncFromTeamRequest` 方法中：

```typescript
// 同步时自动解析 URL
const parsed = this.urlParserService.parse({
  endpoint: req.path,
  method: req.method,
  params: req.request_obj?.params || [],
  name: req.name,
});

// 合并描述
const combinedDescription = this.combineDescriptions(
  req.description,
  parsed.description
);

await this.upsertAPISpec({
  description: combinedDescription,
});
```

#### 3.4 效果对比

| 场景 | 实现前 | 实现后 |
|------|--------|--------|
| 搜索 "查询邮箱" | ❌ 无结果 | ✅ 匹配 "获取用户，返回字段" |
| 搜索 "创建账号" | ❌ 无结果 | ✅ 匹配 "创建新用户" |
| 搜索 "订单详情" | ❌ 无结果 | ✅ 匹配 "获取订单详情" |
| URL `/v1/users/10086?fields=email` | 无语义描述 | 自动解析为 "获取用户，返回字段" |

### 4. API 接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api-search/search` | POST | PostgreSQL 搜索（关键词 + 向量 RRF 融合） |
| `/api-search/meilisearch/search` | POST | Meilisearch 语义搜索 |
| `/api-search/meilisearch/sync` | POST | 同步数据到 Meilisearch |
| `/api-search/meilisearch/init` | POST | 初始化 Meilisearch 索引 |
| `/api-search/sync` | POST | 从 TeamRequest 同步到 APISpec（含 URL 解析） |
| `/api-search/regenerate-embeddings` | POST | 重新生成所有 APISpec 的 embedding 向量 |

### 5. 搜索排序算法

**2026-04-13 修复**

#### 问题描述

搜索 "创建账号"，最高匹配是 "test_query1"，而不是 "创建新用户"

#### 根本原因

1. **upsertAPISpec Bug**: 只更新了 `embedding` (jsonb) 列，没有更新 `embedding_vector` (pgvector) 列
2. **search() Bug**: 没有使用 RRF 融合算法，向量结果只是简单追加到关键词结果后面

#### 修复方案

1. **upsertAPISpec**: 同时更新 `embedding` 和 `embedding_vector` 列
2. **search()**: 使用 RRF (Reciprocal Rank Fusion) 融合算法合并关键词和向量搜索结果

#### RRF 融合算法

```typescript
private rrfFusion(keywordResults, vectorResults, k = 60) {
  const scoreMap = new Map();

  // 关键词搜索结果：根据排名计算 RRF 分数
  keywordResults.forEach((result, index) => {
    const rrfScore = 1 / (index + k);
    // 合并到 scoreMap
  });

  // 向量搜索结果：累加 RRF 分数
  vectorResults.forEach((result, index) => {
    const rrfScore = 1 / (index + k);
    // 累加到已有结果或新建
  });

  // 按总分排序返回
}
```

### 6. 前端集成

**位置**: `packages/hoppscotch-common/src/components/http/Sidebar.vue`

**功能**: 左侧边栏 "Search" 标签页，支持：
- 关键词搜索
- 点击结果自动打开新标签页
- 一键复制 cURL

## 测试结果

| 测试场景 | 查询词 | 结果 |
|----------|--------|------|
| 语义匹配 | `查询邮箱` | ✅ 匹配 "获取用户，返回字段" |
| 语义匹配 | `创建账号` | ✅ 匹配 "创建新用户" |
| 关键词 | `用户` | ✅ 匹配 "获取用户列表" |
| 语义匹配 | `查询订单详情` | ✅ 匹配 "获取订单详情" |
| 向量搜索 | pgvector `<=>` | ✅ 余弦距离计算 |

## 环境变量

```bash
# LLM/Embedding
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_API_KEY=YOUR_API_KEY

# Meilisearch
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_API_KEY=

# PostgreSQL (已有)
DATABASE_URL=postgresql://hoppuser:YOUR_DATABASE_PASSWORD@localhost:5432/hoppscotch
```

## 文件清单

### 新增文件
- `packages/hoppscotch-backend/src/api-search/embedding.service.ts`
- `packages/hoppscotch-backend/src/api-search/meilisearch.service.ts`
- `packages/hoppscotch-backend/src/api-search/url-parser.service.ts` ⭐ 新增

### 修改文件
- `packages/hoppscotch-backend/src/api-search/api-search.module.ts`
- `packages/hoppscotch-backend/src/api-search/api-search.controller.ts`
- `packages/hoppscotch-backend/src/api-search/api-search.service.ts`
- `packages/hoppscotch-backend/prisma/schema.prisma` (embedding_vector 列)

### 前端文件
- `packages/hoppscotch-common/src/components/http/Sidebar.vue`
- `packages/hoppscotch-common/src/helpers/api-search.service.ts`

## 待优化

1. ~~pgvector 向量搜索~~ ✅ 已完成
2. ~~混合搜索（pgvector + 关键词）~~ ✅ 已完成（RRF 融合）
3. 实时同步（TeamRequest 变更时自动同步到 Meilisearch）
4. 扩展 URL 解析的路径映射表（支持更多 API 模式）
5. 支持自定义参数映射（用户可配置自己的参数语义）
6. HNSW 索引创建（加速大规模向量搜索）
7. embedding_vector 批量更新脚本（使用 AI API 批量重新生成）