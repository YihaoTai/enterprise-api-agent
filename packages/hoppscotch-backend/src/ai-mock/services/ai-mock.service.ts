/**
 * AI Mock Service
 * Orchestrates the AI Mock generation流程
 */
import { checkSchema, validateData } from '../util/schema-validator';
import { Injectable, Logger } from '@nestjs/common';
import { JsonSchemaInferencer } from '../util/json-schema.inferencer';
import { PromptBuilder } from '../util/prompt.builder';
import { LlmService } from './llm.service';
import { FieldSemanticAnalyzer } from './field-semantic-analyzer';

@Injectable()
export class AiMockService {
  private readonly logger = new Logger(AiMockService.name);

  constructor(
    private readonly schemaInferencer: JsonSchemaInferencer,
    private readonly promptBuilder: PromptBuilder,
    private readonly llmService: LlmService,
    private readonly semanticAnalyzer: FieldSemanticAnalyzer,
  ) {}

  /**
   * Generate Mock data from JSON example
   * Uses LLM-based semantic analysis for better field understanding
   */
  async generate(
    jsonExample: string,
    temperature: number = 0.7,
    history: Record<string, any>[] = [],
  ): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
    try {
      const schema = this.schemaInferencer.infer(jsonExample);
      checkSchema(schema);
      const semanticAnalysis = await this.semanticAnalyzer.analyze(schema);
      const prompt = this.promptBuilder.build(
        schema,
        jsonExample,
        history,
        semanticAnalysis,
      );
      let feedback = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await this.llmService.generate(
          prompt + feedback,
          temperature,
        );
        try {
          const data = this.llmService.parseJson(response);
          const errors = validateData(data, schema);
          if (!errors.length) return { success: true, data };
          feedback =
            '\nPrevious output failed validation. Correct these errors and return only JSON: ' +
            JSON.stringify(errors);
        } catch {
          feedback =
            '\nPrevious output was not valid JSON. Return only a JSON object.';
        }
      }
      return {
        success: false,
        error: 'Generated data failed validation after 3 attempts',
      };
    } catch {
      return {
        success: false,
        error: 'Mock generation failed; check schema and model configuration',
      };
    }
  }

  /**
   * Chat completions for frontend proxy (自然语言 / JSON模板)
   * 直接调用 LLM，不经过 Schema 推断和后处理
   */
  async chat(
    mode: 'description' | 'json',
    typePrompt?: string,
    jsonTemplate?: string,
    temperature: number = 0.2,
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    if (mode === 'json' && jsonTemplate) {
      const result = await this.generate(jsonTemplate, temperature);
      return {
        ...result,
        data: result.data ? JSON.stringify(result.data) : undefined,
      };
    }
    try {
      this.logger.log(`Starting chat generation, mode: ${mode}`);

      let userPrompt: string;

      if (mode === 'json' && jsonTemplate) {
        // JSON 模板模式
        userPrompt = `参考以下 JSON 结构，生成一个相似的 Mock 数据（只生成一条）：

${jsonTemplate}

要求：
1. 字段名、嵌套关系、数据类型必须与模板完全一致
2. 只返回 JSON 对象，不输出任何解释或代码块标记
3. 生成与模板结构相同但值不同的新数据
4. 只生成一条数据，不是数组
5. 值要符合真实业务逻辑（如姓名是中文名、邮箱格式正确等）`;
      } else if (typePrompt) {
        // 自然语言模式
        userPrompt = `返回一个对象（不是数组），仅包含你描述的业务数据。只返回合法 JSON，不输出解释或代码块标记。只生成一条数据。\n${typePrompt}`;
      } else {
        return { success: false, error: '请输入类型描述或 JSON 模板' };
      }

      const messages = [
        {
          role: 'system',
          content:
            '只返回合法 JSON，不输出思考过程，不输出解释，不输出代码块标记。',
        },
        { role: 'user', content: userPrompt },
      ];

      // 调用 LLM
      const response = await this.llmService.chat(messages, temperature);
      this.logger.log('Chat generation completed');

      const data = this.llmService.parseJson(response);
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('Expected JSON object');
      return { success: true, data: JSON.stringify(data) };
    } catch (error: any) {
      this.logger.error(`Chat generation failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Failed to generate mock data',
      };
    }
  }
}
