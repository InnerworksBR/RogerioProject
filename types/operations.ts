export interface ReportFilters {
  year: number | null;
  semester: 1 | 2 | null;
  clientId: string | null;
  productReference: string | null;
  revenueType: string | null;
}

export interface UploadMetadata {
  id: string;
  filename: string;
  fingerprint: string;
  status: 'processing' | 'complete' | 'error';
  row_count: number | null;
  period_start: string | null;
  period_end: string | null;
  error_msg: string | null;
  created_at: string;
}

export interface UploadOverlap {
  id: string;
  filename: string;
  period_start: string;
  period_end: string;
}

export interface ShareLink {
  id: string;
  client_id: string;
  year: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}
