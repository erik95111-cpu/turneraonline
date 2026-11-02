import ExcelJS from "exceljs";
import { formatInTimeZone } from "date-fns-tz";
import type { EstadoTurno, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getConfig } from "./config";
import { TZ, aFechaUTC, fechaISO, sumarDias } from "./tiempo";

/** Reportes en Excel, con las mismas columnas que exportaba el sistema anterior */

const dia = (d: Date) => formatInTimeZone(d, TZ, "dd/MM/yyyy");
const hora = (d: Date) => formatInTimeZone(d, TZ, "HH:mm");
const fechaIsoADia = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");

export interface Rango { desde: string; hasta: string }

/** Rango por defecto: los últimos 30 días hasta dentro de 30 días */
export function rangoPorDefecto(): Rango {
  const hoy = fechaISO(new Date());
  return { desde: sumarDias(hoy, -30), hasta: sumarDias(hoy, 30) };
}

export function leerRango(sp: URLSearchParams): Rango {
  const def = rangoPorDefecto();
  const ok = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return { desde: ok(sp.get("desde")) ?? def.desde, hasta: ok(sp.get("hasta")) ?? def.hasta };
}

const enRango = (r: Rango) => ({ gte: aFechaUTC(r.desde, "00:00"), lt: aFechaUTC(sumarDias(r.hasta, 1), "00:00") });

function nuevoLibro() {
  const libro = new ExcelJS.Workbook();
  libro.creator = "MC Healthy Skin";
  libro.created = new Date();
  return libro;
}

/** Hoja con encabezado en negrita, filtros y columnas a medida */
function hoja(libro: ExcelJS.Workbook, nombre: string, columnas: { titulo: string; ancho: number; pesos?: boolean }[], filas: (string | number)[][]) {
  const h = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  h.columns = columnas.map((c) => ({ header: c.titulo, width: c.ancho, style: c.pesos ? { numFmt: '"$"#,##0' } : {} }));
  h.addRows(filas);
  const encabezado = h.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFE6CF9F" } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B0A0C" } };
  h.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  return h;
}

function hojaFiltros(libro: ExcelJS.Workbook, lineas: string[]) {
  const h = libro.addWorksheet("Filtros");
  h.getColumn(1).width = 60;
  lineas.forEach((l, i) => {
    h.addRow([l]);
    if (i === 0) h.getRow(1).font = { bold: true };
  });
}

const buffer = async (libro: ExcelJS.Workbook) => Buffer.from(await libro.xlsx.writeBuffer());

// ─── Clientes ──────────────────────────────────────────────

const OCUPA: EstadoTurno[] = ["CONFIRMADO", "COMPLETADO"];

export async function reporteClientas(filtro: { q?: string; etiqueta?: string } = {}): Promise<Buffer> {
  const q = filtro.q?.trim() ?? "";
  const where: Prisma.ClientaWhereInput = {
    AND: [
      q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { telefono: { contains: q } }] } : {},
      filtro.etiqueta ? { etiquetas: { has: filtro.etiqueta } } : {},
    ],
  };
  const clientas = await prisma.clienta.findMany({
    where,
    include: { turnos: { where: { estado: { in: OCUPA } }, select: { inicio: true, precio: true }, orderBy: { inicio: "asc" } } },
    orderBy: { nombre: "asc" },
  });

  const libro = nuevoLibro();
  hoja(
    libro,
    "Clientes",
    [
      { titulo: "Nombre", ancho: 16 }, { titulo: "Apellido", ancho: 18 }, { titulo: "Email", ancho: 30 }, { titulo: "Teléfono", ancho: 18 },
      { titulo: "Dirección", ancho: 26 }, { titulo: "Fecha de nacimiento", ancho: 18 }, { titulo: "Estado", ancho: 12 }, { titulo: "Etiquetas", ancho: 24 },
      { titulo: "Primera visita", ancho: 14 }, { titulo: "Última visita", ancho: 14 }, { titulo: "Total visitas", ancho: 12 },
      { titulo: "Total gastado", ancho: 14, pesos: true }, { titulo: "Adeuda", ancho: 10 },
    ],
    clientas.map((c) => {
      const [nombre, ...apellido] = c.nombre.trim().split(/\s+/);
      const visitas = c.turnos;
      return [
        nombre, apellido.join(" "), c.email ?? "", c.telefono, c.direccion, fechaIsoADia(c.fechaNacimiento),
        visitas.length > 1 ? "Recurrente" : "Nuevo", c.etiquetas.join(", "),
        visitas[0] ? dia(visitas[0].inicio) : "", visitas.at(-1) ? dia(visitas.at(-1)!.inicio) : "",
        visitas.length, visitas.reduce((t, v) => t + v.precio, 0), c.etiquetas.includes("Adeuda") ? "Sí" : "",
      ];
    }),
  );
  hojaFiltros(libro, [
    filtro.etiqueta ? `Clientas con la etiqueta “${filtro.etiqueta}”` : "Todas las clientas",
    `${clientas.length} clientas · exportado el ${dia(new Date())}`,
    q ? `Búsqueda: “${q}”` : filtro.etiqueta ? "" : "Sin filtros: toda la base",
    "Visitas y total gastado: turnos confirmados y realizados.",
  ].filter(Boolean));
  return buffer(libro);
}

// ─── Reservas (turnos) ─────────────────────────────────────

const ESTADO_RESERVA: Record<EstadoTurno, string> = {
  PENDIENTE_PAGO: "Esperando seña",
  CONFIRMADO: "Confirmada",
  COMPLETADO: "Realizada",
  AUSENTE: "No vino",
  CANCELADO: "Cancelada",
};

export async function reporteReservas(r: Rango): Promise<Buffer> {
  const [cfg, turnos] = await Promise.all([
    getConfig(),
    prisma.turno.findMany({ where: { inicio: enRango(r) }, include: { clienta: true, servicio: true }, orderBy: { inicio: "desc" } }),
  ]);
  const ahora = new Date();
  const libro = nuevoLibro();
  hoja(
    libro,
    "Reservas",
    [
      { titulo: "Fecha turno", ancho: 12 }, { titulo: "Hora turno", ancho: 10 }, { titulo: "Cliente", ancho: 24 }, { titulo: "Email", ancho: 30 },
      { titulo: "Teléfono", ancho: 18 }, { titulo: "Fecha reserva", ancho: 13 }, { titulo: "Hora reserva", ancho: 12 }, { titulo: "Servicio", ancho: 40 },
      { titulo: "Precio", ancho: 12, pesos: true }, { titulo: "Profesional", ancho: 18 }, { titulo: "Origen", ancho: 10 }, { titulo: "Estado", ancho: 16 },
    ],
    turnos.map((t) => [
      dia(t.inicio), hora(t.inicio), t.clienta.nombre, t.clienta.email ?? "", t.clienta.telefono, dia(t.createdAt), hora(t.createdAt),
      t.servicio.nombre, t.precio, cfg.nombreProfesional || cfg.nombreNegocio, t.creadoPorAdmin ? "Panel" : "Web",
      t.estado === "PENDIENTE_PAGO" && t.expiraEn && t.expiraEn < ahora ? "Vencida (sin seña)" : ESTADO_RESERVA[t.estado],
    ]),
  );
  hojaFiltros(libro, [`Turnos del ${fechaIsoADia(r.desde)} al ${fechaIsoADia(r.hasta)}`, `${turnos.length} turnos · exportado el ${dia(ahora)}`]);
  return buffer(libro);
}

// ─── Transacciones (cobros) ────────────────────────────────

/**
 * Cobros: cada turno (no cancelado) y cada gift card vendida. “Pago pendiente” es lo que
 * falta cobrar en la sesión (precio menos seña y gift card); un turno realizado se toma como pagado.
 */
export async function reporteTransacciones(r: Rango): Promise<Buffer> {
  const ahora = new Date();
  const [turnos, giftCards] = await Promise.all([
    prisma.turno.findMany({
      where: { createdAt: enRango(r), estado: { not: "CANCELADO" } },
      include: { clienta: true, servicio: true, giftCard: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.giftCard.findMany({
      where: { activadaEn: enRango(r), estado: { not: "ANULADA" } },
      include: { servicio: true },
      orderBy: { activadaEn: "desc" },
    }),
  ]);

  const filas: { cuando: Date; fila: (string | number)[] }[] = [];
  for (const t of turnos) {
    if (t.estado === "PENDIENTE_PAGO" && t.expiraEn && t.expiraEn < ahora) continue; // reservas vencidas: no hubo cobro
    const pendiente = t.estado === "COMPLETADO" ? 0 : Math.max(0, t.precio - (t.estado === "PENDIENTE_PAGO" ? 0 : t.montoSena) - t.montoGiftCard);
    const estado = t.estado === "PENDIENTE_PAGO" ? "Esperando seña" : t.estado === "AUSENTE" ? "No vino" : pendiente > 0 ? "Saldo pendiente de pago" : "Pagado";
    filas.push({
      cuando: t.createdAt,
      fila: [
        dia(t.createdAt), hora(t.createdAt), t.clienta.nombre, t.clienta.email ?? "", t.clienta.telefono,
        t.servicio.esCombo ? "Combo" : "Servicio", t.servicio.nombre,
        t.giftCard ? `Gift card ${t.giftCard.codigo} (-$${t.montoGiftCard.toLocaleString("es-AR")})` : "-",
        t.precio, t.montoSena && t.estado !== "PENDIENTE_PAGO" ? t.montoSena : 0, pendiente, estado,
      ],
    });
  }
  for (const g of giftCards) {
    filas.push({
      cuando: g.activadaEn!,
      fila: [
        dia(g.activadaEn!), hora(g.activadaEn!), g.de, g.compradorEmail, g.compradorTelefono, "Gift card",
        `${g.servicio ? g.servicio.nombre : "Monto"} · para ${g.para} · ${g.codigo}`, "-", g.monto, 0, 0, "Pagado",
      ],
    });
  }
  filas.sort((a, b) => b.cuando.getTime() - a.cuando.getTime());

  const libro = nuevoLibro();
  hoja(
    libro,
    "Transacciones",
    [
      { titulo: "Fecha compra", ancho: 13 }, { titulo: "Hora", ancho: 8 }, { titulo: "Cliente", ancho: 24 }, { titulo: "Email", ancho: 30 },
      { titulo: "Teléfono", ancho: 18 }, { titulo: "Tipo", ancho: 11 }, { titulo: "Descripcion", ancho: 42 }, { titulo: "Descuento aplicado", ancho: 28 },
      { titulo: "Monto total", ancho: 13, pesos: true }, { titulo: "Seña cobrada", ancho: 13, pesos: true },
      { titulo: "Pago pendiente", ancho: 14, pesos: true }, { titulo: "Estado", ancho: 22 },
    ],
    filas.map((f) => f.fila),
  );
  hojaFiltros(libro, [
    `Movimientos del ${fechaIsoADia(r.desde)} al ${fechaIsoADia(r.hasta)} (por fecha de compra)`,
    `${filas.length} movimientos · exportado el ${dia(ahora)}`,
    "Pago pendiente: lo que falta cobrar en la sesión. Un turno marcado como realizado se toma como pagado.",
  ]);
  return buffer(libro);
}
