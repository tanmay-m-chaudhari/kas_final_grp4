export interface EmailJob {
  id: string;
  recipient_email: string;
  subject: string;
  template: string;
  payload: Record<string, any>;
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  error?: string;
  sent_at?: string;
  created_at: string;
}

export interface CreateEmailJobDTO {
  recipient_email: string;
  subject: string;
  template: 'welcome' | 'password_reset' | 'invoice' | 'alert';
  payload: Record<string, any>;
}
