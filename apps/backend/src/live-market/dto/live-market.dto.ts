export class SubscribeCompaniesDto {
  companyCodes: string[];
  clientId?: string;
}

export class UnsubscribeDto {
  clientId?: string;
}

export class CompanySelectionDto {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  symbol: string;
}
