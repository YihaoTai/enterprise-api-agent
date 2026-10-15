import { checkSchema, validateData } from './schema-validator';
import { JsonSchemaInferencer } from './json-schema.inferencer';
describe('Schema and business validation', () => {
  const schema = {
    type: 'object',
    required: ['user_id', 'phone', 'is_active'],
    additionalProperties: false,
    properties: {
      user_id: { type: 'integer', minimum: 1 },
      phone: { type: 'string', format: 'phone-cn' },
      is_active: { type: 'boolean' },
    },
  };
  it('rejects negative IDs and invalid phones despite correct types', () => {
    expect(
      validateData({ user_id: -1, phone: 'abc', is_active: true }, schema).map(
        (x) => x.path,
      ),
    ).toEqual(['$.user_id', '$.phone']);
  });
  it('does not coerce strings to booleans', () => {
    expect(
      validateData(
        { user_id: 1, phone: '13800138000', is_active: 'true' },
        schema,
      ),
    ).toHaveLength(1);
  });
  it('validates required and extra fields', () => {
    expect(
      validateData({ phone: '13800138000', is_active: true, extra: 1 }, schema),
    ).toHaveLength(2);
  });
  it('validates nested arrays and item constraints', () => {
    const errors = validateData([{ age: -2 }], {
      type: 'array',
      items: {
        type: 'object',
        properties: { age: { type: 'integer', minimum: 0 } },
      },
    });
    expect(errors[0].path).toBe('$[0].age');
  });
  it('preserves explicit constraints through schema inference', () => {
    expect(new JsonSchemaInferencer().infer(JSON.stringify(schema))).toEqual(
      schema,
    );
  });
  it('does not infer business constraints from a single example', () => {
    const inferred = new JsonSchemaInferencer().infer('{"user_id":1}');
    expect(validateData({ user_id: -1 }, inferred)).toEqual([]);
  });
  it('rejects unsupported schema constructs instead of pretending to validate', () => {
    expect(() => checkSchema({ type: 'string', pattern: 'x' })).toThrow(
      'Unsupported',
    );
  });
  it.each(['null', '[]', '123'])('rejects non-object templates %s', (value) =>
    expect(() => new JsonSchemaInferencer().infer(value)).toThrow(),
  );
});
