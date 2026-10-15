/**
 * Meilisearch Service
 * 集成 Meilisearch 进行语义搜索
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmbeddingService } from './embedding.service';

export interface MeilisearchDocument {
  id: number;
  name: string;
  path: string;
  method: string;
  description?: string;
  category?: string;
  requestid?: string;
  teamid?: string;
  _vector?: number[];
}

export interface MeilisearchSearchResult {
  hits: MeilisearchDocument[];
  query: string;
  processingTimeMs: number;
  estimatedTotalHits: number;
}

@Injectable()
export class MeilisearchService {
  private readonly logger = new Logger(MeilisearchService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly indexName = 'api-specs';

  constructor(
    private readonly configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
  ) {
    this.baseUrl =
      this.configService.get('MEILISEARCH_URL') ||
      'http://localhost:7700';
    this.apiKey = this.configService.get('MEILISEARCH_API_KEY') || '';
  }

  /**
   * 初始化索引
   */
  async initIndex(): Promise<void> {
    try {
      // 检查索引是否存在
      const indexes = await this.getIndexes();
      const exists = indexes.some((idx: any) => idx.uid === this.indexName);

      if (!exists) {
        await this.createIndex();
      }

      // 配置搜索设置
      await this.configureSettings();

      this.logger.log('Meilisearch index initialized');
    } catch (error: any) {
      this.logger.error(`Failed to init index: ${error.message}`);
    }
  }

  /**
   * 获取所有索引
   */
  private async getIndexes() {
    const response = await axios.get(`${this.baseUrl}/indexes`);
    return response.data.results;
  }

  /**
   * 创建索引
   */
  private async createIndex() {
    await axios.post(
      `${this.baseUrl}/indexes`,
      { uid: this.indexName, primaryKey: 'id' }
    );
    this.logger.log(`Created index: ${this.indexName}`);
  }

  /**
   * 配置搜索设置
   */
  private async configureSettings() {
    await axios.patch(
      `${this.baseUrl}/indexes/${this.indexName}/settings`,
      {
        searchableAttributes: ['name', 'path', 'method', 'description', 'category', 'params'],
        displayedAttributes: ['*'],
        filterableAttributes: ['method', 'category', 'teamid'],
        sortableAttributes: ['name', 'createdAt'],
      }
    );
  }

  /**
   * 同步文档到 Meilisearch
   */
  async syncDocuments(docs: MeilisearchDocument[]): Promise<void> {
    try {
      // 为每个文档生成 embedding
      for (const doc of docs) {
        const text = this.buildSearchText(doc);
        const embedding = await this.embeddingService.generateEmbedding(text);
        doc._vector = embedding;
      }

      // 添加文档到 Meilisearch
      await axios.post(
        `${this.baseUrl}/indexes/${this.indexName}/documents`,
        docs
      );

      this.logger.log(`Synced ${docs.length} documents to Meilisearch`);
    } catch (error: any) {
      this.logger.error(`Failed to sync documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * 构建搜索文本
   */
  private buildSearchText(doc: MeilisearchDocument): string {
    const parts = [
      doc.name,
      doc.description,
      doc.category,
      doc.path,
      doc.method,
      doc.requestid,
    ].filter(Boolean);
    return parts.join(' | ');
  }

  /**
   * 搜索文档（语义搜索）
   */
  async search(query: string, limit: number = 10): Promise<MeilisearchSearchResult> {
    try {
      // 生成查询的 embedding
      const embedding = await this.embeddingService.generateEmbedding(query);

      // 使用向量搜索
      const response = await axios.post<MeilisearchSearchResult>(
        `${this.baseUrl}/indexes/${this.indexName}/search`,
        {
          q: query,
          limit,
          // 向量搜索配置
          vector: embedding,
        },
        {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 混合搜索（关键词 + 向量）
   */
  async hybridSearch(query: string, limit: number = 10): Promise<MeilisearchSearchResult> {
    try {
      // 生成查询的 embedding
      const embedding = await this.embeddingService.generateEmbedding(query);

      // 使用混合搜索
      const response = await axios.post<MeilisearchSearchResult>(
        `${this.baseUrl}/indexes/${this.indexName}/search`,
        {
          q: query,
          limit,
          vector: embedding,
          // 混合搜索权重配置
          attributesToRetrieve: ['*'],
          attributesToHighlight: ['name', 'description'],
        },
        {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Hybrid search failed: ${error.message}`);
      // 回退到纯关键词搜索
      return this.keywordSearch(query, limit);
    }
  }

  /**
   * 纯关键词搜索
   */
  async keywordSearch(query: string, limit: number = 10): Promise<MeilisearchSearchResult> {
    try {
      const response = await axios.post<MeilisearchSearchResult>(
        `${this.baseUrl}/indexes/${this.indexName}/search`,
        {
          q: query,
          limit,
        },
        {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Keyword search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 从 PostgreSQL 同步数据到 Meilisearch
   */
  async syncFromPostgres(prisma: any, teamId?: string): Promise<number> {
    try {
      // 从 APISpec 表读取数据
      const whereClause = teamId ? `WHERE "teamid" = $1` : '';
      const teamIdParam = teamId ? [teamId] : [];

      const sql = `
        SELECT id, name, path, method, description, category, "teamid", "requestid"
        FROM "APISpec"
        ${whereClause}
        ORDER BY "updatedAt" DESC
        LIMIT 1000
      `;

      const docs = await prisma.$queryRawUnsafe(sql, ...teamIdParam);

      if (docs && docs.length > 0) {
        await this.syncDocuments(docs as MeilisearchDocument[]);
      }

      return docs?.length || 0;
    } catch (error: any) {
      this.logger.error(`Sync from postgres failed: ${error.message}`);
      throw error;
    }
  }
}