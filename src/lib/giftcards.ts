import { randomBytes, randomInt } from "node:crypto";
import { addMonths } from "date-fns";
import { Prisma, type GiftCard, type Servicio } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { getConfig } from "./config";
import { enviarMail } from "./email";
import { ErrorReserva } from "./errores";
import { formatPrecio } from "./formato";
import { aFechaUTC, fechaISO, fechaLarga } from "./tiempo";
import { mailGiftCardActiva, mailGiftCardNuevaProfesional, mailGiftCardPendiente } from "./plantillas-email";

type Tx = Prisma.TransactionClient;
export type GiftCardCompleta = GiftCard & { servicio: Servicio | null };
export type EstadoVisible = "PENDIENTE_PAGO" | "ACTIVA" | "VENCIDA" | "USADA" | "ANULADA";

// Sin letras ni números que se confunden al dictarlos (0/O, 1/I/L)
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PREFIJO = "HS-";

export function generarCodigo(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return PREFIJO + c;
}

/** "hs 7k2m9q", "7K2M9Q", "HS-7K2M9Q" → "HS-7K2M9Q" */
export function normalizarCodigo(entrada: string): string {
  const limpio = entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const sinPrefijo = limpio.startsWith("HS") && limpio.length > 6 ? limpio.slice(2) : limpio;
  return sinPrefijo ? PREFIJO + sinPrefijo : "";
}

export function estadoVisible(g: Pick<GiftCard, "estado" | "venceEn">, ahora = new Date()): EstadoVisible {
  if (g.estado === "ACTIVA" && g.venceEn && g.venceEn < ahora) return "VENCIDA";
  return g.estado;
}

/** Hasta el último día de validez inclusive (23:59 hora Argentina) */
export function calcularVencimiento(desde: Date, meses: number): Date {
  const fecha = fechaISO(addMonths(aFechaUTC(fechaISO(desde), "12:00"), Math.max(1, meses)));
  return aFechaUTC(fecha, "23:59");
}

/** Texto corto de lo que vale: "$ 50.000" o "Hidratación intensiva" */
export function valorGiftCard(g: GiftCardCompleta): string {
  return g.servicio ? g.servicio.nombre : formatPrecio(g.monto);
}

export const giftCardSchema = z.object({
  servicioId: z.string().trim().default(""),
  para: z.string().trim().min(2, "Escribí para quién es").max(60),
  de: z.string().trim().min(2, "Escribí de parte de quién").max(60),
  mensaje: z.string().trim().max(200, "El mensaje puede tener hasta 200 letras").default(""),
  email: z.string().trim().toLowerCase().email("Email inválido").max(120),
  telefono: z.string().trim().min(6, "Ingresá un teléfono válido").max(30),
});
export type DatosGiftCard = z.infer<typeof giftCardSchema>;

const incluir = { servicio: true } as const;

/**
 * Pedido de gift card. Desde la web queda esperando el pago (por WhatsApp);
 * desde el panel (venta en persona) queda activa en el momento.
 */
export async function crearGiftCard(datos: DatosGiftCard, opciones: { porAdmin?: boolean } = {}): Promise<GiftCardCompleta> {
  const cfg = await getConfig();
  if (!opciones.porAdmin && !cfg.giftcardsActivas) throw new ErrorReserva("Por el momento no estamos vendiendo gift cards online.");

  let servicio: Servicio | null = null;
  if (datos.servicioId) {
    servicio = await prisma.servicio.findFirst({ where: { id: datos.servicioId, activo: true } });
    if (!servicio) throw new ErrorReserva("El tratamiento elegido no está disponible");
  }
  const monto = servicio ? servicio.precio : cfg.giftcardMonto;
  if (monto <= 0) throw new ErrorReserva("La gift card no tiene un valor configurado");
  const ahora = new Date();

  for (let intento = 0; ; intento++) {
    try {
      const g = await prisma.giftCard.create({
        data: {
          codigo: generarCodigo(),
          token: randomBytes(24).toString("base64url"),
          servicioId: servicio?.id ?? null,
          monto,
          saldo: monto,
          para: datos.para,
          de: datos.de,
          mensaje: datos.mensaje,
          compradorEmail: datos.email,
          compradorTelefono: datos.telefono,
          creadaPorAdmin: Boolean(opciones.porAdmin),
          ...(opciones.porAdmin
            ? { estado: "ACTIVA", activadaEn: ahora, venceEn: calcularVencimiento(ahora, cfg.giftcardMeses) }
            : {}),
        },
        include: incluir,
      });
      if (opciones.porAdmin) await enviarMail(mailGiftCardActiva(cfg, g));
      else await Promise.all([enviarMail(mailGiftCardPendiente(cfg, g)), enviarMail(mailGiftCardNuevaProfesional(cfg, g))]);
      return g;
    } catch (err) {
      // Código repetido (muy improbable): probamos con otro
      const repetido = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!repetido || intento >= 4) throw err;
    }
  }
}

/** La profesional cobró la gift card: queda activa y se le manda por mail a quien la compró */
export async function activarGiftCard(id: string): Promise<void> {
  const cfg = await getConfig();
  const ahora = new Date();
  const r = await prisma.giftCard.updateMany({
    where: { id, estado: "PENDIENTE_PAGO" },
    data: { estado: "ACTIVA", activadaEn: ahora, venceEn: calcularVencimiento(ahora, cfg.giftcardMeses) },
  });
  if (!r.count) throw new ErrorReserva("Esta gift card ya no está esperando el pago");
  const g = await prisma.giftCard.findUniqueOrThrow({ where: { id }, include: incluir });
  await enviarMail(mailGiftCardActiva(cfg, g));
}

export async function anularGiftCard(id: string): Promise<void> {
  const r = await prisma.giftCard.updateMany({
    where: { id, estado: { in: ["PENDIENTE_PAGO", "ACTIVA"] } },
    data: { estado: "ANULADA" },
  });
  if (!r.count) throw new ErrorReserva("Esta gift card ya no se puede anular");
}

type Item = Pick<Servicio, "id" | "precio">;

/** Busca la gift card y explica por qué no sirve para estos tratamientos, si no sirve */
async function validar(db: Tx | typeof prisma, codigo: string, servicioIds: string[], ahora: Date): Promise<GiftCardCompleta> {
  const g = await db.giftCard.findUnique({ where: { codigo: normalizarCodigo(codigo) }, include: incluir });
  if (!g) throw new ErrorReserva("No encontramos una gift card con ese código. Revisalo, por favor.");
  switch (estadoVisible(g, ahora)) {
    case "PENDIENTE_PAGO": throw new ErrorReserva("Esta gift card todavía no está activa: falta confirmar el pago.");
    case "USADA": throw new ErrorReserva("Esta gift card ya fue usada.");
    case "ANULADA": throw new ErrorReserva("Esta gift card fue anulada.");
    case "VENCIDA": throw new ErrorReserva(`Esta gift card venció el ${fechaLarga(g.venceEn!)}.`);
  }
  if (g.servicioId && !servicioIds.includes(g.servicioId)) {
    throw new ErrorReserva(`Esta gift card es para “${g.servicio?.nombre ?? "otro tratamiento"}”. Sumá ese tratamiento para usarla.`);
  }
  return g;
}

/** Cuánto descuenta: la de tratamiento, ese tratamiento; la de monto, hasta su saldo del total */
function aDescontar(g: GiftCard, items: Item[]): number {
  if (g.servicioId) return items.find((s) => s.id === g.servicioId)?.precio ?? 0;
  return Math.min(g.saldo, items.reduce((total, s) => total + s.precio, 0));
}

/** Para mostrar en la reserva antes de confirmar */
export async function consultarGiftCard(codigo: string, servicioIds: string[]): Promise<{ codigo: string; para: string; cubre: number; resta: number }> {
  const servicios = await prisma.servicio.findMany({ where: { id: { in: servicioIds }, activo: true }, select: { id: true, precio: true } });
  if (!servicioIds.length || servicios.length !== servicioIds.length) throw new ErrorReserva("Elegí un tratamiento primero");
  const g = await validar(prisma, codigo, servicioIds, new Date());
  const cubre = aDescontar(g, servicios);
  const total = servicios.reduce((t, s) => t + s.precio, 0);
  return { codigo: g.codigo, para: g.para, cubre, resta: total - cubre };
}

/** Dentro de la transacción de la reserva: descuenta la gift card y devuelve cuánto cubrió */
export async function aplicarGiftCard(tx: Tx, codigo: string, items: Item[]): Promise<{ id: string; monto: number }> {
  const g = await validar(tx, codigo, items.map((s) => s.id), new Date());
  const monto = aDescontar(g, items);
  const saldo = g.servicioId ? 0 : g.saldo - monto;
  // Condicional: si otra reserva la usó en el medio, no la descontamos dos veces
  const r = await tx.giftCard.updateMany({
    where: { id: g.id, estado: "ACTIVA", saldo: g.saldo },
    data: { saldo, estado: saldo > 0 ? "ACTIVA" : "USADA" },
  });
  if (!r.count) throw new ErrorReserva("La gift card cambió recién. Probá de nuevo.");
  return { id: g.id, monto };
}

/** Si se cancela el turno, la gift card recupera lo que se había descontado */
export async function devolverGiftCard(tx: Tx | typeof prisma, giftCardId: string, monto: number): Promise<void> {
  const g = await tx.giftCard.findUnique({ where: { id: giftCardId } });
  if (!g || g.estado === "ANULADA") return;
  await tx.giftCard.update({
    where: { id: g.id },
    data: { estado: "ACTIVA", saldo: g.servicioId ? g.monto : Math.min(g.monto, g.saldo + monto) },
  });
}

/** Mensaje para abrir WhatsApp y pagar la gift card */
export function mensajeGiftCard(g: GiftCardCompleta): string {
  const valor = g.servicio ? `${g.servicio.nombre} (${formatPrecio(g.monto)})` : formatPrecio(g.monto);
  return `Hola! Pedí una gift card y quiero abonarla:\n${valor}\nPara: ${g.para} · De: ${g.de}\nCódigo de pedido: ${g.codigo}`;
}

export function linkGiftCard(base: string, g: Pick<GiftCard, "id" | "token">): string {
  return `${base}/gift-cards/${g.id}?t=${g.token}`;
}
