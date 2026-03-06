import { query } from './pool';

export async function runMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS email_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      template TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
      attempts INTEGER DEFAULT 0,
      error TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS report_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      report_type TEXT NOT NULL,
      parameters JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed')),
      output_path TEXT,
      error TEXT,
      requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_email_jobs_status ON email_jobs(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_report_jobs_status ON report_jobs(status)`);
}
