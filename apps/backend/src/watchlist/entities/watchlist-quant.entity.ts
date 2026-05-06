import { Entity, Column, PrimaryColumn, Index, CreateDateColumn } from 'typeorm';

/**
 * Entity for watchlist_quant table in nse_hist_db
 * New watchlist source replacing daily_watchlist + daily_watchlist_metrics
 */
@Entity({ name: 'watchlist_quant', schema: 'public' })
@Index('idx_watchlist_quant_company', ['companyId', 'watchlistDate'])
export class WatchlistQuant {
  @PrimaryColumn({ name: 'watchlist_date', type: 'date' })
  watchlistDate: Date;

  @PrimaryColumn({ name: 'company_id', type: 'integer' })
  companyId: number;

  @Column({ name: 'company_code', type: 'varchar', length: 30 })
  @Index()
  companyCode: string;

  @Column({ name: 'rank', type: 'smallint' })
  rank: number;

  @Column({ name: 'last_close', type: 'double precision', nullable: true })
  lastClose: number | null;

  @Column({ name: 'median_daily_tv_10d', type: 'double precision', nullable: true })
  medianDailyTv10d: number | null;

  @Column({ name: 'atr_pct_10d', type: 'double precision', nullable: true })
  atrPct10d: number | null;

  @Column({ name: 'iv_10d', type: 'double precision', nullable: true })
  iv10d: number | null;

  @Column({ name: 'vol_rank_xs', type: 'double precision', nullable: true })
  volRankXs: number | null;

  @Column({ name: 'dist_from_high_20d', type: 'double precision', nullable: true })
  distFromHigh20d: number | null;

  @Column({ name: 'vol_ratio_t1_vs_10d', type: 'double precision', nullable: true })
  volRatioT1vs10d: number | null;

  @Column({ name: 'median_tradable_ratio_10d', type: 'double precision', nullable: true })
  medianTradableRatio10d: number | null;

  @Column({ name: 'min_tradable_ratio_10d', type: 'double precision', nullable: true })
  minTradableRatio10d: number | null;

  @Column({ name: 'median_p25_window_tv_10d', type: 'double precision', nullable: true })
  medianP25WindowTv10d: number | null;

  @Column({ name: 'max_position_inr', type: 'double precision', nullable: true })
  maxPositionInr: number | null;

  @Column({ name: 'days_capital_data', type: 'smallint', nullable: true })
  daysCapitalData: number | null;

  @Column({ name: 'pe_ratio', type: 'double precision', nullable: true })
  peRatio: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ name: 'exchange', type: 'varchar', length: 10, nullable: true })
  exchange: string | null;
}
