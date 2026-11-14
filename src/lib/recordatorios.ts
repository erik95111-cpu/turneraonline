import { prisma } from "./db";
import { getConfig } from "./config";
import { enviarMail } from "./email";
import { ErrorReserva } from "./errores";
import { mailRecordatorio } from "./plantillas-email";
import { aFechaUTC, fechaISO, sumarDias } from "./tiempo";

/** Lo que hace falta para armar el recordatorio (mail o WhatsApp) */
export const datosRecordatorio = { clienta: true, servicio: { include: { incluye: { select: { nombre: true } } } }, giftCard: true } as const;

const delDia = (fecha: string) => ({ gte: aFechaUTC(fecha, "00:00"), lt: aFechaUTC(sumarDias(fecha, 1), "00:00") });

/** Turnos de un día que van a ocurrir: confirmados y los que esperan la seña (todavía vigentes) */
export function turnosDelDia(fecha: string) {
  return prisma.turno.findMany({
    where: {
      inicio: delDia(fecha),
      OR: [{ estado: "CONFIRMADO" }, { estado: "PENDIENTE_PAGO", expiraEn: { gt: new Date() } }],
    },
    include: datosRecordatorio,
    orderBy: { inicio: "asc" },
  });
}

/** Recordatorio por mail de un turno, mandado a mano desde el panel (se puede reenviar) */
export async function enviarRecordatorioMail(turnoId: string): Promise<string> {
  const t = await prisma.turno.findUnique({ where: { id: turnoId }, include: datosRecordatorio });
  if (!t) throw new ErrorReserva("El turno ya no existe");
  if (!t.clienta.email) throw new ErrorReserva(`${t.clienta.nombre} no tiene mail: mandale el recordatorio por WhatsApp.`);
  if (!(await enviarMail(mailRecordatorio(await getConfig(), t)))) {
    throw new ErrorReserva("No se pudo mandar el mail. Revisá en Configuración que el envío de mails funcione.");
  }
  await prisma.turno.update({ where: { id: t.id }, data: { recordatorioEnviado: true } });
  return t.clienta.nombre;
}

/** Manda por mail los recordatorios de un día a todas las que tienen mail y todavía no lo recibieron */
export async function enviarRecordatoriosDelDia(fecha: string): Promise<{ enviados: number; sinMail: number; fallidos: number }> {
  const cfg = await getConfig();
  const turnos = await turnosDelDia(fecha);
  let enviados = 0;
  let fallidos = 0;
  for (const t of turnos.filter((x) => x.clienta.email && !x.recordatorioEnviado)) {
    if (await enviarMail(mailRecordatorio(cfg, t))) {
      await prisma.turno.update({ where: { id: t.id }, data: { recordatorioEnviado: true } });
      enviados++;
    } else fallidos++;
  }
  return { enviados, sinMail: turnos.filter((x) => !x.clienta.email).length, fallidos };
}

/**
 * El recordatorio automático diario (lo llama Vercel): mails a las clientas con turno
 * confirmado mañana. Deja anotado qué hizo, para verlo en la Agenda del panel.
 */
export async function recordatoriosAutomaticos(ahora = new Date()) {
  const manana = sumarDias(fechaISO(ahora), 1);
  const cfg = await getConfig();
  const todos = await prisma.turno.findMany({
    where: { inicio: delDia(manana), estado: { in: ["CONFIRMADO", "PENDIENTE_PAGO"] } },
    include: datosRecordatorio,
  });
  const aMandar = todos.filter((t) => t.estado === "CONFIRMADO" && !t.recordatorioEnviado && t.avisarMail && t.clienta.email);
  let enviados = 0;
  for (const t of aMandar) {
    if (await enviarMail(mailRecordatorio(cfg, t))) {
      await prisma.turno.update({ where: { id: t.id }, data: { recordatorioEnviado: true } });
      enviados++;
    }
  }
  const sinConfirmar = todos.filter((t) => t.estado === "PENDIENTE_PAGO").length;
  const sinMail = todos.filter((t) => t.estado === "CONFIRMADO" && (!t.clienta.email || !t.avisarMail)).length;
  const partes = [
    `${todos.length} ${todos.length === 1 ? "turno" : "turnos"} para mañana`,
    `${enviados} ${enviados === 1 ? "mail enviado" : "mails enviados"}`,
    aMandar.length > enviados ? `${aMandar.length - enviados} no se pudieron mandar (revisá el envío de mails)` : "",
    sinMail ? `${sinMail} sin mail (mandar por WhatsApp)` : "",
    sinConfirmar ? `${sinConfirmar} esperando seña (no se les manda)` : "",
  ].filter(Boolean);
  await prisma.configuracion.update({
    where: { id: cfg.id },
    data: { recordatoriosAutoEn: ahora, recordatoriosAutoResultado: partes.join(" · ") },
  });
  return { revisados: todos.length, enviados, sinMail, sinConfirmar };
}
