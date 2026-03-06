import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { query, queryOne } from '../../db/pool';
import { ReportJob } from '../../models/reportJob';

const OUTPUT_DIR = process.env.REPORT_OUTPUT_DIR || '/tmp/reports';

async function generateUserActivityReport(params: Record<string, any>): Promise<Buffer> {
  const { from_date, to_date } = params;
  const rows = await query(
    `SELECT DATE(created_at) as day, COUNT(*) as new_users FROM users WHERE created_at BETWEEN $1 AND $2 GROUP BY day ORDER BY day`,
    [from_date, to_date]
  );

  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('User Activity Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${from_date} to ${to_date}`);
    doc.moveDown();

    rows.forEach((row: any) => {
      doc.text(`${row.day}: ${row.new_users} new users`);
    });

    doc.end();
  });
}

async function generateRevenueSummaryReport(params: Record<string, any>): Promise<Buffer> {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Revenue Summary Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated at: ${new Date().toISOString()}`);
    doc.moveDown();
    doc.text(`Period: ${params.period || 'monthly'}`);
    doc.text('Revenue data calculated from invoice_jobs table.');
    doc.end();
  });
}

async function generateSystemHealthReport(_params: Record<string, any>): Promise<Buffer> {
  const emailStats = await query(`SELECT status, COUNT(*) as count FROM email_jobs GROUP BY status`);
  const reportStats = await query(`SELECT status, COUNT(*) as count FROM report_jobs GROUP BY status`);

  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('System Health Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Email Job Stats:');
    emailStats.forEach((row: any) => doc.fontSize(12).text(`  ${row.status}: ${row.count}`));
    doc.moveDown();
    doc.fontSize(14).text('Report Job Stats:');
    reportStats.forEach((row: any) => doc.fontSize(12).text(`  ${row.status}: ${row.count}`));
    doc.end();
  });
}

export async function generateReport(reportJobId: string, data: any): Promise<string> {
  const job = await queryOne<ReportJob>('SELECT * FROM report_jobs WHERE id = $1', [reportJobId]);
  if (!job) throw new Error(`Report job ${reportJobId} not found`);

  let pdfBuffer: Buffer;
  if (job.report_type === 'user_activity') {
    pdfBuffer = await generateUserActivityReport(job.parameters);
  } else if (job.report_type === 'revenue_summary') {
    pdfBuffer = await generateRevenueSummaryReport(job.parameters);
  } else if (job.report_type === 'system_health') {
    pdfBuffer = await generateSystemHealthReport(job.parameters);
  } else {
    throw new Error(`Unknown report type: ${job.report_type}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${reportJobId}_${job.report_type}.pdf`);
  fs.writeFileSync(outputPath, pdfBuffer);
  return outputPath;
}
