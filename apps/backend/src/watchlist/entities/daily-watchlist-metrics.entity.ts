import { Entity, Column, PrimaryGeneratedColumn, Unique, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'daily_watchlist_metrics', schema: 'public' })
@Unique(['watchlistDate', 'companyId', 'companyCode'])
@Index(['watchlistDate', 'companyId', 'companyCode'])
export class DailyWatchlistMetrics {
  @PrimaryGeneratedColumn({ name: 'metrics_id' })
  metricsId: number;

  @Column({ name: 'watchlist_date', type: 'date' })
  @Index()
  watchlistDate: Date;

  @Column({ name: 'company_id', type: 'integer' })
  companyId: number;

  @Column({ name: 'company_code', type: 'varchar', length: 30 })
  companyCode: string;

  @Column({ name: 'total_valid_days', type: 'integer', nullable: true })
  totalValidDays: number;

  @Column({ name: 'avg_daily_high_low_range', type: 'double precision', nullable: true })
  avgDailyHighLowRange: number;

  @Column({ name: 'median_daily_volume', type: 'double precision', nullable: true })
  medianDailyVolume: number;

  @Column({ name: 'avg_trading_capital', type: 'double precision', nullable: true })
  avgTradingCapital: number;

  @Column({ name: 'latest_close_price', type: 'double precision', nullable: true })
  latestClosePrice: number;

  @Column({ name: 'hourly_median_volume', type: 'double precision', nullable: true })
  hourlyMedianVolume: number;

  @Column({ name: 'suggested_capital_deployment', type: 'double precision', nullable: true })
  suggestedCapitalDeployment: number;

  @Column({ name: 'pe_ratio', type: 'double precision', nullable: true })
  peRatio: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
