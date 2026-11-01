import type { Clienta, Configuracion, GiftCard, Servicio, Turno } from "@prisma/client";
import { formatPrecio, linkWhatsapp } from "./formato";
import { fechaISO, fechaLarga, horaAR, sumarDias } from "./tiempo";
import { linkTurno } from "./plantillas-email";

type TurnoCompleto = Turno & {
  clienta: Clienta;
  servicio: Servicio & { incluye?: { nombre: string }[] };
  giftCard?: GiftCard | null;
};

export type TipoAviso = "confirmacion" | "recordatorio" | "cancelacion";

const primerNombre = (t: TurnoCompleto) => t.clienta.nombre.trim().split(/\s+/)[0];
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Link al turno que va al final del mensaje: WhatsApp lo muestra como una tarjeta
 * con el logo, el día y la hora (ver /api/tarjeta).
 */
function linkConTarjeta(t: TurnoCompleto, tipo: "confirmacion" | "recordatorio"): string {
  return `${linkTurno(t)}&v=${tipo}`;
}

/** “mañana”, “hoy” o “el sábado 7 de noviembre” */
function cuandoEs(inicio: Date, ahora = new Date()): string {
  const dia = fechaISO(inicio);
  const hoy = fechaISO(ahora);
  if (dia === hoy) return "*hoy*";
  if (dia === sumarDias(hoy, 1)) return "*mañana*";
  return `el *${fechaLarga(inicio)}*`;
}

function lineaPrecio(t: TurnoCompleto): string {
  if (t.giftCard) {
    const resta = t.precio - t.montoGiftCard;
    return `💳 Gift card ${t.giftCard.codigo}${resta > 0 ? ` · Resta abonar ${formatPrecio(resta)}` : " · ¡No tenés que abonar nada!"}`;
  }
  if (t.montoSena > 0 && t.estado !== "PENDIENTE_PAGO") {
    return `💲 Total ${formatPrecio(t.precio)} · Seña abonada ${formatPrecio(t.montoSena)} · Resta ${formatPrecio(t.precio - t.montoSena)}`;
  }
  return `💲 Total ${formatPrecio(t.precio)}`;
}

/**
 * Mensajes de WhatsApp que manda la profesional desde el panel (con un toque).
 * El precio va sólo en la confirmación y sólo si ella lo elige.
 */
export function mensajeWhatsapp(cfg: Configuracion, t: TurnoCompleto, tipo: TipoAviso, opciones: { conPrecio?: boolean } = {}): string {
  const nombre = primerNombre(t);
  const lugar = cfg.direccion ? `📍 ${cfg.direccion}` : null;
  const incluye = t.servicio.incluye?.length ? ` (${t.servicio.incluye.map((s) => s.nombre).join(" + ")})` : "";
  const dia = `🗓️ *${mayuscula(fechaLarga(t.inicio))}*`;
  const hora = `🕙 *${horaAR(t.inicio)} hs*`;
  // null = línea opcional que no va; "" = renglón en blanco (nunca dos seguidos)
  const lineas = (xs: (string | null)[]) =>
    xs.filter((x): x is string => x !== null).filter((x, i, todas) => x !== "" || (i > 0 && todas[i - 1] !== "")).join("\n").trim();

  switch (tipo) {
    case "confirmacion":
      return lineas([
        "✨ *¡Tu turno está confirmado!* ✨",
        "",
        `Hola ${nombre} 🌿 Te esperamos en *${cfg.nombreNegocio}*`,
        "",
        dia,
        hora,
        `💆‍♀️ ${t.servicio.nombre}${incluye}`,
        opciones.conPrecio ? lineaPrecio(t) : null,
        lugar,
        "",
        "Te recomendamos llegar 5 minutos antes y venir sin maquillaje en el rostro 🤍",
        "",
        "Para ver o cancelar tu turno 👇",
        linkConTarjeta(t, "confirmacion"),
      ]);
    case "recordatorio":
      return lineas([
        "🌸 *Recordatorio de turno* 🌸",
        "",
        `Hola ${nombre}! Te esperamos ${cuandoEs(t.inicio)} en *${cfg.nombreNegocio}* 💛`,
        "",
        dia,
        hora,
        lugar,
        "",
        "Si no podés venir, avisanos por acá 🙏",
        "",
        linkConTarjeta(t, "recordatorio"),
      ]);
    case "cancelacion":
      return lineas([
        `Hola ${nombre}, tu turno en *${cfg.nombreNegocio}* fue cancelado:`,
        "",
        dia,
        hora,
        "",
        "Si querés coordinar otro día, escribinos por acá 🌿",
      ]);
  }
}

/** Link para que la profesional mande el aviso con un toque desde su WhatsApp */
export function linkAvisoWhatsapp(cfg: Configuracion, t: TurnoCompleto, tipo: TipoAviso, opciones: { conPrecio?: boolean } = {}): string | null {
  if (!t.clienta.telefono) return null;
  return linkWhatsapp(t.clienta.telefono, mensajeWhatsapp(cfg, t, tipo, opciones));
}

/** La imagen del turno (logo, día y hora) para descargarla y mandarla como foto */
export function linkImagenTurno(t: Pick<Turno, "id" | "token">, tipo: "confirmacion" | "recordatorio"): string {
  return `/api/tarjeta/${t.id}?${new URLSearchParams({ t: t.token, v: tipo, descargar: "1" })}`;
}
