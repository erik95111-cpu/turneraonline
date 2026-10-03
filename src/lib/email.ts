import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return null;
  }
  const port = Number(SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}

/** Envía un mail. Nunca tira error: una falla de mail no debe romper una reserva. */
export async function enviarMail(mail: Mail): Promise<boolean> {
  if (!mail.to) return false;
  const t = getTransporter();
  if (!t) {
    console.info(`[email desactivado] Para: ${mail.to} | ${mail.subject}`);
    return false;
  }
  try {
    await t.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, ...mail });
    return true;
  } catch (err) {
    console.error("[email] Error enviando a", mail.to, err);
    return false;
  }
}
