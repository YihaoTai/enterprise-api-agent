/**
 * LLM Service for calling OpenAI-compatible APIs
 */
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

/**
 * OpenAI-compatible API request body
 */
interface ChatCompletionRequest {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  max_tokens?: number;
  logit_bias?: Record<string, number>;
}

/**
 * OpenAI-compatible API response
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Error response
 */
interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly maxRetries = 1;
  private readonly timeoutMs = 30000;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get configuration values
   */
  private get config() {
    return {
      baseUrl:
        this.configService.get('LLM_BASE_URL') ||
        this.configService.get('OPENAI_BASE_URL') ||
        'https://api.openai.com/v1',
      apiKey:
        this.configService.get('LLM_API_KEY') ||
        this.configService.get('OPENAI_API_KEY') ||
        '',
      model:
        this.configService.get('LLM_MODEL') ||
        this.configService.get('OPENAI_MODEL') ||
        'gpt-3.5-turbo',
    };
  }

  /**
   * Call LLM with retry
   */
  async generate(
    prompt: string,
    temperature: number = 0.7,
    logitBias?: Record<string, number>,
  ): Promise<string> {
    const { baseUrl, apiKey, model } = this.config;

    if (!apiKey) {
      throw new HttpException(
        'LLM API key not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // 打印完整的 prompt 用于调试

    const requestBody: ChatCompletionRequest = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: 2048,
    };

    // 添加 logit_bias（如果提供）
    if (logitBias && Object.keys(logitBias).length > 0) {
      requestBody.logit_bias = logitBias;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response: AxiosResponse<ChatCompletionResponse> =
          await axios.post(`${baseUrl}/chat/completions`, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: this.timeoutMs,
          });

        const content = response.data.choices?.[0]?.message?.content;
        if (!content) {
          throw new HttpException(
            'Empty response from LLM',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        return content;
      } catch (error: any) {
        lastError = error;
        const response = error.response?.data as ErrorResponse;
        this.logger.error(
          `LLM API call failed (attempt ${attempt + 1}): ${response?.error?.message || error.message}`,
        );
      }
    }

    throw lastError;
  }

  /**
   * Simple chat completions (used by frontend proxy)
   * Non-streaming, returns full response content
   */
  async chat(
    messages: { role: string; content: string }[],
    temperature: number = 0.2,
  ): Promise<string> {
    const { baseUrl, apiKey, model } = this.config;

    if (!apiKey) {
      throw new HttpException(
        'LLM API key not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const requestBody: ChatCompletionRequest = {
      model,
      messages,
      temperature,
      max_tokens: 2048,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response: AxiosResponse<ChatCompletionResponse> =
          await axios.post(`${baseUrl}/chat/completions`, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: this.timeoutMs,
          });

        const content = response.data.choices?.[0]?.message?.content;
        if (!content) {
          throw new HttpException(
            'Empty response from LLM',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        return content;
      } catch (error: any) {
        lastError = error;
        const response = error.response?.data as ErrorResponse;
        this.logger.error(
          `LLM API call failed (attempt ${attempt + 1}): ${response?.error?.message || error.message}`,
        );
      }
    }

    throw lastError;
  }

  async toolTurn(messages: any[], tools: any[]): Promise<any> {
    const { baseUrl, apiKey, model } = this.config;
    if (!apiKey) throw new Error('LLM API key not configured');
    const response = await axios.post(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        model,
        messages,
        tools,
        tool_choice: 'auto',
        parallel_tool_calls: false,
        temperature: 0.1,
        max_tokens: 2048,
      },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15000 },
    );
    const message = response.data?.choices?.[0]?.message;
    if (!message) throw new Error('Empty agent response');
    return message;
  }

  /**
   * Parse JSON from LLM response
   * Handles markdown code blocks and extra text
   */
  parseJson(response: string): Record<string, any> {
    // Try to extract JSON from markdown code block
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fall through to try raw response
      }
    }

    // Try to parse raw response
    try {
      return JSON.parse(response.trim());
    } catch {
      // Try to find JSON object in the response
      const objMatch = response.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try {
          return JSON.parse(objMatch[0]);
        } catch {
          throw new HttpException(
            'Invalid JSON from LLM',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
    }

    throw new HttpException(
      'Could not parse JSON from LLM response',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
