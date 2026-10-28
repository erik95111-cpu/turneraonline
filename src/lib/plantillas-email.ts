import type { Clienta, Configuracion, GiftCard, Servicio, Turno } from "@prisma/client";
import { formatDuracion, formatPrecio, linkWhatsapp } from "./formato";
import { fechaHoraLarga } from "./tiempo";
import { siteUrl } from "./config";
import type { Mail } from "./email";

type TurnoCompleto = Turno & { clienta: Clienta; servicio: Servicio; giftCard?: GiftCard | null };
type GiftCardCompleta = GiftCard & { servicio: Servicio | null };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(cfg: Configuracion, titulo: string, cuerpo: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ec;font-family:Georgia,'Times New Roman',serif;color:#1a1714">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b0a0c;padding:28px;text-align:center">
<img src="${siteUrl()}/logo.png" width="96" height="96" alt="${esc(cfg.nombreNegocio)}" style="border-radius:50%">
</td></tr>
<tr><td style="padding:32px 28px">
<h1 style="margin:0 0 16px;font-size:22px;font-weight:normal;color:#8a6d3b">${titulo}</h1>
${cuerpo}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #eee;font:12px Arial,sans-serif;color:#888;text-align:center">
${esc(cfg.nombreNegocio)}${cfg.direccion ? ` · ${esc(cfg.direccion)}` : ""}${cfg.whatsapp ? ` · WhatsApp ${esc(cfg.whatsapp)}` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

function detalle(t: TurnoCompleto): string {
  const fila = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#888;font:14px Arial,sans-serif;width:120px">${k}</td><td style="padding:6px 0;font:15px Arial,sans-serif">${v}</td></tr>`;
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-top:1px solid #eee;border-bottom:1px solid #eee">
${fila("Tratamiento", esc(t.servicio.nombre))}
${fila("Fecha", esc(fechaHoraLarga(t.inicio)))}
${fila("Duración", formatDuracion(t.servicio.duracionMin))}
${fila("Precio", formatPrecio(t.precio))}
${t.montoSena ? fila(t.estado === "PENDIENTE_PAGO" ? "Seña a abonar" : "Seña abonada", formatPrecio(t.montoSena)) : ""}
${t.giftCard ? fila("Gift card", `${esc(t.giftCard.codigo)} · cubre ${formatPrecio(t.montoGiftCard)}`) : ""}
${t.giftCard && t.precio > t.montoGiftCard ? fila("A abonar en la sesión", formatPrecio(t.precio - t.montoGiftCard)) : ""}
</table>`;
}

function boton(href: string, texto: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#0b0a0c;color:#e6cf9f;padding:12px 22px;border-radius:999px;text-decoration:none;font:14px Arial,sans-serif;letter-spacing:.5px">${texto}</a></p>`;
}

function p(texto: string): string {
  return `<p style="font:15px/1.6 Arial,sans-serif;margin:0 0 12px">${texto}</p>`;
}

function textoPlano(t: TurnoCompleto): string {
  return [
    `Tratamiento: ${t.servicio.nombre}`,
    `Fecha: ${fechaHoraLarga(t.inicio)}`,
    `Duración: ${formatDuracion(t.servicio.duracionMin)}`,
    `Precio: ${formatPrecio(t.precio)}`,
    t.montoSena ? `${t.estado === "PENDIENTE_PAGO" ? "Seña a abonar" : "Seña abonada"}: ${formatPrecio(t.montoSena)}` : "",
    t.giftCard ? `Gift card: ${t.giftCard.codigo} (cubre ${formatPrecio(t.montoGiftCard)})` : "",
  ].filter(Boolean).join("\n");
}

export function linkTurno(t: Turno): string {
  return `${siteUrl()}/reserva/${t.id}?t=${t.token}`;
}

/** Archivo .ics para agregar el turno al calendario */
export function archivoIcs(cfg: Configuracion, t: TurnoCompleto): string {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Healthy Skin//Turnos//ES", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${t.id}@healthyskin`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(t.inicio)}`,
    `DTEND:${f(t.fin)}`,
    `SUMMARY:${t.servicio.nombre} - ${cfg.nombreNegocio}`,
    cfg.direccion ? `LOCATION:${cfg.direccion}` : "",
    `DESCRIPTION:Ver o cancelar: ${linkTurno(t)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export function mailConfirmacionClienta(cfg: Configuracion, t: TurnoCompleto): Mail {
  const nombre = esc(t.clienta.nombre.split(" ")[0]);
  const html = layout(cfg, "¡Tu turno está confirmado!", `
${p(`Hola ${nombre}, te esperamos para tu sesión. Estos son los datos de tu reserva:`)}
${detalle(t)}
${cfg.direccion ? p(`📍 <strong>Dirección:</strong> ${esc(cfg.direccion)}`) : ""}
${p("Te recomendamos llegar 5 minutos antes y venir sin maquillaje en el rostro.")}
${boton(linkTurno(t), "Ver o cancelar mi turno")}
${cfg.politicaCancelacion ? `<p style="font:12px/1.5 Arial,sans-serif;color:#888">${esc(cfg.politicaCancelacion)}</p>` : ""}`);
  return {
    to: t.clienta.email,
    subject: `Turno confirmado · ${t.servicio.nombre} · ${fechaHoraLarga(t.inicio)}`,
    html,
    text: `Hola ${t.clienta.nombre}, tu turno está confirmado.\n\n${textoPlano(t)}\n\nVer o cancelar: ${linkTurno(t)}`,
    attachments: [{ filename: "turno.ics", content: archivoIcs(cfg, t), contentType: "text/calendar" }],
  };
}

export function mailNuevoTurnoProfesional(cfg: Configuracion, t: TurnoCompleto): Mail {
  const wa = t.clienta.telefono ? linkWhatsapp(t.clienta.telefono) : "";
  const html = layout(cfg, "Nuevo turno reservado", `
${p(`<strong>${esc(t.clienta.nombre)}</strong> reservó un turno.`)}
${detalle(t)}
${p(`✉️ ${esc(t.clienta.email)}<br>📱 ${wa ? `<a href="${wa}">${esc(t.clienta.telefono)}</a>` : "-"}`)}
${t.notasClienta ? p(`<strong>Comentario:</strong> ${esc(t.notasClienta)}`) : ""}
${boton(`${siteUrl()}/admin`, "Abrir la agenda")}`);
  return {
    to: cfg.emailProfesional,
    subject: `Nuevo turno: ${t.clienta.nombre} · ${t.servicio.nombre} · ${fechaHoraLarga(t.inicio)}`,
    html,
    text: `Nuevo turno de ${t.clienta.nombre} (${t.clienta.email}, ${t.clienta.telefono})\n\n${textoPlano(t)}\n\nComentario: ${t.notasClienta || "-"}`,
  };
}

export function mailCancelacion(cfg: Configuracion, t: TurnoCompleto, para: "clienta" | "profesional"): Mail {
  const html = layout(cfg, "Turno cancelado", `
${p(para === "clienta"
    ? `Hola ${esc(t.clienta.nombre.split(" ")[0])}, tu turno fue cancelado.`
    : `Se canceló el turno de <strong>${esc(t.clienta.nombre)}</strong>.`)}
${detalle(t)}
${para === "clienta" ? boton(`${siteUrl()}/reservar`, "Reservar otro turno") : ""}`);
  return {
    to: para === "clienta" ? t.clienta.email : cfg.emailProfesional,
    subject: `Turno cancelado · ${t.servicio.nombre} · ${fechaHoraLarga(t.inicio)}`,
    html,
    text: `Turno cancelado (${t.clienta.nombre})\n\n${textoPlano(t)}`,
  };
}

export function mailRecordatorio(cfg: Configuracion, t: TurnoCompleto): Mail {
  const html = layout(cfg, "Te esperamos mañana", `
${p(`Hola ${esc(t.clienta.nombre.split(" ")[0])}, te recordamos tu turno:`)}
${detalle(t)}
${cfg.direccion ? p(`📍 ${esc(cfg.direccion)}`) : ""}
${boton(linkTurno(t), "Ver o cancelar mi turno")}`);
  return {
    to: t.clienta.email,
    subject: `Recordatorio · ${t.servicio.nombre} · ${fechaHoraLarga(t.inicio)}`,
    html,
    text: `Recordatorio de tu turno\n\n${textoPlano(t)}\n\nVer o cancelar: ${linkTurno(t)}`,
  };
}

/** Mensaje con el que la clienta abre el chat de WhatsApp para abonar la seña */
export function mensajeSena(t: TurnoCompleto): string {
  return `Hola! Reservé un turno y quiero abonar la seña de ${formatPrecio(t.montoSena)}:\n${t.servicio.nombre} - ${fechaHoraLarga(t.inicio)}\nA nombre de: ${t.clienta.nombre}`;
}

export function mailReservaPendienteClienta(cfg: Configuracion, t: TurnoCompleto): Mail {
  const nombre = esc(t.clienta.nombre.split(" ")[0]);
  const limite = t.expiraEn ? fechaHoraLarga(t.expiraEn) : "";
  const wa = cfg.whatsapp ? linkWhatsapp(cfg.whatsapp, mensajeSena(t)) : "";
  const html = layout(cfg, "Tu turno está reservado: falta la seña", `
${p(`Hola ${nombre}, te guardamos este horario. Para confirmarlo, escribinos por WhatsApp para abonar la seña de <strong>${formatPrecio(t.montoSena)}</strong>.`)}
${detalle(t)}
${limite ? p(`⏰ Tenés tiempo hasta el <strong>${esc(limite)}</strong>. Si no se abona la seña, el horario se libera.`) : ""}
${wa ? boton(wa, "Abonar la seña por WhatsApp") : ""}
${p(`<a href="${linkTurno(t)}" style="color:#8a6d3b">Ver mi reserva</a>`)}`);
  return {
    to: t.clienta.email,
    subject: `Reserva pendiente de seña · ${t.servicio.nombre} · ${fechaHoraLarga(t.inicio)}`,
    html,
    text: [
      `Hola ${t.clienta.nombre}, te guardamos este horario. Para confirmarlo, escribinos por WhatsApp para abonar la seña de ${formatPrecio(t.montoSena)}.`,
      "",
      textoPlano(t),
      "",
      limite ? `Tenés tiempo hasta el ${limite}.` : "",
      wa ? `Abonar la seña por WhatsApp: ${wa}` : "",
      `Ver mi reserva: ${linkTurno(t)}`,
    ].filter(Boolean).join("\n"),
  };
}

export function mailNuevaReservaProfesional(cfg: Configuracion, t: TurnoCompleto): Mail {
  const wa = t.clienta.telefono ? linkWhatsapp(t.clienta.telefono) : "";
  const html = layout(cfg, "Nueva reserva: esperando la seña", `
${p(`<strong>${esc(t.clienta.nombre)}</strong> reservó un turno y te va a escribir por WhatsApp para abonar la seña.`)}
${detalle(t)}
${p(`✉️ ${esc(t.clienta.email)}<br>📱 ${wa ? `<a href="${wa}">${esc(t.clienta.telefono)}</a>` : "-"}`)}
${t.notasClienta ? p(`<strong>Comentario:</strong> ${esc(t.notasClienta)}`) : ""}
${p("Cuando cobres la seña, entrá al panel y tocá <strong>“Seña recibida”</strong> para confirmar el turno.")}
${boton(`${siteUrl()}/admin`, "Abrir la agenda")}`);
  return {
    to: cfg.emailProfesional,
    subject: `Nueva reserva (esperando seña): ${t.clienta.nombre} · ${t.servicio.nombre} · ${fechaHoraLarga(t.inicio)}`,
    html,
    text: `Nueva reserva de ${t.clienta.nombre} (${t.clienta.email}, ${t.clienta.telefono}) esperando la seña (te va a escribir por WhatsApp).\n\n${textoPlano(t)}\n\nCuando cobres la seña, confirmala desde el panel: ${siteUrl()}/admin`,
  };
}

// ─── Gift cards ────────────────────────────────────────────

const linkGift = (g: GiftCard) => `${siteUrl()}/gift-cards/${g.id}?t=${g.token}`;
const valorGift = (g: GiftCardCompleta) => (g.servicio ? g.servicio.nombre : formatPrecio(g.monto));

/** La tarjeta dorada (modelo “Oro pleno”) armada con tablas para que se vea en cualquier casilla */
function tarjetaGift(g: GiftCardCompleta, conCodigo: boolean): string {
  const rot = "font:600 10px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#4a3a22";
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;max-width:480px;border-radius:14px;background-color:#c9a96e;background-image:linear-gradient(100deg,#8a6d3b,#e6cf9f 50%,#c9a96e)">
<tr><td style="padding:26px 26px 8px" width="96"><img src="${siteUrl()}/logo.png" width="86" height="86" alt="" style="display:block;border-radius:50%;border:3px solid #1a140c"></td>
<td style="padding:26px 26px 8px 4px;color:#1a140c"><div style="${rot}">Gift card</div>
<div style="font:italic 30px/1.1 Georgia,serif">${g.servicio ? esc(g.servicio.nombre) : "Bienestar"}</div></td></tr>
<tr><td colspan="2" style="padding:10px 26px 24px;color:#1a140c">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:bottom"><div style="${rot}">Para · De</div><div style="font:18px Georgia,serif">${esc(g.para)} · ${esc(g.de)}</div></td>
<td style="vertical-align:bottom;text-align:right;font:bold 26px Georgia,serif">${g.servicio ? "" : formatPrecio(g.monto)}</td>
</tr></table>
${conCodigo ? `<div style="margin-top:14px;${rot};font-size:13px;letter-spacing:4px;color:#1a140c">${esc(g.codigo)}</div>` : ""}
</td></tr></table>`;
}

export function mailGiftCardPendiente(cfg: Configuracion, g: GiftCardCompleta): Mail {
  const texto = `Hola! Pedí una gift card y quiero abonarla:\n${valorGift(g)}\nPara: ${g.para} · De: ${g.de}\nCódigo de pedido: ${g.codigo}`;
  const wa = cfg.whatsapp ? linkWhatsapp(cfg.whatsapp, texto) : "";
  const html = layout(cfg, "Recibimos tu pedido de gift card", `
${p(`Hola ${esc(g.de.split(" ")[0])}, ¡gracias por regalar bienestar! Para activarla, escribinos por WhatsApp y aboná <strong>${formatPrecio(g.monto)}</strong>.`)}
${tarjetaGift(g, false)}
${p("Cuando confirmemos el pago te mandamos la gift card con su código, lista para regalar.")}
${wa ? boton(wa, "Abonar por WhatsApp") : ""}
${p(`<a href="${linkGift(g)}" style="color:#8a6d3b">Ver mi pedido</a>`)}`);
  return {
    to: g.compradorEmail,
    subject: `Gift card para ${g.para}: falta el pago`,
    html,
    text: [`Recibimos tu pedido de gift card (${valorGift(g)}) para ${g.para}.`, `Para activarla, aboná ${formatPrecio(g.monto)} por WhatsApp${wa ? `: ${wa}` : "."}`, `Ver mi pedido: ${linkGift(g)}`].join("\n"),
  };
}

export function mailGiftCardNuevaProfesional(cfg: Configuracion, g: GiftCardCompleta): Mail {
  const wa = g.compradorTelefono ? linkWhatsapp(g.compradorTelefono) : "";
  const html = layout(cfg, "Nuevo pedido de gift card", `
${p(`<strong>${esc(g.de)}</strong> pidió una gift card de <strong>${esc(valorGift(g))}</strong> (${formatPrecio(g.monto)}) para <strong>${esc(g.para)}</strong>. Te va a escribir por WhatsApp para pagarla.`)}
${p(`Código: <strong>${esc(g.codigo)}</strong><br>✉️ ${esc(g.compradorEmail)}<br>📱 ${wa ? `<a href="${wa}">${esc(g.compradorTelefono)}</a>` : "-"}`)}
${g.mensaje ? p(`<strong>Mensaje:</strong> ${esc(g.mensaje)}`) : ""}
${p("Cuando cobres, entrá al panel → <strong>Gift cards</strong> y tocá <strong>“Pago recibido”</strong>. Ahí se le manda la tarjeta por mail.")}
${boton(`${siteUrl()}/admin/gift-cards`, "Abrir gift cards")}`);
  return {
    to: cfg.emailProfesional,
    subject: `Pedido de gift card: ${valorGift(g)} · de ${g.de} para ${g.para}`,
    html,
    text: `Pedido de gift card ${g.codigo}: ${valorGift(g)} (${formatPrecio(g.monto)}) de ${g.de} (${g.compradorEmail}, ${g.compradorTelefono}) para ${g.para}.\nCuando cobres, marcala como pagada: ${siteUrl()}/admin/gift-cards`,
  };
}

export function mailGiftCardActiva(cfg: Configuracion, g: GiftCardCompleta): Mail {
  const vence = g.venceEn ? fechaHoraLarga(g.venceEn).replace(/, \d\d:\d\d hs$/, "") : "";
  const html = layout(cfg, "¡Tu gift card está lista!", `
${p(`Hola ${esc(g.de.split(" ")[0])}, ya está activa la gift card para <strong>${esc(g.para)}</strong>. Podés reenviarle este mail, mandarle el link o imprimirla.`)}
${tarjetaGift(g, true)}
${g.mensaje ? p(`<em>“${esc(g.mensaje)}”</em>`) : ""}
${p(`<strong>Cómo se usa:</strong> al reservar el turno en ${esc(siteUrl().replace(/^https?:\/\//, ""))}, en “Tus datos” se ingresa el código <strong>${esc(g.codigo)}</strong>.${vence ? ` Vale hasta el <strong>${esc(vence)}</strong>.` : ""}`)}
${boton(linkGift(g), "Ver e imprimir la gift card")}`);
  return {
    to: g.compradorEmail,
    subject: `Gift card para ${g.para} · código ${g.codigo}`,
    html,
    text: [`¡La gift card para ${g.para} está activa!`, `Valor: ${valorGift(g)}`, `Código: ${g.codigo}`, vence ? `Vale hasta el ${vence}.` : "", `Se usa al reservar en ${siteUrl()}/reservar`, `Ver e imprimir: ${linkGift(g)}`].filter(Boolean).join("\n"),
  };
}
