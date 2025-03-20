import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'stock_prices' }) // Changed table name to PostgreSQL convention
export class StockData {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'smallint' }) // PostgreSQL equivalent for tinyint
  company_code: number;

  @Column('timestamp') // Changed from datetime2 to timestamp
  date: Date;

  @Column('float')
  open: number;

  @Column('float')
  high: number;

  @Column('float')
  low: number;

  @Column('float')
  close: number;

  @Column('int')
  volume: number;

  @Column('timestamp')
  start_date: Date;

  @Column('timestamp')
  end_date: Date;
}
