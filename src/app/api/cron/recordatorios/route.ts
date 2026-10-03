import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { enviarMail } from "@/lib/email";
import { mailRecordatorio } from "@/lib/plantillas-email";

/**
 * Envía recordatorio por mail de los turnos de las próximas ~36 hs.
 * Vercel Cron lo llama una vez por día (ver vercel.json).
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ahora = Date.now();
  const turnos = await prisma.turno.findMany({
    where: {
      estado: "CONFIRMADO",
      recordatorioEnviado: false,
      inicio: { gt: new Date(ahora + 2 * 3_600_000), lt: new Date(ahora + 36 * 3_600_000) },
    },
    include: { clienta: true, servicio: true },
  });

  const cfg = await getConfig();
  let enviados = 0;
  for (const t of turnos) {
    if (await enviarMail(mailRecordatorio(cfg, t))) {
      await prisma.turno.update({ where: { id: t.id }, data: { recordatorioEnviado: true } });
      enviados++;
    }
  }
  return NextResponse.json({ revisados: turnos.length, enviados });
}
