/** Explicit, bounded JSON Schema subset. No coercion or silent acceptance of unsupported constraints. */
const allowed = new Set([
  'type',
  'properties',
  'items',
  'required',
  'additionalProperties',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'enum',
  'format',
  'description',
  'title',
  '$schema',
  'examples',
  'default',
]);
export interface ValidationIssue {
  path: string;
  message: string;
}
export function checkSchema(schema: any, depth = 0): void {
  if (
    depth > 12 ||
    !schema ||
    typeof schema !== 'object' ||
    Array.isArray(schema)
  )
    throw new Error('Invalid or overly deep schema');
  for (const key of Object.keys(schema))
    if (!allowed.has(key))
      throw new Error(`Unsupported schema keyword: ${key}`);
  if (
    ![
      'object',
      'array',
      'string',
      'integer',
      'number',
      'boolean',
      'null',
    ].includes(schema.type)
  )
    throw new Error('Explicit supported type required');
  if (
    schema.format &&
    !['email', 'uuid', 'date-time', 'phone-cn'].includes(schema.format)
  )
    throw new Error('Unsupported format');
  if (
    schema.required &&
    (!Array.isArray(schema.required) ||
      !schema.required.every((x: any) => typeof x === 'string'))
  )
    throw new Error('Invalid required');
  if (schema.enum && (!Array.isArray(schema.enum) || !schema.enum.length))
    throw new Error('Invalid enum');
  for (const key of [
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
  ])
    if (
      schema[key] !== undefined &&
      (typeof schema[key] !== 'number' || !Number.isFinite(schema[key]))
    )
      throw new Error(`Invalid ${key}`);
  if (
    schema.additionalProperties !== undefined &&
    typeof schema.additionalProperties !== 'boolean'
  )
    throw new Error('additionalProperties must be boolean');
  if (schema.properties) {
    if (
      typeof schema.properties !== 'object' ||
      Array.isArray(schema.properties) ||
      Object.keys(schema.properties).length > 100
    )
      throw new Error('Invalid properties');
    for (const child of Object.values(schema.properties))
      checkSchema(child, depth + 1);
  }
  if (schema.items) checkSchema(schema.items, depth + 1);
}
export function validateData(
  data: any,
  schema: any,
  path = '$',
  issues: ValidationIssue[] = [],
): ValidationIssue[] {
  if (issues.length >= 50) return issues;
  const error = (message: string) => issues.push({ path, message });
  const type =
    data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
  if (
    schema.type === 'integer' ? !Number.isInteger(data) : type !== schema.type
  ) {
    error(`Expected ${schema.type}, received ${type}`);
    return issues;
  }
  if (
    schema.enum &&
    !schema.enum.some((v: any) => JSON.stringify(v) === JSON.stringify(data))
  )
    error('Value is not in enum');
  if (typeof data === 'number') {
    if (!Number.isFinite(data)) error('Number must be finite');
    if (schema.minimum !== undefined && data < schema.minimum)
      error(`Minimum is ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum)
      error(`Maximum is ${schema.maximum}`);
  }
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && [...data].length < schema.minLength)
      error('String too short');
    if (schema.maxLength !== undefined && [...data].length > schema.maxLength)
      error('String too long');
    const formats = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'phone-cn': /^1[3-9]\d{9}$/,
      'date-time':
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
    };
    if (
      schema.format &&
      (!formats[schema.format].test(data) ||
        (schema.format === 'date-time' && !Number.isFinite(Date.parse(data))))
    )
      error(`Invalid ${schema.format}`);
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems)
      error('Too few items');
    if (schema.maxItems !== undefined && data.length > schema.maxItems)
      error('Too many items');
    if (schema.items)
      data.forEach((x, i) =>
        validateData(x, schema.items, `${path}[${i}]`, issues),
      );
  } else if (type === 'object') {
    for (const key of schema.required || [])
      if (!Object.prototype.hasOwnProperty.call(data, key))
        issues.push({
          path: `${path}.${key}`,
          message: 'Required field missing',
        });
    for (const [key, value] of Object.entries(data)) {
      if (Object.prototype.hasOwnProperty.call(schema.properties || {}, key))
        validateData(value, schema.properties[key], `${path}.${key}`, issues);
      else if (schema.additionalProperties === false)
        issues.push({ path: `${path}.${key}`, message: 'Unexpected field' });
    }
  }
  return issues.slice(0, 50);
}
