import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { enviarMail } from "@/lib/email";
import { mailRecordatorio } from "@/lib/plantillas-email";
import { logError } from "@/lib/log";
import { igualesSeguro } from "@/lib/passwords";
import { aFechaUTC, fechaISO, sumarDias } from "@/lib/tiempo";

/**
 * Envía recordatorio por mail de los turnos de MAÑANA (hora Argentina).
 * Vercel Cron lo llama una vez por día (ver vercel.json).
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  // Sólo Vercel Cron conoce CRON_SECRET. Comparación en tiempo constante.
  if (!secreto || !igualesSeguro(req.headers.get("authorization") ?? "", `Bearer ${secreto}`)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const manana = sumarDias(fechaISO(new Date()), 1);
  const turnos = await prisma.turno.findMany({
    where: {
      estado: "CONFIRMADO",
      recordatorioEnviado: false,
      inicio: { gte: aFechaUTC(manana, "00:00"), lt: aFechaUTC(sumarDias(manana, 1), "00:00") },
    },
    include: { clienta: true, servicio: true },
  });

  const cfg = await getConfig();
  let enviados = 0;
  let fallidos = 0;
  for (const t of turnos) {
    // Fallback: si falla el recordatorio de una clienta, seguimos con las demás
    try {
      if (await enviarMail(mailRecordatorio(cfg, t))) {
        await prisma.turno.update({ where: { id: t.id }, data: { recordatorioEnviado: true } });
        enviados++;
      } else fallidos++;
    } catch (err) {
      logError(`recordatorio ${t.id}`, err);
      fallidos++;
    }
  }
  return NextResponse.json({ revisados: turnos.length, enviados, fallidos });
}
