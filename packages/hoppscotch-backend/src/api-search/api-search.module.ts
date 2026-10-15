/**
 * API Search Module
 */
import { ApiIndexService } from './api-index.service';
import { TeamScopeGuard } from './team-scope.guard';
import { Module } from '@nestjs/common';
import { ApiSearchController } from './api-search.controller';
import { ApiSearchService } from './api-search.service';
import { EmbeddingService } from './embedding.service';
import { MeilisearchService } from './meilisearch.service';
import { UrlParserService } from './url-parser.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ApiSearchController],
  providers: [
    ApiIndexService,
    TeamScopeGuard,
    ApiSearchService,
    EmbeddingService,
    MeilisearchService,
    UrlParserService,
  ],
  exports: [
    ApiIndexService,
    TeamScopeGuard,
    ApiSearchService,
    MeilisearchService,
    UrlParserService,
  ],
})
export class ApiSearchModule {}
