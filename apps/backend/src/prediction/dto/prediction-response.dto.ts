export class PredictionDataDto {
  close: number;
  predictedat: string;
  confidence?: number;
  accuracy?: number;
}

export class PredictionResponseDto {
  company: string;
  exchange?: string;
  predictions: Record<string, PredictionDataDto>;
  count: number;
  starttime?: string;
  endtime?: string;
  summary?: {
    avgPrice: number;
    highPrice: number;
    lowPrice: number;
    priceRange: number;
    latestPrice: number;
  };
}

export class HealthResponseDto {
  status: 'healthy' | 'stopped';
  running: boolean;
  lastupdate: string;
  activecompanies: string[];
  totalcompanies: number;
  companystatus: Record<
    string,
    {
      totalpredictions: number;
      latestprediction: string;
      exchange?: string;
    }
  >;
  uptime?: number;
  lastPolled?: string;
}

export class CompaniesResponseDto {
  companies: string[];
  count: number;
  details: Record<
    string,
    {
      totalpredictions: number;
      latestprediction: string;
      exchange?: string;
    }
  >;
}

export class BatchPredictionResponseDto {
  results: Record<string, PredictionResponseDto>;
  starttime?: string;
  endtime?: string;
  companiesrequested: number;
  companiesfetched: number;
  errors?: Record<string, string>;
}

export class PredictionMetricsDto {
  mae: number;
  rmse: number;
  mape: number;
  accuracy: number;
  matchCount: number;
  totalPredictions: number;
}
