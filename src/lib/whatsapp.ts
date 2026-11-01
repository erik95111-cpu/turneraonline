import type { Clienta, Configuracion, GiftCard, Servicio, Turno } from "@prisma/client";
import { formatDuracion, formatPrecio, linkWhatsapp, numeroWhatsapp } from "./formato";
import { fechaHoraLarga } from "./tiempo";
import { linkTurno } from "./plantillas-email";

type TurnoCompleto = Turno & {
  clienta: Clienta;
  servicio: Servicio & { incluye?: { nombre: string }[] };
  giftCard?: GiftCard | null;
};

export type TipoAviso = "confirmacion" | "recordatorio" | "cancelacion";

const primerNombre = (t: TurnoCompleto) => t.clienta.nombre.trim().split(/\s+/)[0];

function lineasTurno(cfg: Configuracion, t: TurnoCompleto): string[] {
  const incluye = t.servicio.incluye?.length ? ` (${t.servicio.incluye.map((s) => s.nombre).join(" + ")})` : "";
  const resta = t.giftCard ? t.precio - t.montoGiftCard : t.precio - (t.estado === "CONFIRMADO" ? t.montoSena : 0);
  return [
    `📅 ${fechaHoraLarga(t.inicio)}`,
    `✨ ${t.servicio.nombre}${incluye}`,
    `⏱ ${formatDuracion(t.servicio.duracionMin)}`,
    t.giftCard ? `🎁 Gift card ${t.giftCard.codigo}: cubre ${formatPrecio(t.montoGiftCard)}` : "",
    resta > 0 ? `💲 A abonar en la sesión: ${formatPrecio(resta)}` : "",
    cfg.direccion ? `📍 ${cfg.direccion}` : "",
  ].filter(Boolean);
}

/** Textos de WhatsApp: lo mismo que dicen los mails, en formato de chat */
export function mensajeWhatsapp(cfg: Configuracion, t: TurnoCompleto, tipo: TipoAviso): string {
  const nombre = primerNombre(t);
  switch (tipo) {
    case "confirmacion":
      return [
        `Hola ${nombre}! 🌿 Tu turno en ${cfg.nombreNegocio} está *confirmado*.`,
        "",
        ...lineasTurno(cfg, t),
        "",
        "Te recomendamos llegar 5 minutos antes y venir sin maquillaje en el rostro.",
        `Para ver o cancelar tu turno: ${linkTurno(t)}`,
        cfg.politicaCancelacion ? `\n${cfg.politicaCancelacion}` : "",
      ].filter((l) => l !== null).join("\n").trim();
    case "recordatorio":
      return [
        `Hola ${nombre}! Te recordamos tu turno de *mañana* en ${cfg.nombreNegocio} 💆‍♀️`,
        "",
        ...lineasTurno(cfg, t),
        "",
        "¡Te esperamos! Si no podés venir, avisanos por acá.",
        `Ver o cancelar: ${linkTurno(t)}`,
      ].join("\n");
    case "cancelacion":
      return [
        `Hola ${nombre}, tu turno en ${cfg.nombreNegocio} fue *cancelado*:`,
        `📅 ${fechaHoraLarga(t.inicio)} · ${t.servicio.nombre}`,
        "",
        "Si querés otro día, escribinos por acá o reservá en la página.",
      ].join("\n");
  }
}

/** Link para que la profesional mande el aviso con un toque desde su WhatsApp */
export function linkAvisoWhatsapp(cfg: Configuracion, t: TurnoCompleto, tipo: TipoAviso): string | null {
  if (!t.clienta.telefono) return null;
  return linkWhatsapp(t.clienta.telefono, mensajeWhatsapp(cfg, t, tipo));
}

// ─── Envío automático (WhatsApp Business Cloud API de Meta) ──────────────
//
// Se activa sólo si están cargadas WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en Vercel.
// Meta exige plantillas aprobadas: los nombres y parámetros están en el README.

export function whatsappAutomatico(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_ID?.trim());
}

/** Parámetros de cada plantilla, en el orden de las variables {{1}}, {{2}}… */
export function parametrosPlantilla(cfg: Configuracion, t: TurnoCompleto, tipo: TipoAviso): string[] {
  const base = [primerNombre(t), cfg.nombreNegocio, fechaHoraLarga(t.inicio), t.servicio.nombre];
  return tipo === "cancelacion" ? base : [...base, cfg.direccion || "-", linkTurno(t)];
}

const PLANTILLAS: Record<TipoAviso, string> = {
  confirmacion: "WHATSAPP_PLANTILLA_CONFIRMACION",
  recordatorio: "WHATSAPP_PLANTILLA_RECORDATORIO",
  cancelacion: "WHATSAPP_PLANTILLA_CANCELACION",
};
const PLANTILLA_POR_DEFECTO: Record<TipoAviso, string> = {
  confirmacion: "turno_confirmado",
  recordatorio: "turno_recordatorio",
  cancelacion: "turno_cancelado",
};

/**
 * Manda el aviso solo, por la API de Meta. Nunca tira error: devuelve false si
 * no está configurado o si Meta lo rechaza (y entonces queda el botón de un toque).
 */
export async function enviarWhatsappAutomatico(cfg: Configuracion, t: TurnoCompleto, tipo: TipoAviso): Promise<boolean> {
  if (!whatsappAutomatico() || !t.clienta.telefono) return false;
  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v23.0";
  const plantilla = process.env[PLANTILLAS[tipo]]?.trim() || PLANTILLA_POR_DEFECTO[tipo];
  try {
    const r = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_ID!.trim()}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: numeroWhatsapp(t.clienta.telefono),
        type: "template",
        template: {
          name: plantilla,
          language: { code: process.env.WHATSAPP_IDIOMA?.trim() || "es_AR" },
          components: [{ type: "body", parameters: parametrosPlantilla(cfg, t, tipo).map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    if (!r.ok) console.error("[whatsapp]", tipo, r.status, (await r.text()).slice(0, 500));
    return r.ok;
  } catch (err) {
    console.error("[whatsapp]", tipo, err);
    return false;
  }
}
