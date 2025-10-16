import { Entity, Column, PrimaryGeneratedColumn, Unique, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'daily_watchlist', schema: 'public' })
@Unique(['watchlistDate', 'companyId', 'companyCode', 'exchange'])
@Index(['watchlistDate', 'companyId'])
export class DailyWatchlist {
  @PrimaryGeneratedColumn({ name: 'watchlist_id' })
  watchlistId: number;

  @Column({ name: 'watchlist_date', type: 'date' })
  @Index()
  watchlistDate: Date;

  @Column({ name: 'company_id', type: 'integer' })
  companyId: number;

  @Column({ name: 'company_code', type: 'varchar', length: 30 })
  @Index()
  companyCode: string;

  @Column({ name: 'exchange', type: 'varchar', length: 10 })
  exchange: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
