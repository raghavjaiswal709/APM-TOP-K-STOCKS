import { Entity, Column, PrimaryGeneratedColumn, Unique, Index } from 'typeorm';

@Entity({ name: 'watchlists', schema: 'public' })
@Unique(['watchlistName', 'date', 'companyCode', 'exchange'])
@Index(['watchlistName', 'date'])
export class Watchlist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'watchlist_name', type: 'varchar', length: 10 })
  @Index()
  watchlistName: string;

  @Column({ name: 'date', type: 'date' })
  @Index()
  date: Date;

  @Column({ name: 'company_code', type: 'varchar', length: 50 })
  companyCode: string;

  @Column({ name: 'exchange', type: 'varchar', length: 10 })
  exchange: string;
}
