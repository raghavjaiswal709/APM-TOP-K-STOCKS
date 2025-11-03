import { IsString, IsNumber, IsDateString, IsOptional, IsArray } from 'class-validator';

export class CreatePredictionDto {
  @IsString()
  company: string;

  @IsDateString()
  timestamp: string;

  @IsNumber()
  close: number;

  @IsDateString()
  predictedat: string;

  @IsString()
  @IsOptional()
  exchange?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class PredictionQueryDto {
  @IsString()
  @IsOptional()
  starttime?: string;

  @IsString()
  @IsOptional()
  endtime?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  exchange?: string;
}

export class BatchPredictionQueryDto {
  @IsArray()
  @IsString({ each: true })
  companies: string[];

  @IsString()
  @IsOptional()
  starttime?: string;

  @IsString()
  @IsOptional()
  endtime?: string;
}

export class PredictionFilterDto {
  @IsString()
  @IsOptional()
  company?: string;

  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @IsOptional()
  maxPrice?: number;

  @IsString()
  @IsOptional()
  exchange?: string;
}
