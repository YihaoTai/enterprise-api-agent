import { KnowledgeService } from './knowledge.service';
import { JsonSchemaInferencer } from 'src/ai-mock/util/json-schema.inferencer';
const call = (name: string, args: any) => ({
  tool_calls: [
    {
      id: 'call',
      type: 'function',
      function: { name, arguments: JSON.stringify(args) },
    },
  ],
});
describe('RAG and bounded agent', () => {
  let service: KnowledgeService, prisma: any, search: any, llm: any;
  beforeEach(() => {
    prisma = {
      teamMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'VIEWER' }),
      },
      teamRequest: {
        findFirst: jest.fn().mockImplementation(async ({ where }) =>
          where.id === 'a'
            ? {
                id: 'a',
                title: 'Create',
                request: {
                  method: 'POST',
                  endpoint: '/users',
                  body: { body: '{"id":1}' },
                },
              }
            : null,
        ),
      },
      $executeRawUnsafe: jest.fn(),
      $queryRawUnsafe: jest.fn(),
    };
    search = {
      search: jest
        .fn()
        .mockResolvedValue([
          { id: 'a', name: 'Create', method: 'POST', path: '/users' },
        ]),
    };
    llm = { chat: jest.fn(), parseJson: JSON.parse, toolTurn: jest.fn() };
    service = new KnowledgeService(
      prisma,
      search,
      llm,
      new JsonSchemaInferencer(),
    );
  });
  it('refuses an ungrounded answer when retrieval is empty', async () => {
    search.search.mockResolvedValue([]);
    const result = await service.run('t', 'u', 'question', 'rag');
    expect(result.answer).toContain('没有找到');
    expect(llm.chat).not.toHaveBeenCalled();
  });
  it('returns only real source IDs', async () => {
    llm.chat.mockResolvedValue('{"answer":"Use [a]","sourceIds":["a"]}');
    const result = await service.run('t', 'u', 'question', 'rag');
    expect(result.status).toBe('completed');
    expect(result.citations[0].id).toBe('a');
  });
  it('rejects invented citations', async () => {
    llm.chat.mockResolvedValue('{"answer":"Use it","sourceIds":["other"]}');
    expect((await service.run('t', 'u', 'question', 'rag')).status).toBe(
      'failed',
    );
  });
  it('feeds validation errors back to the model before accepting corrected data', async () => {
    llm.toolTurn
      .mockResolvedValueOnce(call('get_api', { id: 'a' }))
      .mockResolvedValueOnce(
        call('validate_mock', { id: 'a', data: { id: 'wrong' } }),
      )
      .mockResolvedValueOnce(
        call('validate_mock', { id: 'a', data: { id: 2 } }),
      )
      .mockResolvedValueOnce({ content: 'Done [a]' });
    const result = await service.run('t', 'u', 'generate', 'agent');
    expect(result.validatedMocks).toEqual([{ apiId: 'a', data: { id: 2 } }]);
    expect(result.trace[2].output.valid).toBe(false);
  });
  it('rejects unregistered tools without executing arbitrary requests', async () => {
    llm.toolTurn
      .mockResolvedValueOnce(call('http_request', { url: 'http://internal' }))
      .mockResolvedValueOnce({ content: 'Cannot do that' });
    const result = await service.run('t', 'u', 'question', 'agent');
    expect(result.trace[1].status).toBe('failed');
  });
  it('stops a looping model at six turns', async () => {
    llm.toolTurn.mockResolvedValue(call('search_apis', { query: 'users' }));
    const result = await service.run('t', 'u', 'question', 'agent');
    expect(result.status).toBe('limited');
    expect(llm.toolTurn).toHaveBeenCalledTimes(6);
  });
  it('rejects unauthorized runs before reading evidence', async () => {
    prisma.teamMember.findUnique.mockResolvedValue(null);
    await expect(service.run('t', 'u', 'question', 'rag')).rejects.toThrow();
    expect(search.search).not.toHaveBeenCalled();
  });
});
