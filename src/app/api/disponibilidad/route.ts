/**
 * GET /api/disponibilidad?servicio=…&fecha=AAAA-MM-DD
 * Devuelve los horarios libres de un día. Lo usa el calendario de reservas.
 * Sólo expone horarios ("10:00", "10:30"…), nunca datos de otras clientas.
 */
import { NextResponse } from "next/server";
import { horariosDisponibles } from "@/lib/turnos";
import { getSesion } from "@/lib/auth";
import { logError } from "@/lib/log";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const servicio = searchParams.get("servicio") ?? "";
  const fecha = searchParams.get("fecha") ?? "";
  try {
    // panel=1 (sin límite de días) sólo vale si quien pregunta tiene sesión en el panel
    const sinLimites = searchParams.get("panel") === "1" && Boolean(await getSesion());
    const horarios = await horariosDisponibles(servicio, fecha, { sinLimites });
    return NextResponse.json({ horarios }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // Fallback: el calendario muestra "No pudimos cargar los horarios · Reintentar"
    logError("disponibilidad", err);
    return NextResponse.json({ error: "No disponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
