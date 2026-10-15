import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import { SearchDto } from 'src/api-search/api-search.controller';
import { TeamScopeGuard } from 'src/api-search/team-scope.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ThrottlerBehindProxyGuard } from 'src/guards/throttler-behind-proxy.guard';
import { KnowledgeService } from './knowledge.service';
class RunDto extends SearchDto {
  @IsIn(['rag', 'agent']) mode: 'rag' | 'agent';
}
@Controller('knowledge')
@UseGuards(JwtAuthGuard, TeamScopeGuard, ThrottlerBehindProxyGuard)
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}
  @Post('run')
  run(@Body() dto: RunDto, @Req() req: any) {
    return this.service.run(dto.teamId, req.user.uid, dto.query, dto.mode);
  }
  @Get('runs')
  runs(@Query('teamId') teamId: string, @Req() req: any) {
    return this.service.history(teamId, req.user.uid);
  }
}
