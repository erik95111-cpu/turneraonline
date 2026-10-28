import "server-only";
import nodemailer from "nodemailer";
import { logError, logWarn } from "./log";
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
    // Gmail muestra la contraseña de aplicación en grupos de 4: quitamos los espacios
    auth: { user: SMTP_USER.trim(), pass: SMTP_PASS.replace(/\s+/g, "") },
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
    logWarn(`email desactivado (faltan SMTP_*) · para ${mail.to} | ${mail.subject}`);
    return false;
  }
  try {
    await t.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, ...mail });
    return true;
  } catch (err) {
    // Queda en el log como [LIB:nodemailer] → problema de Gmail/SMTP, no del código
    logError(`email a ${mail.to}`, err);
    return false;
  }
}

/** Para el botón "Enviar mail de prueba": devuelve un mensaje claro si algo falla */
export async function probarEnvio(para: string): Promise<{ ok: boolean; mensaje: string }> {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  const faltan = [!SMTP_HOST && "SMTP_HOST", !SMTP_USER && "SMTP_USER", !SMTP_PASS && "SMTP_PASS"].filter(Boolean);
  if (faltan.length) {
    return { ok: false, mensaje: `Faltan en Vercel las variables: ${faltan.join(", ")}. Cargalas y hacé Redeploy.` };
  }
  const t = getTransporter();
  if (!t) return { ok: false, mensaje: "El envío de mails no está configurado." };
  try {
    await t.verify();
  } catch (err) {
    const texto = String((err as Error).message ?? err);
    if (/535|Username and Password not accepted|Invalid login/i.test(texto)) {
      return {
        ok: false,
        mensaje: "Gmail rechazó el usuario o la contraseña. Revisá que SMTP_USER sea el Gmail completo y SMTP_PASS la contraseña de aplicación de 16 letras (no la contraseña normal).",
      };
    }
    return { ok: false, mensaje: `No se pudo conectar con el servidor de mail: ${texto}` };
  }
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: para,
      subject: "Prueba de mail · Turnos online",
      text: "¡Funciona! Los mails de los turnos se van a enviar desde esta cuenta.",
      html: "<p style=\"font:15px Arial,sans-serif\">¡Funciona! Los mails de los turnos se van a enviar desde esta cuenta.</p>",
    });
    return { ok: true, mensaje: `Mail de prueba enviado a ${para}. Si no lo ves, revisá Spam.` };
  } catch (err) {
    return { ok: false, mensaje: `La conexión anduvo pero el envío falló: ${(err as Error).message}` };
  }
}
