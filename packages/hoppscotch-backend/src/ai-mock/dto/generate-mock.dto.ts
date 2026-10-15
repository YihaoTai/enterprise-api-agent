import {
  MaxLength,
  ArrayMaxSize,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTO for AI Mock generation
 */
export class GenerateMockRequestDto {
  @IsString()
  @MaxLength(20000)
  jsonExample: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  @Type(() => Number)
  temperature?: number = 0.7;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => Object)
  history?: Record<string, any>[];
}

/**
 * Request DTO for frontend proxy (自然语言 / JSON模板)
 */
export class ChatProxyRequestDto {
  @IsString()
  @IsIn(['description', 'json'])
  mode: 'description' | 'json';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  typePrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  jsonTemplate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  @Type(() => Number)
  temperature?: number = 0.2;
}

/**
 * Response DTO for AI Mock generation
 */
export class GenerateMockResponseDto {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

/**
 * Response DTO for chat proxy
 */
export class ChatProxyResponseDto {
  success: boolean;
  data?: string;
  error?: string;
}
