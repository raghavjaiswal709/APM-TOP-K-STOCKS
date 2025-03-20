import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockData } from './entities/stock.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockData)
    private stockRepository: Repository<StockData>,
  ) {}

  async getTop5Companies() {
    return this.stockRepository
      .createQueryBuilder('stock')
      .select('stock.company_code', 'companyCode')
      .addSelect('AVG(stock.close)', 'averageClose')
      .groupBy('stock.company_code')
      .orderBy('"averageClose"', 'DESC')
      .limit(5)
      .getRawMany();
  }



  async getCompanyHistory(companyCode: any) {
    return this.stockRepository.find({
      where: { company_code: companyCode },
      order: { date: 'ASC' },
    });
  }
}
