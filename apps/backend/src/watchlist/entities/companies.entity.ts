import { Entity, Column, PrimaryGeneratedColumn, Unique, Index } from 'typeorm';

@Entity({ name: 'companies', schema: 'public' })
@Unique(['companyCode', 'name', 'exchange'])
export class Companies {
  @PrimaryGeneratedColumn({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'company_code', type: 'varchar', length: 30 })
  @Index()
  companyCode: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'exchange', type: 'varchar', length: 10 })
  @Index()
  exchange: string;

  @Column({ name: 'marker', type: 'varchar', length: 10, nullable: true, select: false })
  marker?: string;
}
