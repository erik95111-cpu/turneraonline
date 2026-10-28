"use server";

/**
 * Acciones que la CLIENTA dispara desde la web pública (reservar y cancelar).
 * Corren en el servidor; el navegador sólo recibe { ok, url } o { error }.
 * Nunca devuelven detalles internos: los errores técnicos quedan en el log.
 */
import { prisma } from "@/lib/db";
import { ErrorReserva, cancelarTurno, crearReserva, reservaSchema } from "@/lib/turnos";
import { igualesSeguro } from "@/lib/passwords";
import { logError } from "@/lib/log";
import { revalidatePath } from "next/cache";

export type ResultadoReserva = { ok: true; url: string } | { ok: false; error: string };

const ERROR_GENERICO = "Ocurrió un error inesperado. Probá de nuevo o escribinos por WhatsApp.";

export async function reservarTurno(input: unknown, honeypot?: string): Promise<ResultadoReserva> {
  // Campo trampa: las personas no lo ven, los bots lo completan
  if (honeypot) return { ok: false, error: "No se pudo procesar la reserva" };
  const parsed = reservaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const r = await crearReserva(parsed.data);
    return { ok: true, url: `/reserva/${r.turnoId}?t=${r.token}` };
  } catch (err) {
    if (err instanceof ErrorReserva) return { ok: false, error: err.message };
    logError("reserva", err); // [LIB:prisma] = base de datos · [APP] = nuestro código
    return { ok: false, error: ERROR_GENERICO };
  }
}

export async function cancelarPorClienta(turnoId: string, token: string): Promise<{ error?: string }> {
  try {
    const turno = await prisma.turno.findUnique({ where: { id: String(turnoId) }, select: { token: true } });
    // El token secreto del mail es la "llave" del turno. Se compara en tiempo constante.
    if (!turno || !igualesSeguro(turno.token, String(token))) return { error: "Turno no encontrado" };
    await cancelarTurno(turnoId, "clienta");
  } catch (err) {
    if (err instanceof ErrorReserva) return { error: err.message };
    logError("cancelación por clienta", err);
    return { error: ERROR_GENERICO };
  }
  revalidatePath(`/reserva/${turnoId}`);
  return {};
}
