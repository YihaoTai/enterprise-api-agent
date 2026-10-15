/**
 * AI Mock Module
 */
import { Module } from '@nestjs/common';
import { AiMockController } from './ai-mock.controller';
import { AiMockService } from './services/ai-mock.service';
import { LlmService } from './services/llm.service';
import { FieldSemanticAnalyzer } from './services/field-semantic-analyzer';
import { JsonSchemaInferencer } from './util/json-schema.inferencer';
import { PromptBuilder } from './util/prompt.builder';

@Module({
  controllers: [AiMockController],
  providers: [
    AiMockService,
    LlmService,
    FieldSemanticAnalyzer,
    JsonSchemaInferencer,
    PromptBuilder,
  ],
  exports: [AiMockService, LlmService, JsonSchemaInferencer],
})
export class AiMockModule {}
