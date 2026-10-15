import { ApiIndexService, describeRequest } from './api-index.service';
describe('Durable index synchronization', () => {
  it('embeds field structure without headers, query values or sample secrets', () => {
    const value = describeRequest({
      endpoint: 'https://u:password@host/api?token=secret',
      method: 'POST',
      headers: [{ key: 'Authorization', value: 'secret' }],
      params: [{ key: 'token', value: 'secret' }],
      body: { body: '{"password":"secret","age":3}' },
    });
    expect(JSON.stringify(value)).not.toContain('secret');
    expect(JSON.stringify(value)).not.toContain('u:password');
    expect(value.body).toEqual({ password: 'string', age: 'number' });
  });
  it('guards vector writes with source version, content hash and lease', async () => {
    const prisma: any = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: 'a',
          contentHash: 'h',
          sourceText: 'text',
          leaseToken: 'lease',
          attempts: 0,
        },
      ]),
      $executeRawUnsafe: jest.fn(),
    };
    const service = new ApiIndexService(prisma, {
      generateEmbedding: jest.fn().mockResolvedValue([1]),
      modelIdentity: 'm',
    } as any);
    await service.processNext();
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain(
      'sourceVersion',
    );
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('contentHash');
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('leaseToken');
  });
  it('records retry state without marking a failed job ready', async () => {
    const prisma: any = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: 'a',
          contentHash: 'h',
          sourceText: 'text',
          leaseToken: 'lease',
          attempts: 2,
        },
      ]),
      $executeRawUnsafe: jest.fn(),
    };
    const service = new ApiIndexService(prisma, {
      generateEmbedding: jest.fn().mockRejectedValue(new Error('offline')),
    } as any);
    await service.processNext();
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain("'failed'");
    expect(prisma.$executeRawUnsafe.mock.calls[0][1]).toBe(60);
  });
});
