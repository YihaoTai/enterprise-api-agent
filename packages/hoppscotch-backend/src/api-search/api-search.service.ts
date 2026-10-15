/**
 * API Search Service
 * 智能接口搜索 - 关键词 + 向量检索
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { UrlParserService } from './url-parser.service';
import { ApiIndexService } from './api-index.service';

export interface SearchResult {
  id: string;
  name: string;
  path: string;
  method: string;
  description: string | null;
  category: string | null;
  requestid: string | null;
  score: number;
}

export interface SearchParams {
  query: string;
  teamId?: string;
  limit?: number;
}

/**
 * 常用请求体字段同义词映射
 * 用于搜索扩展：当用户搜索某个词时，自动添加其同义词一起搜索
 */
const SYNONYMS: Record<string, string[]> = {
  // 身份认证相关
  密码: ['password', 'pwd', 'passwd', 'secret'],
  password: ['密码', 'pwd', 'passwd', 'secret'],
  账号: ['account', 'username', 'user', 'login'],
  account: ['账号', 'username', '用户'],
  用户名: ['username', 'user', 'name', 'login', 'account'],
  username: ['用户名', 'user', 'name'],
  登录: ['login', 'signin', 'auth', 'authentication', '认证'],
  login: ['登录', 'signin', 'auth', '认证'],
  注册: ['register', 'signup', 'create', '创建账号'],
  register: ['注册', 'signup', '创建'],

  // 用户信息相关
  姓名: ['name', 'username', 'fullname', 'full_name', '名称'],
  name: ['姓名', 'username', 'fullname', 'full_name'],
  邮箱: ['email', 'mail', 'e-mail', '电子邮件', '邮件'],
  email: ['邮箱', 'mail', 'e-mail', '电子邮件'],
  邮件: ['email', 'mail', 'e-mail', '邮箱'],
  电话: ['phone', 'tel', 'mobile', 'telephone', '手机', '号码'],
  phone: ['电话', 'tel', 'mobile', 'telephone'],
  手机: ['phone', 'mobile', 'tel', '电话'],
  地址: ['address', 'location', 'addr', '位置', 'location'],
  address: ['地址', 'location', 'addr', '位置'],

  // 订单相关
  订单: ['order', 'orders', 'dingdan'],
  order: ['订单', 'orders', 'dingdan'],
  商品: ['product', 'item', 'goods', 'commodity', '物品'],
  product: ['商品', 'item', 'goods', 'commodity'],
  价格: ['price', 'cost', 'fee', 'amount', '金额', '价钱'],
  price: ['价格', 'cost', 'fee', 'amount'],
  数量: ['quantity', 'count', 'num', 'number', '数目'],
  quantity: ['数量', 'count', 'num', 'number'],

  // 通用字段
  创建: ['create', 'add', 'new', 'insert', '新增'],
  create: ['创建', 'add', 'new', 'insert'],
  更新: ['update', 'edit', 'modify', 'put', '修改'],
  update: ['更新', 'edit', 'modify', 'put'],
  删除: ['delete', 'remove', 'del', 'drop', '移除'],
  delete: ['删除', 'remove', 'del', 'drop'],
  查询: ['search', 'query', 'find', 'get', '获取', '查找'],
  search: ['查询', 'query', 'find', 'get'],
  查找: ['search', 'query', 'find', 'look', '寻找'],
  列表: ['list', 'lists', 'all', '获取列表'],
  list: ['列表', 'lists', 'all'],

  // 认证相关
  认证: ['auth', 'authentication', 'authorize', '验证', 'authorization'],
  auth: ['认证', 'authentication', 'authorize', '验证'],
  令牌: ['token', 'access_token', 'refresh_token', 'jwt', '凭证'],
  token: ['令牌', 'access_token', 'refresh_token', 'jwt'],
  刷新: ['refresh', 'renew', '更新'],
  refresh: ['刷新', 'renew', '更新'],
};

@Injectable()
export class ApiSearchService {
  private readonly logger = new Logger(ApiSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly urlParserService: UrlParserService,
    private readonly indexService: ApiIndexService,
  ) {}

  /**
   * 智能搜索接口
   * 并行执行关键词 + 向量搜索，通过 RRF 融合得到最优结果
   * 向量搜索权重高于关键词搜索（2:1），确保语义匹配优先
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    const { query, teamId, limit = 10 } = params;
    if (
      !teamId ||
      !query?.trim() ||
      query.length > 2000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      throw new BadRequestException(
        'A team, query (1-2000 characters), and limit (1-50) are required',
      );
    }

    // 扩展搜索词（同义词扩展）
    const expandedQueries = this.expandQuery(query);

    // 使用扩展后的词进行并行搜索
    const [keywordResults, vectorResults] = await Promise.all([
      this.keywordSearch(query, teamId, limit * 2),
      this.vectorSearch(query, teamId, limit * 2),
    ]);

    this.logger.log(
      `Keyword results: ${keywordResults.length}, Vector results: ${vectorResults.length}`,
    );

    // 始终启用 RRF 融合，向量权重为关键词的 2 倍
    const fusedResults = this.rrfFusionWeighted(
      keywordResults,
      vectorResults,
      limit,
      1,
      2,
    );

    return fusedResults;
  }

  /**
   * 扩展搜索词，添加同义词
   * 例如："密码" -> ["密码", "password", "pwd"]
   */
  private expandQuery(query: string): string[] {
    const normalizedQuery = query.toLowerCase().trim();
    const queries = new Set<string>([normalizedQuery]);

    // 检查是否有已知同义词
    if (SYNONYMS[normalizedQuery]) {
      SYNONYMS[normalizedQuery].forEach((syn) =>
        queries.add(syn.toLowerCase()),
      );
    }

    // 检查是否被包含在某个同义词列表中
    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (values.includes(normalizedQuery)) {
        queries.add(key.toLowerCase());
        values.forEach((v) => queries.add(v.toLowerCase()));
      }
    }

    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (normalizedQuery.includes(key)) {
        queries.add(key);
        values.forEach((v) => queries.add(v));
      }
    }
    return Array.from(queries).slice(0, 40);
  }

  /**
   * 关键词搜索（使用 PostgreSQL LIKE 模糊匹配）
   * 搜索范围：name, path, method, description, category, headers, body, params
   * 使用扩展的同义词进行搜索
   * 匹配规则：精确匹配 > 模糊匹配
   * - 精确匹配：字段值等于搜索词（如 name = '登录'）
   * - 模糊匹配：字段包含搜索词（如 name LIKE '%登录%'）
   */
  private async keywordSearch(
    query: string,
    teamId?: string,
    limit: number = 50,
  ): Promise<SearchResult[]> {
    try {
      // 获取扩展搜索词
      const expandedQueries = this.expandQuery(query);
      const originalTerm = query.toLowerCase();

      // 构建多词搜索条件（使用 OR 连接所有扩展词）
      const conditions: string[] = [];
      const params: any[] = [];
      const searchTerms: string[] = [];

      // $1 = exact match term for CASE scoring
      params.push(originalTerm);

      expandedQueries.forEach((q) => {
        const searchTerm = `%${q.toLowerCase()}%`;
        params.push(searchTerm);
        const paramIndex = params.length;
        searchTerms.push(searchTerm);

        // 每个扩展词都添加 OR 条件
        conditions.push(`(LOWER(tr.title) LIKE $${paramIndex}
           OR LOWER((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'endpoint') LIKE $${paramIndex}
           OR LOWER((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'method') LIKE $${paramIndex}
           OR LOWER(COALESCE((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'description', '')) LIKE $${paramIndex}
           OR LOWER(COALESCE(tc.title, '')) LIKE $${paramIndex}
           OR LOWER(COALESCE((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'headers', '')) LIKE $${paramIndex}
           OR LOWER(COALESCE((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'body', '')) LIKE $${paramIndex}
           OR LOWER(COALESCE((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'params', '')) LIKE $${paramIndex})`);
      });

      const whereClause = teamId
        ? `AND tr."teamID" = $${params.length + 1}`
        : '';
      if (teamId) params.push(teamId);

      // CASE 评分规则：精确匹配 > 模糊匹配
      // 精确匹配：字段值 = 搜索词（使用 $1）
      // 模糊匹配：字段包含搜索词（使用扩展词 $2, $3...）
      const sql = `
        SELECT tr.id, tr.title as name, (CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'endpoint' as path, (CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'method' as method, (CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'description' as description, tc.title as category, tr.id as requestid,
               MAX(CASE
                 -- 精确匹配 name = 搜索词 (最高优先级)
                 WHEN LOWER(tr.title) = $1 THEN 2.0
                 -- 模糊匹配 name (降低权重)
                 WHEN LOWER(tr.title) LIKE '%' || $1 || '%' THEN 1.0
                 -- 精确匹配 path = 搜索词
                 WHEN LOWER((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'endpoint') = $1 THEN 1.8
                 -- 模糊匹配 path
                 WHEN LOWER((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'endpoint') LIKE '%' || $1 || '%' THEN 0.8
                 -- method 匹配
                 WHEN LOWER((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'method') = $1 THEN 1.5
                 WHEN LOWER((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'method') LIKE '%' || $1 || '%' THEN 0.6
                 -- description 匹配
                 WHEN LOWER(COALESCE((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'description', '')) = $1 THEN 1.4
                 WHEN LOWER(COALESCE((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'description', '')) LIKE '%' || $1 || '%' THEN 0.7
                 -- category 匹配
                 WHEN LOWER(COALESCE(tc.title, '')) = $1 THEN 1.3
                 WHEN LOWER(COALESCE(tc.title, '')) LIKE '%' || $1 || '%' THEN 0.6
                 -- body 精确匹配 (重要：请求体中的字段名匹配)
                 WHEN LOWER(COALESCE((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'body', '')) LIKE '%' || $1 || '%' THEN 1.2
                 -- headers 精确匹配
                 WHEN LOWER(COALESCE((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'headers', '')) LIKE '%' || $1 || '%' THEN 1.1
                 -- params 精确匹配
                 WHEN LOWER(COALESCE((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'params', '')) LIKE '%' || $1 || '%' THEN 1.1
                 -- 扩展词的模糊匹配 (使用 $2, $3...)
                 ${searchTerms.map((_, i) => `WHEN LOWER((CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'body') LIKE $${i + 2} THEN 0.9`).join('\n                 ')}
                 ELSE 0.1
               END) as score
        FROM "TeamRequest" tr
        LEFT JOIN "TeamCollection" tc ON tr."collectionID" = tc.id
        WHERE (${conditions.join(' OR ')})
        ${whereClause}
        GROUP BY tr.id, tr.title, (CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'endpoint', (CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'method', (CASE WHEN jsonb_typeof(tr.request::jsonb) = 'string' THEN (tr.request::jsonb #>> '{}')::jsonb ELSE tr.request::jsonb END)->>'description', tc.title
        ORDER BY score DESC, tr.id ASC
        LIMIT ${limit}
      `;

      const results = await this.prisma.$queryRawUnsafe(sql, ...params);

      return (results as any[]).map((row: any) => ({
        id: row.id,
        name: row.name,
        path: row.path,
        method: row.method,
        description: row.description,
        category: row.category,
        requestid: row.id,
        score: parseFloat(row.score) || 0,
      }));
    } catch (error: any) {
      this.logger.warn(`Keyword search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 向量搜索（使用 embedding 相似度）
   * 从 APISpec 表检索（该表的 embedding 已包含 headers, body, params）
   * 降低阈值到 0.65，允许更多语义相似但不一定完全匹配的结果通过
   */
  private async vectorSearch(
    query: string,
    teamId?: string,
    limit: number = 50,
  ): Promise<SearchResult[]> {
    try {
      // 生成 query 的 embedding
      const embedding = await this.embeddingService.generateEmbedding(query);

      // 将 embedding 转换为 SQL 数组格式
      const embeddingStr = `[${embedding.join(',')}]`;

      const whereClause = teamId ? `AND "teamid" = $2` : '';
      const params = [
        embeddingStr,
        teamId,
        this.embeddingService.modelIdentity,
      ];

      // 从 APISpec 表检索，该表的 embedding 已包含 headers, body, params
      // 余弦距离阈值从 0.5 降低到 0.65，扩大语义匹配范围
      const sql = `
        SELECT id, name, path, method, description, category, "requestid",
               (embedding_vector <=> $1::vector)::float8 as distance
        FROM "APISpec"
        WHERE embedding_vector IS NOT NULL
          AND "syncStatus" = 'ready'
          AND "embeddingModel" = $3
          AND EXISTS (SELECT 1 FROM "TeamRequest" tr WHERE tr.id = "APISpec".requestid
            AND tr."teamID" = "APISpec".teamid AND tr."updatedOn" = "APISpec"."sourceVersion" AND tr.request::jsonb = "APISpec"."sourceRequest" AND tr.title = "APISpec".name)
          AND (embedding_vector <=> $1::vector)::float8 < 0.65
        ${whereClause}
        ORDER BY distance ASC
        LIMIT ${limit}
      `;

      const results = await this.prisma.$queryRawUnsafe(sql, ...params);

      return (results as any[]).map((row: any) => ({
        id: row.id,
        name: row.name,
        path: row.path,
        method: row.method,
        description: row.description,
        category: row.category,
        requestid: row.requestid,
        // 余弦距离范围 [0, 2]，转换为相似度 [1, -1]
        // 实际向量相似度通常在 [0.5, 1] 范围
        score: 1 - (parseFloat(row.distance) || 0),
      }));
    } catch (error: any) {
      this.logger.warn(`Vector search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * RRF (Reciprocal Rank Fusion) 结果融合
   * 向量权重高于关键词搜索，确保语义匹配优先
   */
  private rrfFusion(
    keywordResults: SearchResult[],
    vectorResults: SearchResult[],
    limit: number = 10,
  ): SearchResult[] {
    return this.rrfFusionWeighted(keywordResults, vectorResults, limit, 1, 2);
  }

  /**
   * 加权 RRF (Reciprocal Rank Fusion) 结果融合
   * @param keywordWeight 关键词结果权重
   * @param vectorWeight 向量结果权重（建议为关键词的 2-3 倍）
   */
  private rrfFusionWeighted(
    keywordResults: SearchResult[],
    vectorResults: SearchResult[],
    limit: number = 10,
    keywordWeight: number = 1,
    vectorWeight: number = 2,
  ): SearchResult[] {
    const scores = new Map<string, SearchResult>();
    for (const [results, weight] of [
      [keywordResults, keywordWeight],
      [vectorResults, vectorWeight],
    ] as const) {
      const seen = new Set<string>();
      results.forEach((result, index) => {
        const id = result.requestid || result.id;
        if (seen.has(id)) return;
        seen.add(id);
        const contribution = weight / (60 + index + 1);
        const existing = scores.get(id);
        if (existing) existing.score += contribution;
        else scores.set(id, { ...result, id, score: contribution });
      });
    }
    return [...scores.values()]
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  /**
   * 创建或更新接口规范（同步到 APISpec 表用于向量搜索）
   * 将请求头、请求体、查询参数合并到 embedding 中
   */
  async upsertAPISpec(data: {
    name: string;
    path: string;
    method: string;
    description?: string;
    category?: string;
    teamId?: string;
    requestid?: string;
    requestObj?: {
      headers?: Array<{ key: string; value: string }>;
      body?: { contentType: string | null; body: string | null };
      params?: Array<{ key: string; value: string }>;
    };
  }) {
    if (!data.requestid) throw new BadRequestException('requestid is required');
    return this.indexService.enqueue(data.requestid);
  }

  async syncFromTeamRequest(teamId: string) {
    if (!teamId) throw new BadRequestException('teamId is required');
    return this.indexService.enqueueTeam(teamId);
  }
}
