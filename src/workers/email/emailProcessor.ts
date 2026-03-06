import nodemailer from 'nodemailer';
import { queryOne } from '../../db/pool';
import { EmailJob } from '../../models/emailJob';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function renderTemplate(template: string, payload: Record<string, any>): string {
  const templates: Record<string, (p: any) => string> = {
    welcome: (p) => `<h1>Welcome, ${p.name}!</h1><p>Your account has been created with email: ${p.email}</p>`,
    password_reset: (p) => `<h1>Password Reset</h1><p>Click <a href="${p.reset_link}">here</a> to reset your password. Expires in 1 hour.</p>`,
    invoice: (p) => `<h1>Invoice #${p.invoice_id}</h1><p>Amount due: $${p.amount}</p><p>Due date: ${p.due_date}</p>`,
    alert: (p) => `<h1>System Alert: ${p.severity}</h1><p>${p.message}</p><p>Time: ${p.timestamp}</p>`,
  };
  const fn = templates[template];
  return fn ? fn(payload) : `<p>${JSON.stringify(payload)}</p>`;
}

export async function processEmailJob(emailJobId: string, data: any): Promise<{ messageId: string }> {
  const emailJob = await queryOne<EmailJob>('SELECT * FROM email_jobs WHERE id = $1', [emailJobId]);
  if (!emailJob) throw new Error(`Email job ${emailJobId} not found`);

  const html = renderTemplate(emailJob.template, emailJob.payload);

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@example.com',
    to: emailJob.recipient_email,
    subject: emailJob.subject,
    html,
  });

  return { messageId: info.messageId };
}
