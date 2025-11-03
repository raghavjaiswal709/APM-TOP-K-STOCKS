import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('predictions')
@Index(['company', 'timestamp'], { unique: true })
@Index(['company', 'createdAt'])
@Index(['timestamp'])
export class PredictionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  company: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  close: number;

  @Column({ type: 'timestamp' })
  predictedat: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'NSE' })
  exchange: string;
}
