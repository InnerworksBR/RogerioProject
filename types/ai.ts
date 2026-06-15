export interface AIExecutiveSummary {
  headline: string;
  highlights: string[];
  risks: string[];
  opportunities: string[];
  recommended_actions: string[];
}

export interface AIReportSummaryResponse {
  available: boolean;
  reason?: 'missing_api_key' | 'missing_year' | 'no_data';
  model?: string;
  generatedAt?: string;
  summary?: AIExecutiveSummary;
}
