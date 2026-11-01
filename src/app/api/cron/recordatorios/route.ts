import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { enviarMail } from "@/lib/email";
import { mailRecordatorio } from "@/lib/plantillas-email";
import { enviarWhatsappAutomatico, whatsappAutomatico } from "@/lib/whatsapp";
import { aFechaUTC, fechaISO, sumarDias } from "@/lib/tiempo";

/**
 * Envía el recordatorio de los turnos de MAÑANA (hora Argentina): por mail a quien
 * tiene mail y, si está configurada la API de WhatsApp, también por WhatsApp.
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
      // Falta el mail o falta el WhatsApp (cuando está la API para mandarlo solo)
      OR: [
        { recordatorioEnviado: false, avisarMail: true, clienta: { email: { not: null } } },
        ...(whatsappAutomatico() ? [{ recordatorioWaEn: null, avisarWhatsapp: true }] : []),
      ],
    },
    include: { clienta: true, servicio: { include: { incluye: { select: { nombre: true } } } }, giftCard: true },
  });

  const cfg = await getConfig();
  let mails = 0;
  let whatsapps = 0;
  for (const t of turnos) {
    if (!t.recordatorioEnviado && t.avisarMail && t.clienta.email && (await enviarMail(mailRecordatorio(cfg, t)))) {
      await prisma.turno.update({ where: { id: t.id }, data: { recordatorioEnviado: true } });
      mails++;
    }
    // Sin API de WhatsApp, el recordatorio se manda con un toque desde la Agenda del panel
    if (!t.recordatorioWaEn && t.avisarWhatsapp && (await enviarWhatsappAutomatico(cfg, t, "recordatorio"))) {
      await prisma.turno.update({ where: { id: t.id }, data: { recordatorioWaEn: new Date() } });
      whatsapps++;
    }
  }
  return NextResponse.json({ revisados: turnos.length, mails, whatsapps });
}
