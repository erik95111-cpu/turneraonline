import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { getConfig } from "./config";
import { calcularSlots } from "./slots";
import { calcularSena, pideSena } from "./sena";
import { aFechaUTC, diaSemana, fechaISO, sumarDias } from "./tiempo";
import { enviarMail } from "./email";
import {
  mailCancelacion,
  mailConfirmacionClienta,
  mailNuevaReservaProfesional,
  mailNuevoTurnoProfesional,
  mailReservaPendienteClienta,
} from "./plantillas-email";

type Tx = Prisma.TransactionClient;

/** Errores de concurrencia de Postgres/Prisma que se resuelven reintentando */
function esConflicto(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2034" || err.code === "P2002");
}

/**
 * Corre una transacción SERIALIZABLE y la reintenta si choca con otra.
 * En el reintento se ve lo que la otra ya guardó (ej: el horario ocupado).
 */
async function transaccion<T>(fn: (tx: Tx) => Promise<T>, intentos = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      if (!esConflicto(err) || i >= intentos) throw err;
      await new Promise((r) => setTimeout(r, 20 * i + Math.random() * 50));
    }
  }
}

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

/**
 * Para el calendario: cuántos horarios libres quedan en cada día de atención del mes.
 * Sólo incluye días en los que se atiende y que están dentro del rango reservable.
 */
export async function disponibilidadDelMes(
  servicioId: string,
  mes: string,
  opciones: { sinLimites?: boolean } = {},
): Promise<Record<string, number>> {
  if (!/^\d{4}-\d{2}$/.test(mes)) return {};
  const [y, m] = mes.split("-").map(Number);
  const diasDelMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const franjas = await prisma.horarioAtencion.findMany({ select: { diaSemana: true } });
  const abiertos = new Set(franjas.map((f) => f.diaSemana));
  const fechas = Array.from({ length: diasDelMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)
    .filter((f) => abiertos.has(diaSemana(f)));
  const resultado: Record<string, number> = {};
  for (const f of fechas) {
    const hoy = fechaISO(new Date());
    if (f < hoy) continue;
    const libres = await horariosDisponibles(servicioId, f, opciones);
    // horariosDisponibles devuelve [] también fuera de rango: lo distinguimos
    if (libres.length || (await dentroDeRango(f, opciones.sinLimites))) resultado[f] = libres.length;
  }
  return resultado;
}

async function dentroDeRango(fecha: string, sinLimites?: boolean): Promise<boolean> {
  const cfg = await getConfig();
  const hoy = fechaISO(new Date());
  return fecha >= hoy && fecha <= sumarDias(hoy, sinLimites ? 366 : cfg.diasMaxReserva);
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
 * Crea una reserva. Si hay seña configurada, el turno queda apartado hasta que
 * la clienta la abone por WhatsApp; si no, queda confirmado.
 */
export async function crearReserva(
  datos: DatosReserva,
  opciones: { porAdmin?: boolean; sinSena?: boolean } = {},
): Promise<{ turnoId: string; token: string; pendienteSena: boolean }> {
  const cfg = await getConfig();
  const cobrarSena = !opciones.sinSena && pideSena(cfg);

  const turno = await transaccion(async (tx) => {
      const servicio = await tx.servicio.findFirst({ where: { id: datos.servicioId, activo: true } });
      if (!servicio) throw new ErrorReserva("El tratamiento elegido no está disponible");

      const libres = await horariosDisponibles(servicio.id, datos.fecha, { db: tx, sinLimites: opciones.porAdmin });
      if (!libres.includes(datos.hora)) {
        throw new ErrorReserva("Ese horario ya no está disponible. Elegí otro, por favor.");
      }

      // Si la clienta ya existe no pisamos su ficha (nombre/teléfono los edita la profesional)
      const clienta = await tx.clienta.upsert({
        where: { email: datos.email },
        update: {},
        create: { nombre: datos.nombre, email: datos.email, telefono: datos.telefono },
      });

      const inicio = aFechaUTC(datos.fecha, datos.hora);
      const montoSena = cobrarSena ? calcularSena(servicio.precio, cfg.senaTipo, cfg.senaValor) : 0;
      const pendiente = montoSena > 0;
      // El horario queda apartado hasta que llegue la seña (nunca más allá del turno)
      const limite = Math.min(Date.now() + Math.max(1, cfg.horasParaSena) * 3_600_000, inicio.getTime());

      return tx.turno.create({
        data: {
          clientaId: clienta.id,
          servicioId: servicio.id,
          inicio,
          fin: new Date(inicio.getTime() + servicio.duracionMin * 60_000),
          precio: servicio.precio,
          montoSena,
          estado: pendiente ? "PENDIENTE_PAGO" : "CONFIRMADO",
          expiraEn: pendiente ? new Date(limite) : null,
          notasClienta: datos.notas,
          creadoPorAdmin: Boolean(opciones.porAdmin),
          token: randomBytes(24).toString("base64url"),
        },
        include: incluir,
      });
  }).catch((err) => {
    // Muchísima concurrencia: después de varios reintentos pedimos que pruebe de nuevo
    if (esConflicto(err)) throw new ErrorReserva("Hay mucha demanda en este momento. Probá de nuevo en unos segundos.");
    throw err;
  });

  const pendienteSena = turno.estado === "PENDIENTE_PAGO";
  const cfgActual = await getConfig();
  await Promise.all(
    pendienteSena
      ? [enviarMail(mailReservaPendienteClienta(cfgActual, turno)), enviarMail(mailNuevaReservaProfesional(cfgActual, turno))]
      : [enviarMail(mailConfirmacionClienta(cfgActual, turno)), enviarMail(mailNuevoTurnoProfesional(cfgActual, turno))],
  );
  return { turnoId: turno.id, token: turno.token, pendienteSena };
}

/**
 * La profesional confirma que recibió la seña (coordinada por WhatsApp).
 * Si la reserva ya había vencido, sólo se confirma si el horario sigue libre.
 */
export async function confirmarSena(turnoId: string): Promise<void> {
  const turno = await transaccion(async (tx) => {
    const t = await tx.turno.findUnique({ where: { id: turnoId } });
    if (!t || t.estado !== "PENDIENTE_PAGO") throw new ErrorReserva("Este turno ya no está esperando la seña");

    const choque =
      (await tx.turno.count({
        where: { id: { not: t.id }, inicio: { lt: t.fin }, fin: { gt: t.inicio }, ...filtroOcupa(new Date()) },
      })) +
      (await tx.bloqueo.count({ where: { desde: { lt: t.fin }, hasta: { gt: t.inicio } } }));
    if (choque) {
      throw new ErrorReserva("No se puede confirmar: la reserva había vencido y ese horario ya está ocupado. Coordiná otro horario con la clienta.");
    }

    return tx.turno.update({
      where: { id: t.id },
      data: { estado: "CONFIRMADO", pagoEstado: "transferencia", expiraEn: null },
      include: incluir,
    });
  });
  await enviarMail(mailConfirmacionClienta(await getConfig(), turno));
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
