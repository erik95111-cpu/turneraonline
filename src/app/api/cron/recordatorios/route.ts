import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { enviarMail } from "@/lib/email";
import { mailRecordatorio } from "@/lib/plantillas-email";
import { aFechaUTC, fechaISO, sumarDias } from "@/lib/tiempo";

/**
 * Envía por mail el recordatorio de los turnos de MAÑANA (hora Argentina) a quien tiene
 * mail. El de WhatsApp lo manda la profesional con un toque desde la Agenda del panel.
 * Vercel Cron lo llama una vez por día (ver vercel.json).
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const manana = sumarDias(fechaISO(new Date()), 1);
  const turnos = await prisma.turno.findMany({
    where: {
      estado: "CONFIRMADO",
      inicio: { gte: aFechaUTC(manana, "00:00"), lt: aFechaUTC(sumarDias(manana, 1), "00:00") },
      recordatorioEnviado: false,
      avisarMail: true,
      clienta: { email: { not: null } },
    },
    include: { clienta: true, servicio: { include: { incluye: { select: { nombre: true } } } }, giftCard: true },
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
