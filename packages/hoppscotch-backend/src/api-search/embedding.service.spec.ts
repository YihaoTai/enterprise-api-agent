import { EmbeddingService } from './embedding.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
jest.mock('axios', () => ({ post: jest.fn() }));
describe('Embedding integrity', () => {
  const service = new EmbeddingService(
    new ConfigService({ EMBEDDING_API_KEY: 'test-only' }),
  );
  beforeEach(() => jest.clearAllMocks());
  it('projects consistently to the existing dimension and normalizes', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { data: [{ embedding: Array(1536).fill(1) }] },
    });
    const vector = await service.generateEmbedding('test');
    expect(vector).toHaveLength(1024);
    expect(Math.hypot(...vector)).toBeCloseTo(1);
  });
  it('does not invent vectors on provider failure', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(service.generateEmbedding('test')).rejects.toThrow('offline');
  });
  it.each([[1, 2], Array(1024).fill(0), Array(1024).fill(NaN)])(
    'rejects malformed vectors',
    async (vector) => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: { data: [{ embedding: vector }] },
      });
      await expect(service.generateEmbedding('test')).rejects.toThrow();
    },
  );
});
