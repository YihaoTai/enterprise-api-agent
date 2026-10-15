/**
 * AI Mock Controller
 * Provides REST API for AI Mock generation
 */
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ThrottlerBehindProxyGuard } from 'src/guards/throttler-behind-proxy.guard';
import { AiMockService } from './services/ai-mock.service';
import {
  GenerateMockRequestDto,
  GenerateMockResponseDto,
  ChatProxyRequestDto,
  ChatProxyResponseDto,
} from './dto/generate-mock.dto';

@Controller('api/mock')
@UseGuards(JwtAuthGuard, ThrottlerBehindProxyGuard)
export class AiMockController {
  constructor(private readonly aiMockService: AiMockService) {}

  /**
   * Generate Mock data from JSON example
   *
   * POST /api/mock/generate
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body() dto: GenerateMockRequestDto,
  ): Promise<GenerateMockResponseDto> {
    console.log('===========================================');
    console.log('Controller: Received generate request');
    console.log('Controller: dto keys =', Object.keys(dto));
    console.log('Controller: dto.jsonExample type =', typeof dto.jsonExample);
    console.log('Controller: dto.jsonExample =', dto.jsonExample);
    console.log('Controller: dto.temperature =', dto.temperature);
    console.log('===========================================');
    try {
      console.log('Controller: Calling aiMockService.generate...');
      const result = await this.aiMockService.generate(
        dto.jsonExample,
        dto.temperature ?? 0.7,
        dto.history ?? [],
      );
      console.log('Controller: result =', result);

      if (!result.success) {
        console.log('Controller: generate failed, throwing BAD_REQUEST');
        throw new HttpException(
          { success: false, error: result.error },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error: any) {
      console.error('Controller: Caught error:', error.message);
      console.error('Controller: Error response:', error.response);
      if (error instanceof HttpException) {
        throw error;
      }
      const errorMessage = error?.message || error?.error || 'Internal error';
      throw new HttpException(
        { success: false, error: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Chat completions proxy for frontend
   * Routes requests from frontend to LLM without exposing API key
   *
   * POST /api/mock/chat
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatProxyRequestDto): Promise<ChatProxyResponseDto> {
    console.log('Controller: Received chat request, mode =', dto.mode);
    try {
      const result = await this.aiMockService.chat(
        dto.mode,
        dto.typePrompt,
        dto.jsonTemplate,
        dto.temperature ?? 0.2,
      );
      console.log('Controller: chat result =', result);

      if (!result.success) {
        throw new HttpException(
          { success: false, error: result.error },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error: any) {
      console.error('Controller: Chat error:', error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { success: false, error: error.message || 'Internal error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
