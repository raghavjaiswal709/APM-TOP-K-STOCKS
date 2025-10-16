import { Entity, Column, PrimaryGeneratedColumn, Unique, Index } from 'typeorm';

@Entity({ name: 'company_master', schema: 'public' })
@Unique(['companyCode', 'exchange'])
export class CompanyMaster {
  @PrimaryGeneratedColumn({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'company_code', type: 'varchar', length: 50 })
  @Index()
  companyCode: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'exchange', type: 'varchar', length: 10 })
  @Index()
  exchange: string;

  @Column({ name: 'marker', type: 'varchar', length: 10, default: 'EQ' })
  marker: string;
}
