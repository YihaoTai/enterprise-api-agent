import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsOptional,
} from 'class-validator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { ThrottlerBehindProxyGuard } from 'src/guards/throttler-behind-proxy.guard';
import { ApiSearchService } from './api-search.service';
import { TeamScopeGuard } from './team-scope.guard';

export class TeamDto {
  @IsString() @MinLength(1) @MaxLength(128) teamId: string;
}
export class SearchDto extends TeamDto {
  @IsString() @MinLength(1) @MaxLength(2000) query: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit?: number;
}
@Controller('api-search')
@UseGuards(JwtAuthGuard, TeamScopeGuard, ThrottlerBehindProxyGuard)
export class ApiSearchController {
  constructor(
    private readonly searchService: ApiSearchService,
    private readonly prisma: PrismaService,
  ) {}
  @Post('search')
  async search(@Body() dto: SearchDto) {
    const results = await this.searchService.search(dto);
    return { results, meta: { total: results.length } };
  }
  @Post('sync')
  sync(@Body() dto: TeamDto) {
    return this.searchService.syncFromTeamRequest(dto.teamId);
  }
  @Get('specs')
  async specs(@Query('teamId') teamId: string) {
    const specs = await this.prisma.$queryRawUnsafe(
      `SELECT id,name,path,method,description,category,"syncStatus",attempts,"lastError" FROM "APISpec" WHERE teamid=$1 ORDER BY "updatedAt" DESC LIMIT 100`,
      teamId,
    );
    return { specs };
  }
  @Get('status')
  async status(@Query('teamId') teamId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT "syncStatus" AS status,COUNT(*)::int AS count FROM "APISpec" WHERE teamid=$1 GROUP BY "syncStatus"`,
      teamId,
    );
  }
  @Post('retry')
  async retry(@Body() dto: TeamDto) {
    const queued = await this.prisma.$executeRawUnsafe(
      `UPDATE "APISpec" SET "syncStatus"='pending',attempts=0,"nextRetryAt"=NOW() WHERE teamid=$1 AND "syncStatus"='failed'`,
      dto.teamId,
    );
    return { queued };
  }
}
