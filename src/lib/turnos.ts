import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { getConfig } from "./config";
import { calcularSlots } from "./slots";
import { calcularSena } from "./sena";
import { aFechaUTC, diaSemana, fechaISO, sumarDias } from "./tiempo";
import { enviarMail } from "./email";
import { crearPreferenciaSena, mpHabilitado, obtenerPago } from "./mercadopago";
import {
  mailCancelacion,
  mailConfirmacionClienta,
  mailNuevoTurnoProfesional,
  mailPagoSinLugar,
} from "./plantillas-email";

type Tx = Prisma.TransactionClient;

/** Turnos que ocupan agenda: confirmados o pendientes de pago todavía vigentes */
function filtroOcupa(ahora: Date): Prisma.TurnoWhereInput {
  return {
    OR: [
      { estado: { in: ["CONFIRMADO", "COMPLETADO", "AUSENTE"] } },
      { estado: "PENDIENTE_PAGO", expiraEn: { gt: ahora } },
    ],
  };
}

export async function horariosDisponibles(
  servicioId: string,
  fecha: string,
  opciones: { db?: Tx; sinLimites?: boolean } = {},
): Promise<string[]> {
  const db = opciones.db ?? prisma;
  const cfg = await getConfig();
  const ahora = new Date();
  const hoy = fechaISO(ahora);
  // El panel puede reservar sin anticipación mínima ni límite de días
  const maxDias = opciones.sinLimites ? 366 : cfg.diasMaxReserva;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < hoy || fecha > sumarDias(hoy, maxDias)) return [];

  const servicio = await db.servicio.findFirst({ where: { id: servicioId, activo: true } });
  if (!servicio) return [];

  const franjas = await db.horarioAtencion.findMany({ where: { diaSemana: diaSemana(fecha) } });
  if (!franjas.length) return [];

  const desde = aFechaUTC(fecha, "00:00");
  const hasta = aFechaUTC(sumarDias(fecha, 1), "00:00");

  const [turnos, bloqueos] = await Promise.all([
    db.turno.findMany({
      where: {
        inicio: { lt: hasta },
        fin: { gt: desde },
        ...filtroOcupa(ahora),
      },
      select: { inicio: true, fin: true },
    }),
    db.bloqueo.findMany({ where: { desde: { lt: hasta }, hasta: { gt: desde } }, select: { desde: true, hasta: true } }),
  ]);

  return calcularSlots({
    fecha,
    franjas,
    duracionMin: servicio.duracionMin,
    intervaloMin: cfg.intervaloMin,
    ocupados: [...turnos, ...bloqueos.map((b) => ({ inicio: b.desde, fin: b.hasta }))],
    minimoInicio: opciones.sinLimites ? ahora : new Date(ahora.getTime() + cfg.anticipacionMinHoras * 3_600_000),
  });
}

export const reservaSchema = z.object({
  servicioId: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  nombre: z.string().trim().min(2, "Ingresá tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido").max(120),
  telefono: z.string().trim().min(6, "Ingresá un teléfono válido").max(30),
  notas: z.string().trim().max(500).default(""),
});

export type DatosReserva = z.infer<typeof reservaSchema>;

export class ErrorReserva extends Error {}

const incluir = { clienta: true, servicio: true } as const;

/**
 * Crea una reserva. Si hay seña configurada y Mercado Pago activo devuelve
 * el link de pago; si no, el turno queda confirmado y se envían los mails.
 */
export async function crearReserva(
  datos: DatosReserva,
  opciones: { porAdmin?: boolean; sinSena?: boolean } = {},
): Promise<{ turnoId: string; token: string; urlPago?: string }> {
  const cfg = await getConfig();
  const cobrarSena = !opciones.sinSena && mpHabilitado() && cfg.senaTipo !== "NINGUNA";

  const turno = await prisma.$transaction(
    async (tx) => {
      const servicio = await tx.servicio.findFirst({ where: { id: datos.servicioId, activo: true } });
      if (!servicio) throw new ErrorReserva("El tratamiento elegido no está disponible");

      const libres = await horariosDisponibles(servicio.id, datos.fecha, { db: tx, sinLimites: opciones.porAdmin });
      if (!libres.includes(datos.hora)) {
        throw new ErrorReserva("Ese horario ya no está disponible. Elegí otro, por favor.");
      }

      const clienta = await tx.clienta.upsert({
        where: { email: datos.email },
        update: { nombre: datos.nombre, telefono: datos.telefono },
        create: { nombre: datos.nombre, email: datos.email, telefono: datos.telefono },
      });

      const inicio = aFechaUTC(datos.fecha, datos.hora);
      const montoSena = cobrarSena ? calcularSena(servicio.precio, cfg.senaTipo, cfg.senaValor) : 0;
      const pendiente = montoSena > 0;

      return tx.turno.create({
        data: {
          clientaId: clienta.id,
          servicioId: servicio.id,
          inicio,
          fin: new Date(inicio.getTime() + servicio.duracionMin * 60_000),
          precio: servicio.precio,
          montoSena,
          estado: pendiente ? "PENDIENTE_PAGO" : "CONFIRMADO",
          expiraEn: pendiente ? new Date(Date.now() + cfg.minutosParaPagar * 60_000) : null,
          notasClienta: datos.notas,
          creadoPorAdmin: Boolean(opciones.porAdmin),
          token: randomBytes(24).toString("base64url"),
        },
        include: incluir,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ).catch((err) => {
    // Conflicto de concurrencia: dos personas reservando el mismo horario a la vez
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      throw new ErrorReserva("Ese horario se acaba de ocupar. Elegí otro, por favor.");
    }
    throw err;
  });

  if (turno.estado === "CONFIRMADO") {
    await notificarConfirmacion(turno.id);
    return { turnoId: turno.id, token: turno.token };
  }

  try {
    const pref = await crearPreferenciaSena({
      turnoId: turno.id,
      token: turno.token,
      titulo: `Seña · ${turno.servicio.nombre}`,
      monto: turno.montoSena,
      email: turno.clienta.email,
      nombre: turno.clienta.nombre,
      expira: turno.expiraEn!,
    });
    await prisma.turno.update({ where: { id: turno.id }, data: { mpPreferenceId: pref.id } });
    return { turnoId: turno.id, token: turno.token, urlPago: pref.url };
  } catch (err) {
    console.error("[mercadopago] Error creando preferencia", err);
    await prisma.turno.delete({ where: { id: turno.id } });
    throw new ErrorReserva("No pudimos generar el link de pago. Probá de nuevo en unos minutos.");
  }
}

async function notificarConfirmacion(turnoId: string) {
  const [cfg, t] = await Promise.all([
    getConfig(),
    prisma.turno.findUniqueOrThrow({ where: { id: turnoId }, include: incluir }),
  ]);
  await Promise.all([
    enviarMail(mailConfirmacionClienta(cfg, t)),
    enviarMail(mailNuevoTurnoProfesional(cfg, t)),
  ]);
}

/**
 * Consulta un pago en Mercado Pago y, si está aprobado, confirma el turno.
 * Es idempotente: se puede llamar desde el webhook y desde la página de vuelta.
 */
export async function procesarPago(paymentId: string): Promise<void> {
  const pago = await obtenerPago(paymentId);
  if (!pago.turnoId) return;

  const turno = await prisma.turno.findUnique({ where: { id: pago.turnoId }, include: incluir });
  if (!turno || turno.estado !== "PENDIENTE_PAGO") return;

  // El pago tiene que cubrir la seña (evita confirmar con un pago de otro monto)
  if (pago.estado === "approved" && pago.monto + 0.01 < turno.montoSena) {
    console.error(`[mercadopago] Pago ${pago.id} por ${pago.monto} no cubre la seña de ${turno.montoSena}`);
    return;
  }

  if (pago.estado !== "approved") {
    await prisma.turno.update({ where: { id: turno.id }, data: { mpPaymentId: pago.id, pagoEstado: pago.estado } });
    return;
  }

  // Si el pago llegó tarde, verificar que nadie haya tomado el horario
  const conflicto = await prisma.turno.count({
    where: {
      id: { not: turno.id },
      inicio: { lt: turno.fin },
      fin: { gt: turno.inicio },
      ...filtroOcupa(new Date()),
    },
  });
  const bloqueado = await prisma.bloqueo.count({ where: { desde: { lt: turno.fin }, hasta: { gt: turno.inicio } } });

  if (conflicto || bloqueado) {
    const r = await prisma.turno.updateMany({
      where: { id: turno.id, estado: "PENDIENTE_PAGO" },
      data: { estado: "CANCELADO", mpPaymentId: pago.id, pagoEstado: "approved_sin_lugar" },
    });
    if (r.count) await enviarMail(mailPagoSinLugar(await getConfig(), turno));
    return;
  }

  const r = await prisma.turno.updateMany({
    where: { id: turno.id, estado: "PENDIENTE_PAGO" },
    data: { estado: "CONFIRMADO", mpPaymentId: pago.id, pagoEstado: "approved", expiraEn: null },
  });
  if (r.count) await notificarConfirmacion(turno.id);
}

export async function cancelarTurno(turnoId: string, por: "clienta" | "admin"): Promise<void> {
  const cfg = await getConfig();
  const turno = await prisma.turno.findUnique({ where: { id: turnoId }, include: incluir });
  if (!turno || !["CONFIRMADO", "PENDIENTE_PAGO"].includes(turno.estado)) {
    throw new ErrorReserva("Este turno ya no se puede cancelar");
  }
  if (por === "clienta" && turno.estado === "CONFIRMADO") {
    const limite = turno.inicio.getTime() - cfg.horasParaCancelar * 3_600_000;
    if (Date.now() > limite) {
      throw new ErrorReserva(
        `Sólo se puede cancelar online hasta ${cfg.horasParaCancelar} hs antes. Escribinos por WhatsApp.`,
      );
    }
  }
  const eraConfirmado = turno.estado === "CONFIRMADO";
  // Condicional: si justo cambió de estado (ej: se confirmó el pago) no pisamos nada
  const r = await prisma.turno.updateMany({
    where: { id: turno.id, estado: turno.estado },
    data: { estado: "CANCELADO" },
  });
  if (!r.count) throw new ErrorReserva("El turno cambió de estado. Recargá la página.");

  if (eraConfirmado) {
    await Promise.all([
      enviarMail(mailCancelacion(cfg, turno, "clienta")),
      enviarMail(mailCancelacion(cfg, turno, "profesional")),
    ]);
  }
}
