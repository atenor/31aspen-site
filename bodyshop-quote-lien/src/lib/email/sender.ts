import nodemailer from "nodemailer";

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}) {
  if (!isConfigured()) {
    console.log("[EMAIL DEV STUB]", params.subject, "to", params.to);
    return;
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: params.to,
    subject: params.subject,
    text: params.text,
    attachments: params.attachments
  });
}
