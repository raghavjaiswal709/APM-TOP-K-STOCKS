// src/database-test/database-test.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockData } from '../stock/entities/stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockData])]
})
export class DatabaseTestModule {}
