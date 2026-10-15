import { createHash } from 'crypto';
/**
 * Field Semantic Analyzer
 * Uses LLM to analyze field names and infer their semantic meanings
 * Supports: abbreviations, pinyin, mixed Chinese-English, business jargon
 */
import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from './llm.service';
import { JsonSchema } from '../util/json-schema.inferencer';

/**
 * Semantic analysis result for a single field
 */
export interface FieldSemantic {
  /** Inferred meaning of the field */
  meaning: string;
  /** Expected format of the value */
  format: string;
  /** Business constraints */
  constraint: string;
  /** Suggested random generation rule */
  generationRule: string;
}

/**
 * Complete semantic analysis result
 */
export interface SemanticAnalysisResult {
  fields: Record<string, FieldSemantic>;
}

/**
 * Cache key: schema hash -> analysis result
 */
const semanticCache = new Map<string, SemanticAnalysisResult>();

/**
 * Generate cache key from schema
 */
function generateCacheKey(schema: JsonSchema): string {
  return createHash('sha256').update(JSON.stringify(schema)).digest('hex');
}

@Injectable()
export class FieldSemanticAnalyzer {
  private readonly logger = new Logger(FieldSemanticAnalyzer.name);

  constructor(private readonly llmService: LlmService) {}

  /**
   * Analyze all fields in a schema using LLM
   * Single API call to analyze all fields (cost-efficient)
   */
  async analyze(schema: JsonSchema): Promise<SemanticAnalysisResult> {
    // Check cache first
    const cacheKey = generateCacheKey(schema);
    if (semanticCache.has(cacheKey)) {
      this.logger.debug(`Cache hit for schema: ${cacheKey}`);
      return semanticCache.get(cacheKey)!;
    }

    const fieldsDescription = this.buildFieldsForAnalysis(schema);
    const prompt = this.buildAnalysisPrompt(fieldsDescription);

    this.logger.debug(
      `Analyzing ${Object.keys(schema.properties).length} fields with LLM`,
    );

    try {
      const response = await this.llmService.generate(prompt, 0.3);
      const result = this.parseAnalysisResponse(response);

      // Cache the result
      if (semanticCache.size >= 256)
        semanticCache.delete(semanticCache.keys().next().value);
      semanticCache.set(cacheKey, result);
      this.logger.debug(`Cached analysis result: ${cacheKey}`);

      return result;
    } catch (error: any) {
      this.logger.error(`Field semantic analysis failed: ${error.message}`);
      // Return empty result on failure, let the system fallback to rule-based
      return { fields: {} };
    }
  }

  /**
   * Build fields description for LLM analysis
   */
  private buildFieldsForAnalysis(schema: JsonSchema): string {
    const lines: string[] = [];

    for (const [fieldName, property] of Object.entries(schema.properties)) {
      const type = property.type;
      const description = (property as any).description || '';

      // Extract context: parent object name might help
      const contextHint = this.extractContextHint(fieldName);

      lines.push(
        `- "${fieldName}": ${type}${description ? ` (${description})` : ''}${contextHint ? ` [${contextHint}]` : ''}`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Extract context hint from field name patterns
   */
  private extractContextHint(fieldName: string): string {
    const lower = fieldName.toLowerCase();

    // Common context patterns
    if (
      lower.startsWith('is_') ||
      lower.startsWith('has_') ||
      lower.startsWith('can_')
    ) {
      return 'boolean flag';
    }
    if (lower.endsWith('_id') || lower === 'id') {
      return 'identifier';
    }
    if (lower.endsWith('_url') || lower.endsWith('_uri') || lower === 'url') {
      return 'URL/link';
    }
    if (
      lower.endsWith('_at') ||
      lower.endsWith('_time') ||
      lower.endsWith('_date')
    ) {
      return 'timestamp';
    }
    if (lower.endsWith('_cnt') || lower.endsWith('_num') || lower === 'count') {
      return 'quantity';
    }
    if (
      lower.endsWith('_amt') ||
      lower.endsWith('_price') ||
      lower.endsWith('_fee')
    ) {
      return 'monetary value';
    }

    return '';
  }

  /**
   * Build the LLM analysis prompt
   */
  private buildAnalysisPrompt(fieldsDescription: string): string {
    return `你是一个 JSON 字段语义分析专家。根据以下 JSON Schema 字段列表，分析每个字段的真实语义。

## 任务
分析每个字段的：
1. **meaning**: 推断字段的真实含义（如 yonghu_zhanghao → 用户登录账号）
2. **format**: 值的格式要求（如 手机号格式、邮箱格式、金额范围）
3. **constraint**: 业务约束（如 价格必须 > 0、手机号11位）
4. **generationRule**: 建议的随机生成规则（如 从百家姓随机选取中文姓名、11位手机号）

## 输入字段列表
${fieldsDescription}

## 输出格式要求
请以 JSON 格式输出分析结果：
{
  "fields": {
    "字段名": {
      "meaning": "推断的含义",
      "format": "格式要求",
      "constraint": "约束条件",
      "generationRule": "生成规则"
    },
    ...
  }
}

## 重要规则
1. **缩写识别**：如 mgr → manager（经理）、pri → price（价格）、cnt → count（数量）
2. **拼音识别**：如 yonghu → 用户、zhanghao → 账号、lianxi → 联系
3. **中英混杂**：如 userName → 用户名、phoneNum → 电话号码
4. **上下文推断**：如果同组有 currency 字段，则 amt/pri 很可能是价格
5. **业务语义**：如 tk_num → ticket number（工单号）、grp → group（分组）
6. **生成规则要具体**：如手机号应说明"以13x开头的11位数字"

## 示例

输入：
- "yonghu_zhanghao": "string"
- "mgr": "string"
- "pri": "number"
- "phone_num": "string"
- "is_vip": "boolean"

输出：
{
  "fields": {
    "yonghu_zhanghao": {
      "meaning": "用户登录账号",
      "format": "邮箱或手机号，4-20位",
      "constraint": "不能为空",
      "generationRule": "5-10位字母或数字 + @example.com"
    },
    "mgr": {
      "meaning": "经理/负责人",
      "format": "中文姓名，2-4字",
      "constraint": "不能为英文名",
      "generationRule": "百家姓 + 1-2个常用汉字"
    },
    "pri": {
      "meaning": "价格",
      "format": "正数，最多2位小数",
      "constraint": "> 0",
      "generationRule": "10-99999之间的随机数"
    },
    "phone_num": {
      "meaning": "电话号码",
      "format": "中国手机号11位",
      "constraint": "以13-19开头",
      "generationRule": "以13x开头的11位随机数字"
    },
    "is_vip": {
      "meaning": "是否VIP用户",
      "format": "true/false",
      "constraint": "布尔类型",
      "generationRule": "随机true或false"
    }
  }
}

请分析以下字段并输出 JSON 结果（只输出JSON，不要其他内容）：`;
  }

  /**
   * Parse LLM response to extract analysis result
   */
  private parseAnalysisResponse(response: string): SemanticAnalysisResult {
    try {
      // Try to extract JSON from response
      const jsonMatch =
        response.match(/```(?:json)?\s*([\s\S]*?)```/) ||
        response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        this.logger.warn('No JSON found in LLM response');
        return { fields: {} };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (parsed.fields && typeof parsed.fields === 'object') {
        return parsed as SemanticAnalysisResult;
      }

      this.logger.warn('Invalid analysis response structure');
      return { fields: {} };
    } catch (error: any) {
      this.logger.error(`Failed to parse analysis response: ${error.message}`);
      return { fields: {} };
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    semanticCache.clear();
    this.logger.log('Semantic analysis cache cleared');
  }

  /**
   * Get cache size (for monitoring)
   */
  getCacheSize(): number {
    return semanticCache.size;
  }
}
