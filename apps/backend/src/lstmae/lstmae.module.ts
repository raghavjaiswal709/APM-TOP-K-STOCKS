// apps/backend/src/lstmae/lstmae.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LstmaeController } from './lstmae.controller';
import { LstmaeService } from './lstmae.service';

@Module({
  imports: [HttpModule],
  controllers: [LstmaeController],
  providers: [LstmaeService],
  exports: [LstmaeService],
})
export class LstmaeModule {}
