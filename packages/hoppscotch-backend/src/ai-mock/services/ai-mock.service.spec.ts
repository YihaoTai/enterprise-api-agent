import { AiMockService } from './ai-mock.service';
import { JsonSchemaInferencer } from '../util/json-schema.inferencer';
describe('Mock repair workflow', () => {
  let llm: any, service: AiMockService;
  beforeEach(() => {
    llm = { generate: jest.fn(), parseJson: JSON.parse, chat: jest.fn() };
    service = new AiMockService(
      new JsonSchemaInferencer(),
      { build: () => 'Generate' } as any,
      llm,
      { analyze: async () => ({ fields: {} }) } as any,
    );
  });
  it('repairs a type error from validation feedback', async () => {
    llm.generate
      .mockResolvedValueOnce('{"active":"true"}')
      .mockResolvedValueOnce('{"active":true}');
    expect(await service.generate('{"active":false}')).toEqual({
      success: true,
      data: { active: true },
    });
    expect(llm.generate.mock.calls[1][0]).toContain('Expected boolean');
  });
  it('bounds repair attempts and never returns invalid data as success', async () => {
    llm.generate.mockResolvedValue('{"active":"true"}');
    expect((await service.generate('{"active":false}')).success).toBe(false);
    expect(llm.generate).toHaveBeenCalledTimes(3);
  });
  it('routes the existing JSON chat endpoint through validation', async () => {
    llm.generate.mockResolvedValue('{"active":true}');
    const result = await service.chat('json', undefined, '{"active":false}');
    expect(result.success).toBe(true);
    expect(llm.chat).not.toHaveBeenCalled();
  });
  it('does not erase explicit business constraints', async () => {
    llm.generate.mockResolvedValue('{"age":-1}');
    const result = await service.generate(
      JSON.stringify({
        type: 'object',
        properties: { age: { type: 'integer', minimum: 0 } },
        required: ['age'],
      }),
    );
    expect(result.success).toBe(false);
  });
});
