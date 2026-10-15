import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmbeddingService {
  constructor(private readonly configService: ConfigService) {}
  get modelIdentity(): string {
    return `${this.configService.get('EMBEDDING_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}|${this.configService.get('EMBEDDING_MODEL') || 'text-embedding-v1'}|prefix1024-v2`;
  }
  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey =
      this.configService.get('EMBEDDING_API_KEY') ||
      this.configService.get('LLM_API_KEY');
    if (!apiKey) throw new Error('Embedding API key is not configured');
    const baseUrl =
      this.configService.get('EMBEDDING_BASE_URL') ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const response = await axios.post(
      `${baseUrl.replace(/\/$/, '')}/embeddings`,
      {
        model: this.configService.get('EMBEDDING_MODEL') || 'text-embedding-v1',
        input: text.slice(0, 16000),
      },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15000 },
    );
    const vector = response.data?.data?.[0]?.embedding;
    if (
      !Array.isArray(vector) ||
      vector.length < 1024 ||
      !vector.every((v) => typeof v === 'number' && Number.isFinite(v))
    ) {
      throw new Error('Invalid embedding dimensions or values');
    }
    // Preserve the existing vector(1024) schema. Model identity records this projection.
    const projected = vector.slice(0, 1024);
    const norm = Math.hypot(...projected);
    if (!norm) throw new Error('Embedding must not be a zero vector');
    return projected.map((v) => v / norm);
  }
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const result: number[][] = [];
    for (const text of texts) result.push(await this.generateEmbedding(text));
    return result;
  }
  async generateAPISpecEmbedding(
    name: string,
    description?: string,
    category?: string,
    requestObj?: unknown,
  ) {
    return this.generateEmbedding(
      [name, description, category, JSON.stringify(requestObj || {})]
        .filter(Boolean)
        .join(' | '),
    );
  }
}
