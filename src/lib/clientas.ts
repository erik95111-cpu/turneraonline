import type { Turno } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { ErrorReserva } from "./errores";
import { numeroWhatsapp } from "./formato";
import { fechaISO } from "./tiempo";

/** Las mismas que usaba en su sistema anterior; además puede crear las suyas */
export const ETIQUETAS_SUGERIDAS = ["VIP", "Adeuda", "Puntual", "Llega tarde", "Ausente sin aviso"] as const;
/** Color de cada etiqueta sugerida (las propias van en dorado) */
export const COLOR_ETIQUETA: Record<string, string> = {
  VIP: "bg-amber-400",
  Adeuda: "bg-rose-500",
  Puntual: "bg-emerald-500",
  "Llega tarde": "bg-amber-500",
  "Ausente sin aviso": "bg-rose-500",
};

const fecha = z
  .string()
  .trim()
  .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && v <= fechaISO(new Date())), "Fecha de nacimiento inválida")
  .default("");

export const clientaSchema = z.object({
  nombre: z.string().trim().min(2, "Escribí el nombre").max(80),
  telefono: z.string().trim().min(6, "Escribí un WhatsApp o teléfono válido").max(30),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .refine((v) => !v || z.string().email().safeParse(v).success, "Email inválido")
    .default(""),
  fechaNacimiento: fecha,
  direccion: z.string().trim().max(160).default(""),
  tipoPiel: z.string().trim().max(60).default(""),
  alergias: z.string().trim().max(1000).default(""),
});
export type DatosClienta = z.input<typeof clientaSchema>;

/**
 * Alta a mano desde el panel. Si ya hay una clienta con ese mail o WhatsApp, avisa
 * cuál es (para no duplicarla).
 */
export async function crearClienta(entrada: DatosClienta, notaInicial = "", autor = "") {
  const r = clientaSchema.safeParse(entrada);
  if (!r.success) throw new ErrorReserva(r.error.issues[0]?.message ?? "Datos inválidos");
  const d = r.data;
  const whatsapp = numeroWhatsapp(d.telefono);
  const existente = await prisma.clienta.findFirst({
    where: { OR: [{ whatsapp }, ...(d.email ? [{ email: d.email }] : [])] },
  });
  if (existente) throw new ErrorClientaExistente(existente.id, existente.nombre);
  return prisma.clienta.create({
    data: {
      ...d,
      email: d.email || null,
      whatsapp,
      ...(notaInicial.trim() ? { registroNotas: { create: { texto: notaInicial.trim(), autor } } } : {}),
    },
  });
}

export class ErrorClientaExistente extends ErrorReserva {
  constructor(public readonly id: string, nombre: string) {
    super(`Ya tenés cargada a ${nombre} con ese WhatsApp o mail.`);
  }
}

/** Edita los datos de contacto y de la ficha. El mail no se cambia si lo usa otra clienta. */
export async function actualizarClienta(id: string, entrada: DatosClienta) {
  const r = clientaSchema.safeParse(entrada);
  if (!r.success) throw new ErrorReserva(r.error.issues[0]?.message ?? "Datos inválidos");
  const d = r.data;
  if (d.email && (await prisma.clienta.findFirst({ where: { email: d.email, NOT: { id } } }))) {
    throw new ErrorReserva("Ese mail ya lo usa otra clienta");
  }
  return prisma.clienta.update({ where: { id }, data: { ...d, email: d.email || null, whatsapp: numeroWhatsapp(d.telefono) } });
}

/** Normaliza una etiqueta: sin espacios de más, primera letra en mayúscula */
export function limpiarEtiqueta(texto: string): string {
  const t = texto.trim().replace(/\s+/g, " ").slice(0, 30);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

export async function alternarEtiqueta(id: string, etiqueta: string) {
  const e = limpiarEtiqueta(etiqueta);
  if (!e) return;
  const c = await prisma.clienta.findUniqueOrThrow({ where: { id }, select: { etiquetas: true } });
  const ya = c.etiquetas.some((x) => x.toLowerCase() === e.toLowerCase());
  await prisma.clienta.update({
    where: { id },
    data: { etiquetas: ya ? c.etiquetas.filter((x) => x.toLowerCase() !== e.toLowerCase()) : [...c.etiquetas, e] },
  });
}

/** Días que faltan para el próximo cumpleaños (0 = hoy). null si no se sabe la fecha. */
export function diasParaCumple(fechaNacimiento: string, hoy = fechaISO(new Date())): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) return null;
  const [, mes, dia] = fechaNacimiento.split("-").map(Number);
  const [anio, hoyMes, hoyDia] = hoy.split("-").map(Number);
  const base = Date.UTC(anio, hoyMes - 1, hoyDia);
  for (const a of [anio, anio + 1]) {
    // 29 de febrero: en años no bisiestos se festeja el 28
    const d = new Date(Date.UTC(a, mes - 1, dia));
    const cumple = d.getUTCMonth() === mes - 1 ? d : new Date(Date.UTC(a, 1, 28));
    const diff = Math.round((cumple.getTime() - base) / 86_400_000);
    if (diff >= 0) return diff;
  }
  return null;
}

export function edad(fechaNacimiento: string, hoy = fechaISO(new Date())): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) return null;
  const [a, m, d] = fechaNacimiento.split("-").map(Number);
  const [ha, hm, hd] = hoy.split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

/** “Nueva”: todavía no tuvo ninguna sesión realizada */
export const esNueva = (turnos: Pick<Turno, "estado">[]) => !turnos.some((t) => t.estado === "COMPLETADO");

export type EventoTurno = { cuando: Date | null; texto: string; canal?: "WhatsApp" | "Mail"; tipo: "reserva" | "sena" | "aviso" | "estado" };

/**
 * Lo que pasó con un turno, del más nuevo al más viejo (para la línea de tiempo de la ficha).
 * El mail de recordatorio no guarda la hora exacta: se muestra sin fecha.
 */
export function eventosDelTurno(t: Turno): EventoTurno[] {
  const ev: EventoTurno[] = [{ cuando: t.createdAt, texto: t.creadoPorAdmin ? "Turno cargado desde el panel" : "Reservó desde la web", tipo: "reserva" }];
  if (t.montoSena > 0 && t.estado !== "PENDIENTE_PAGO" && t.pagoEstado) ev.push({ cuando: null, texto: "Seña recibida", tipo: "sena" });
  if (t.avisarMail && t.estado !== "PENDIENTE_PAGO") ev.push({ cuando: null, texto: "Confirmación enviada", canal: "Mail", tipo: "aviso" });
  if (t.confirmacionWaEn) ev.push({ cuando: t.confirmacionWaEn, texto: "Confirmación enviada", canal: "WhatsApp", tipo: "aviso" });
  if (t.recordatorioEnviado) ev.push({ cuando: null, texto: "Recordatorio enviado", canal: "Mail", tipo: "aviso" });
  if (t.recordatorioWaEn) ev.push({ cuando: t.recordatorioWaEn, texto: "Recordatorio enviado", canal: "WhatsApp", tipo: "aviso" });
  return ev;
}
