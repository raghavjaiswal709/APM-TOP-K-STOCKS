// apps/backend/src/sipr/sipr.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SiprController } from './sipr.controller';
import { SiprService } from './sipr.service';

@Module({
  imports: [HttpModule],
  controllers: [SiprController],
  providers: [SiprService],
  exports: [SiprService],
})
export class SiprModule {}
