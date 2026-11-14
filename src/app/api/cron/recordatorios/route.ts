import { NextResponse } from "next/server";
import { recordatoriosAutomaticos } from "@/lib/recordatorios";

/**
 * Recordatorio automático por mail de los turnos de MAÑANA (hora Argentina).
 * Vercel Cron lo llama una vez por día (ver vercel.json); el de WhatsApp lo manda
 * la profesional desde la Agenda del panel.
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(await recordatoriosAutomaticos());
}
