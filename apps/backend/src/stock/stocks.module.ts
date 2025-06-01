// src/stock/stocks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stocks.controller';
import { StockService } from './stocks.service';
import { StockData } from './entities/stock.entity';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule, 
    TypeOrmModule.forFeature([StockData])
  ],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
