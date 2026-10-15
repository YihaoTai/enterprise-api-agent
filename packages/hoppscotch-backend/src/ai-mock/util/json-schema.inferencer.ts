/**
 * JSON Schema inference utility
 * Infers JSON Schema (Draft-07) from example JSON
 */
import { checkSchema } from './schema-validator';
import { Injectable } from '@nestjs/common';

export interface JsonSchemaProperty {
  additionalProperties?: boolean;
  type:
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'object'
    | 'array'
    | 'null';
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  required?: string[];
}

export interface JsonSchema {
  additionalProperties?: boolean;
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
}

interface FieldHint {
  fieldName: string;
  exampleValue: any;
  semanticType?: string;
}

/**
 * Field name patterns for semantic inference
 */
const SEMANTIC_PATTERNS: Record<string, string> = {
  phone: 'phone',
  mobile: 'phone',
  tel: 'phone',
  telephone: 'phone',
  email: 'email',
  mail: 'email',
  name: 'person_name',
  username: 'username',
  nickname: 'nickname',
  first_name: 'first_name',
  last_name: 'last_name',
  full_name: 'person_name',
  age: 'age',
  avatar: 'avatar',
  image: 'image',
  img: 'image',
  photo: 'photo',
  url: 'url',
  link: 'url',
  website: 'url',
  address: 'address',
  city: 'city',
  country: 'country',
  province: 'province',
  state: 'province',
  zipcode: 'zipcode',
  postal_code: 'zipcode',
  amount: 'amount',
  price: 'price',
  cost: 'price',
  discount: 'discount',
  score: 'score',
  rating: 'rating',
  count: 'count',
  number: 'count',
  num: 'count',
  total: 'total',
  id: 'id',
  uuid: 'uuid',
  token: 'token',
  key: 'key',
  secret: 'secret',
  password: 'password',
  description: 'description',
  desc: 'description',
  content: 'content',
  title: 'title',
  headline: 'title',
  summary: 'summary',
  status: 'status',
  type: 'type',
  role: 'role',
  gender: 'gender',
  sex: 'gender',
  birth: 'birthday',
  birthday: 'birthday',
  dob: 'birthday',
  created_at: 'timestamp',
  updated_at: 'timestamp',
  deleted_at: 'timestamp',
  timestamp: 'timestamp',
  time: 'time',
  date: 'date',
  datetime: 'datetime',
};

@Injectable()
export class JsonSchemaInferencer {
  /**
   * Infer JSON Schema from example JSON string
   */
  infer(jsonString: string): JsonSchema {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('An object example or object schema is required');

    // 检测输入是否是 JSON Schema 格式（而非示例数据）
    // JSON Schema 格式特征：包含 type、properties 等关键字
    if (this.isSchemaFormat(parsed)) {
      // 如果输入是 schema 格式，提取其中的 properties 作为字段
      // 同时使用 example values（如果提供）来推断类型
      checkSchema(parsed);
      return parsed;
    }

    const fieldHints = this.extractFieldHints(parsed);

    const properties: Record<string, JsonSchemaProperty> = Object.create(null);
    const required: string[] = [];

    for (const [key, value] of Object.entries(parsed)) {
      if (value !== null) {
        required.push(key);
      }
      properties[key] = this.inferProperty(key, value, fieldHints);
    }

    return {
      type: 'object',
      additionalProperties: false,
      properties,
      required,
    };
  }

  /**
   * 检测输入是否是 JSON Schema 格式
   */
  private isSchemaFormat(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;

    // JSON Schema 格式的关键特征
    const schemaIndicators = [
      'type',
      'properties',
      'items',
      'required',
      '$schema',
    ];
    const hasSchemaIndicator = schemaIndicators.some((key) => key in obj);

    // 进一步检查：如果有 type 且值为 'object' 或 'array'，且有 properties
    if (hasSchemaIndicator && obj.type === 'object' && obj.properties) {
      return true;
    }

    // 如果 properties 的值是对象，且这些对象的值包含 type 关键字
    if (obj.properties && typeof obj.properties === 'object') {
      const propValues = Object.values(obj.properties);
      if (
        propValues.some((v: any) => v && typeof v === 'object' && 'type' in v)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * 将 JSON Schema 格式转换为示例数据格式
   * 从 schema 中提取字段信息，同时保留 example 值（如果有）
   */
  private convertSchemaToExample(schemaObj: any): JsonSchema {
    const properties: Record<string, JsonSchemaProperty> = Object.create(null);
    const required: string[] = schemaObj.required || [];

    for (const [key, prop] of Object.entries(schemaObj.properties || {})) {
      const property = prop as any;

      if (!property || typeof property !== 'object') {
        properties[key] = { type: 'string' };
        continue;
      }

      // 递归转换嵌套对象
      if (property.type === 'object' && property.properties) {
        properties[key] = {
          type: 'object',
          properties: {},
          required: property.required || [],
        };

        const nestedProps = property.properties as Record<string, any>;
        for (const [nestedKey, nestedProp] of Object.entries(nestedProps)) {
          const nestedProperty = nestedProp as any;
          if (!nestedProperty || typeof nestedProperty !== 'object') {
            (properties[key].properties as Record<string, JsonSchemaProperty>)[
              nestedKey
            ] = { type: 'string' };
            continue;
          }

          // 递归转换
          const converted = this.convertProperty(nestedKey, nestedProperty);
          (properties[key].properties as Record<string, JsonSchemaProperty>)[
            nestedKey
          ] = converted;
        }
        continue;
      }

      // 转换数组类型
      if (property.type === 'array' && property.items) {
        properties[key] = {
          type: 'array',
          items: this.convertProperty(key, property.items),
        };
        continue;
      }

      // 普通属性转换
      properties[key] = this.convertProperty(key, property);
    }

    return {
      type: 'object',
      additionalProperties: false,
      properties,
      required,
    };
  }

  /**
   * 转换单个属性
   */
  private convertProperty(
    fieldName: string,
    property: any,
  ): JsonSchemaProperty {
    if (!property || typeof property !== 'object') {
      return { type: 'string' };
    }

    const result: JsonSchemaProperty = { type: property.type || 'string' };

    // 保留 description（如果有）
    if (property.description) {
      result.description = property.description;
    } else {
      // 从字段名推断语义类型
      const semanticType = this.inferSemanticTypeFromFieldName(fieldName);
      if (semanticType) {
        result.description = semanticType;
      }
    }

    // 递归处理嵌套对象
    if (property.type === 'object' && property.properties) {
      const nestedProps: Record<string, JsonSchemaProperty> = {};
      for (const [nestedKey, nestedProp] of Object.entries(
        property.properties,
      )) {
        nestedProps[nestedKey] = this.convertProperty(
          nestedKey,
          nestedProp as any,
        );
      }
      result.properties = nestedProps;
      result.required = property.required || [];
    }

    // 处理数组
    if (property.type === 'array' && property.items) {
      result.items = this.convertProperty(fieldName, property.items);
    }

    return result;
  }

  /**
   * 从字段名推断语义类型
   */
  private inferSemanticTypeFromFieldName(
    fieldName: string,
  ): string | undefined {
    const lowerKey = fieldName.toLowerCase();

    for (const [pattern, type] of Object.entries(SEMANTIC_PATTERNS)) {
      if (lowerKey.includes(pattern)) {
        return type;
      }
    }

    return undefined;
  }

  /**
   * Extract field hints for semantic inference
   */
  private extractFieldHints(obj: any): FieldHint[] {
    const hints: FieldHint[] = [];

    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        let semanticType: string | undefined;

        // Check field name patterns
        for (const [pattern, type] of Object.entries(SEMANTIC_PATTERNS)) {
          if (lowerKey.includes(pattern)) {
            semanticType = type;
            break;
          }
        }

        hints.push({
          fieldName: key,
          exampleValue: obj[key],
          semanticType,
        });
      }
    }

    return hints;
  }

  /**
   * Infer a single property schema
   */
  private inferProperty(
    fieldName: string,
    value: any,
    fieldHints: FieldHint[],
  ): JsonSchemaProperty {
    // Get field hint if available
    const hint = fieldHints.find((h) => h.fieldName === fieldName);

    if (value === null) {
      return { type: 'null' };
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        return {
          type: 'array',
          items: this.inferProperty(`${fieldName}[0]`, value[0], fieldHints),
        };
      }
      return { type: 'array', items: { type: 'string' } };
    }

    if (typeof value === 'object') {
      const properties: Record<string, JsonSchemaProperty> =
        Object.create(null);
      const required: string[] = [];

      for (const key of Object.keys(value)) {
        if (value[key] !== null) {
          required.push(key);
        }
        properties[key] = this.inferProperty(key, value[key], fieldHints);
      }

      return {
        type: 'object',
        additionalProperties: false,
        properties,
        required,
      };
    }

    if (typeof value === 'number') {
      // Check if integer based on value
      if (Number.isInteger(value)) {
        const semanticType = hint?.semanticType;
        if (
          semanticType === 'age' ||
          semanticType === 'count' ||
          semanticType === 'score' ||
          semanticType === 'rating'
        ) {
          return { type: 'integer', description: semanticType };
        }
        return { type: 'integer' };
      }
      return { type: 'number' };
    }

    if (typeof value === 'boolean') {
      return { type: 'boolean' };
    }

    if (typeof value === 'string') {
      // Use semantic type from field hint
      if (hint?.semanticType) {
        return { type: 'string', description: hint.semanticType };
      }

      // Try to detect type from value
      const lowerValue = value.toLowerCase();
      if (
        lowerValue === 'true' ||
        lowerValue === 'false' ||
        lowerValue === '0' ||
        lowerValue === '1'
      ) {
        return { type: 'string' };
      }

      // Check for common patterns
      if (/\S+@\S+\.\S+/.test(value)) {
        return { type: 'string', description: 'email' };
      }
      if (/^1[3-9]\d{9}$/.test(value)) {
        return { type: 'string', description: 'phone' };
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return { type: 'string', description: 'date' };
      }

      return { type: 'string' };
    }

    return { type: 'string' };
  }
}
