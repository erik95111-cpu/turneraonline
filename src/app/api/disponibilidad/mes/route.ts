import { NextResponse } from "next/server";
import { disponibilidadDelMes } from "@/lib/turnos";
import { getSesion } from "@/lib/auth";
import { listaIds } from "@/lib/tratamientos";

/** GET /api/disponibilidad/mes?servicio=a,b&mes=2026-10 → { dias: { "2026-10-31": 7, … } } */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const servicio = searchParams.get("servicio") ?? "";
  const mes = searchParams.get("mes") ?? "";
  const sinLimites = searchParams.get("panel") === "1" && Boolean(await getSesion());
  const dias = await disponibilidadDelMes(listaIds(servicio), mes, { sinLimites });
  return NextResponse.json({ dias }, { headers: { "Cache-Control": "no-store" } });
}
