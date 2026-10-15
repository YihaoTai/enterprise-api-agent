import { ApiSearchService } from './api-search.service';
const hit = (id: string, score = 100) => ({
  id,
  requestid: id,
  name: id,
  path: '/',
  method: 'GET',
  description: '',
  category: '',
  score,
});
describe('Hybrid retrieval regression', () => {
  let service: ApiSearchService;
  let prisma: any, embedding: any;
  beforeEach(() => {
    prisma = { $queryRawUnsafe: jest.fn() };
    embedding = {
      generateEmbedding: jest.fn().mockResolvedValue([1, 0]),
      modelIdentity: 'model',
    };
    service = new ApiSearchService(prisma, embedding, {} as any, {} as any);
  });
  it('uses one-based weighted reciprocal ranks rather than raw keyword scores', () => {
    const result = (service as any).rrfFusionWeighted(
      [hit('B'), hit('C'), hit('A')],
      [hit('A'), hit('C'), hit('B')],
      10,
      1,
      2,
    );
    expect(result.map((x) => x.id)).toEqual(['A', 'C', 'B']);
    expect(result[0].score).toBeCloseTo(1 / 63 + 2 / 61, 10);
  });
  it('deduplicates by request ID, including vector-only results', () => {
    const result = (service as any).rrfFusionWeighted(
      [hit('A')],
      [
        { ...hit('B'), id: 'spec-B' },
        { ...hit('A'), id: 'spec-A' },
      ],
      10,
      1,
      2,
    );
    expect(result).toHaveLength(2);
    expect(result.find((x) => x.id === 'A').score).toBeCloseTo(1 / 61 + 2 / 62);
    expect(result.find((x) => x.id === 'B').score).toBeCloseTo(2 / 61);
  });
  it('does not count a duplicate from the same channel twice', () => {
    const result = (service as any).rrfFusionWeighted(
      [hit('A'), hit('A')],
      [],
      10,
      1,
      2,
    );
    expect(result[0].score).toBeCloseTo(1 / 61);
  });
  it.each([
    { query: 'x' },
    { query: ' ', teamId: 't' },
    { query: 'x', teamId: 't', limit: 100 },
    { query: 'x', teamId: 't', limit: 1.5 },
  ])('rejects invalid or unscoped searches %p', async (params) => {
    await expect(service.search(params)).rejects.toThrow();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
  it('degrades to keyword search when embedding provider fails', async () => {
    embedding.generateEmbedding.mockRejectedValue(new Error('offline'));
    prisma.$queryRawUnsafe.mockResolvedValue([hit('A')]);
    const result = await service.search({ query: '成员', teamId: 't' });
    expect(result[0].score).toBeCloseTo(1 / 61);
    expect(prisma.$queryRawUnsafe.mock.calls[0]).toContain('t');
  });
  it('excludes stale, deleted and incompatible vectors in SQL', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    await service.search({ query: '成员', teamId: 't' });
    const sql = prisma.$queryRawUnsafe.mock.calls.find((x) =>
      x[0].includes('embedding_vector'),
    )[0];
    expect(sql).toContain('sourceVersion');
    expect(sql).toContain('embeddingModel');
    expect(sql).toContain('EXISTS');
  });
});
