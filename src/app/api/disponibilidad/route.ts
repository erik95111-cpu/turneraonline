import { NextResponse } from "next/server";
import { horariosDisponibles } from "@/lib/turnos";
import { getSesion } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const servicio = searchParams.get("servicio") ?? "";
  const fecha = searchParams.get("fecha") ?? "";
  const sinLimites =
    searchParams.get("panel") === "1" && Boolean(await getSesion());
  const horarios = await horariosDisponibles(servicio, fecha, { sinLimites });
  return NextResponse.json({ horarios }, { headers: { "Cache-Control": "no-store" } });
}
