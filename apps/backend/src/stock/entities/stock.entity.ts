import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'stock_prices' }) 
export class StockData {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'smallint' }) 
  company_code: number;

  @Column('timestamp') 
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
