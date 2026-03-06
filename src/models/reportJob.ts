export interface ReportJob {
  id: string;
  report_type: string;
  parameters: Record<string, any>;
  status: 'queued' | 'processing' | 'done' | 'failed';
  output_path?: string;
  error?: string;
  requested_by?: string;
  created_at: string;
  completed_at?: string;
}

export interface CreateReportJobDTO {
  report_type: 'user_activity' | 'revenue_summary' | 'system_health';
  parameters: Record<string, any>;
  requested_by?: string;
}
