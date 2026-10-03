"use server";

import { prisma } from "@/lib/db";
import { ErrorReserva, cancelarTurno, crearReserva, reservaSchema } from "@/lib/turnos";
import { revalidatePath } from "next/cache";

export type ResultadoReserva = { ok: true; url: string } | { ok: false; error: string };

export async function reservarTurno(input: unknown, honeypot?: string): Promise<ResultadoReserva> {
  if (honeypot) return { ok: false, error: "No se pudo procesar la reserva" };
  const parsed = reservaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const r = await crearReserva(parsed.data);
    return { ok: true, url: r.urlPago ?? `/reserva/${r.turnoId}?t=${r.token}` };
  } catch (err) {
    if (err instanceof ErrorReserva) return { ok: false, error: err.message };
    console.error("[reserva]", err);
    return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo o escribinos por WhatsApp." };
  }
}

export async function cancelarPorClienta(turnoId: string, token: string): Promise<{ error?: string }> {
  const turno = await prisma.turno.findUnique({ where: { id: turnoId }, select: { token: true } });
  if (!turno || turno.token !== token) return { error: "Turno no encontrado" };
  try {
    await cancelarTurno(turnoId, "clienta");
  } catch (err) {
    if (err instanceof ErrorReserva) return { error: err.message };
    throw err;
  }
  revalidatePath(`/reserva/${turnoId}`);
  return {};
}
