import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ApiSearchModule } from 'src/api-search/api-search.module';
import { AiMockModule } from 'src/ai-mock/ai-mock.module';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
@Module({
  imports: [PrismaModule, ApiSearchModule, AiMockModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
