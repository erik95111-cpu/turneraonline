import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { horariosDisponibles } from "@/lib/turnos";
import { COOKIE_ADMIN, tokenValido } from "@/lib/token";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const servicio = searchParams.get("servicio") ?? "";
  const fecha = searchParams.get("fecha") ?? "";
  const sinLimites =
    searchParams.get("panel") === "1" && (await tokenValido((await cookies()).get(COOKIE_ADMIN)?.value));
  const horarios = await horariosDisponibles(servicio, fecha, { sinLimites });
  return NextResponse.json({ horarios }, { headers: { "Cache-Control": "no-store" } });
}
