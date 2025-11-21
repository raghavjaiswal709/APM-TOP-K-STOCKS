import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PremarketController } from './premarket.controller';
import { PremarketService } from './premarket.service';

@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [PremarketController],
  providers: [PremarketService],
  exports: [PremarketService],
})
export class PremarketModule {}
