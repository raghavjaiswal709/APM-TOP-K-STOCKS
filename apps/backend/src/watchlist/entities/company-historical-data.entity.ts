import { Entity, Column, PrimaryGeneratedColumn, Unique, Index } from 'typeorm';

@Entity({ name: 'company_historical_data', schema: 'public' })
@Unique(['companyCode', 'exchange', 'date'])
@Index(['companyCode', 'exchange', 'date'])
export class CompanyHistoricalData {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_code', type: 'varchar', length: 50 })
  @Index()
  companyCode: string;

  @Column({ name: 'exchange', type: 'varchar', length: 10 })
  exchange: string;

  @Column({ name: 'date', type: 'date' })
  @Index()
  date: Date;

  @Column({ name: 'total_valid_days', type: 'int', nullable: true })
  totalValidDays: number;

  @Column({ name: 'avg_daily_high_low_range', type: 'decimal', precision: 15, scale: 4, nullable: true })
  avgDailyHighLowRange: number;

  @Column({ name: 'median_daily_volume', type: 'bigint', nullable: true })
  medianDailyVolume: number;

  @Column({ name: 'avg_trading_capital', type: 'decimal', precision: 20, scale: 2, nullable: true })
  avgTradingCapital: number;

  @Column({ name: 'pe_ratio', type: 'decimal', precision: 10, scale: 2, nullable: true })
  peRatio: number;

  @Column({ name: 'n1_pattern_count', type: 'int', nullable: true })
  n1PatternCount: number;
}
