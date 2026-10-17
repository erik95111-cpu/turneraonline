import type { Clienta, Configuracion, Servicio, Turno } from "@prisma/client";
import { formatDuracion, formatPrecio, linkWhatsapp } from "./formato";
import { fechaHoraLarga } from "./tiempo";
import { siteUrl } from "./config";
import type { Mail } from "./email";

type TurnoCompleto = Turno & { clienta: Clienta; servicio: Servicio };

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
${t.montoSena ? fila(t.estado === "PENDIENTE_PAGO" ? "Seña a transferir" : "Seña abonada", formatPrecio(t.montoSena)) : ""}
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
    t.montoSena ? `${t.estado === "PENDIENTE_PAGO" ? "Seña a transferir" : "Seña abonada"}: ${formatPrecio(t.montoSena)}` : "",
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

/** Mensaje que la clienta manda por WhatsApp junto con la captura de la transferencia */
export function mensajeComprobante(t: TurnoCompleto): string {
  return `Hola! Te envío el comprobante de la seña de mi turno:\n${t.servicio.nombre} - ${fechaHoraLarga(t.inicio)}\nA nombre de: ${t.clienta.nombre}`;
}

function datosTransferencia(cfg: Configuracion, t: TurnoCompleto): string {
  const fila = (k: string, v: string) =>
    v ? `<tr><td style="padding:5px 0;color:#888;font:14px Arial,sans-serif;width:120px">${k}</td><td style="padding:5px 0;font:15px Arial,sans-serif"><strong>${esc(v)}</strong></td></tr>` : "";
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 16px;background:#fbf7ef;border-radius:8px;padding:8px 12px">
${fila("Monto", formatPrecio(t.montoSena))}
${fila("Alias", cfg.alias)}
${fila("CBU / CVU", cfg.cbu)}
${fila("Titular", cfg.titularCuenta)}
${fila("Banco", cfg.banco)}
</table>`;
}

export function mailReservaPendienteClienta(cfg: Configuracion, t: TurnoCompleto): Mail {
  const nombre = esc(t.clienta.nombre.split(" ")[0]);
  const limite = t.expiraEn ? fechaHoraLarga(t.expiraEn) : "";
  const wa = cfg.whatsapp ? linkWhatsapp(cfg.whatsapp, mensajeComprobante(t)) : "";
  const html = layout(cfg, "Tu turno está reservado: falta la seña", `
${p(`Hola ${nombre}, te guardamos este horario. Para confirmarlo, transferí la seña y mandanos la captura por WhatsApp.`)}
${detalle(t)}
${p("<strong>Datos para transferir la seña:</strong>")}
${datosTransferencia(cfg, t)}
${limite ? p(`⏰ Tenés tiempo hasta el <strong>${esc(limite)}</strong>. Si no recibimos la seña, el horario se libera.`) : ""}
${wa ? boton(wa, "Enviar comprobante por WhatsApp") : ""}
${p(`<a href="${linkTurno(t)}" style="color:#8a6d3b">Ver mi reserva</a>`)}`);
  return {
    to: t.clienta.email,
    subject: `Reserva pendiente de seña · ${t.servicio.nombre} · ${fechaHoraLarga(t.inicio)}`,
    html,
    text: [
      `Hola ${t.clienta.nombre}, te guardamos este horario. Para confirmarlo, transferí la seña y mandanos la captura por WhatsApp.`,
      "",
      textoPlano(t),
      "",
      `Alias: ${cfg.alias || "-"}`,
      `CBU/CVU: ${cfg.cbu || "-"}`,
      `Titular: ${cfg.titularCuenta || "-"}`,
      cfg.banco ? `Banco: ${cfg.banco}` : "",
      limite ? `Tenés tiempo hasta el ${limite}.` : "",
      wa ? `Enviar comprobante: ${wa}` : "",
      `Ver mi reserva: ${linkTurno(t)}`,
    ].filter(Boolean).join("\n"),
  };
}

export function mailNuevaReservaProfesional(cfg: Configuracion, t: TurnoCompleto): Mail {
  const wa = t.clienta.telefono ? linkWhatsapp(t.clienta.telefono) : "";
  const html = layout(cfg, "Nueva reserva: esperando la seña", `
${p(`<strong>${esc(t.clienta.nombre)}</strong> reservó un turno y tiene que mandarte el comprobante de la seña por WhatsApp.`)}
${detalle(t)}
${p(`✉️ ${esc(t.clienta.email)}<br>📱 ${wa ? `<a href="${wa}">${esc(t.clienta.telefono)}</a>` : "-"}`)}
${t.notasClienta ? p(`<strong>Comentario:</strong> ${esc(t.notasClienta)}`) : ""}
${p("Cuando te llegue la captura, entrá al panel y tocá <strong>“Seña recibida”</strong> para confirmar el turno.")}
${boton(`${siteUrl()}/admin`, "Abrir la agenda")}`);
  return {
    to: cfg.emailProfesional,
    subject: `Nueva reserva (esperando seña): ${t.clienta.nombre} · ${t.servicio.nombre} · ${fechaHoraLarga(t.inicio)}`,
    html,
    text: `Nueva reserva de ${t.clienta.nombre} (${t.clienta.email}, ${t.clienta.telefono}) esperando la seña.\n\n${textoPlano(t)}\n\nCuando llegue el comprobante, confirmala desde el panel: ${siteUrl()}/admin`,
  };
}
