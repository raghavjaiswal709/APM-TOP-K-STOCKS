import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stocks.controller';
import { StockService } from './stocks.service';
import { StockData } from '../stock/entities/stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockData])],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
