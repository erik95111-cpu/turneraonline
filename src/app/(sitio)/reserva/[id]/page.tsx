import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { mpHabilitado } from "@/lib/mercadopago";
import { procesarPago } from "@/lib/turnos";
import { fechaHoraLarga } from "@/lib/tiempo";
import { formatDuracion, formatPrecio, linkWhatsapp } from "@/lib/formato";
import { BotonCancelar } from "@/components/BotonCancelar";

export const metadata: Metadata = { title: "Mi turno", robots: { index: false } };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; payment_id?: string; collection_id?: string; status?: string }>;
}

export default async function TurnoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;

  let turno = await prisma.turno.findUnique({ where: { id }, include: { servicio: true, clienta: true } });
  if (!turno || !sp.t || turno.token !== sp.t) notFound();

  // Vuelta desde Mercado Pago: verificamos el pago directamente con MP
  const pagoId = sp.payment_id || sp.collection_id;
  if (turno.estado === "PENDIENTE_PAGO" && pagoId && pagoId !== "null" && mpHabilitado()) {
    try {
      await procesarPago(pagoId);
      turno = await prisma.turno.findUniqueOrThrow({ where: { id }, include: { servicio: true, clienta: true } });
    } catch (err) {
      console.error("[reserva] Error verificando pago", err);
    }
  }

  const cfg = await getConfig();
  const vencido = turno.estado === "PENDIENTE_PAGO" && turno.expiraEn && turno.expiraEn < new Date();
  const futuro = turno.inicio > new Date();

  const estados = {
    CONFIRMADO: { icono: "✓", titulo: "¡Turno confirmado!", texto: `Te enviamos los detalles a ${turno.clienta.email}.` },
    PENDIENTE_PAGO: vencido
      ? { icono: "!", titulo: "La reserva venció", texto: "No recibimos el pago de la seña a tiempo y el horario se liberó." }
      : sp.status === "pending" || sp.status === "in_process"
        ? { icono: "…", titulo: "Pago en proceso", texto: "Mercado Pago está procesando tu pago. Te avisamos por mail apenas se acredite." }
        : { icono: "…", titulo: "Falta abonar la seña", texto: "Tu horario queda reservado unos minutos mientras completás el pago." },
    CANCELADO: { icono: "×", titulo: "Turno cancelado", texto: turno.pagoEstado === "approved_sin_lugar"
      ? "Recibimos tu pago pero el horario ya no estaba disponible. Te vamos a contactar para reprogramar o devolverte la seña."
      : "Este turno fue cancelado." },
    COMPLETADO: { icono: "✓", titulo: "Turno realizado", texto: "¡Gracias por tu visita!" },
    AUSENTE: { icono: "!", titulo: "Turno no asistido", texto: "" },
  }[turno.estado];

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-linea bg-carbon p-6 text-center sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/60 font-serif text-3xl text-gold-light">
          {estados.icono}
        </span>
        <h1 className="mt-6 font-serif text-4xl">{estados.titulo}</h1>
        {estados.texto && <p className="mt-3 text-piedra">{estados.texto}</p>}

        <dl className="mt-8 space-y-3 border-y border-linea py-6 text-left text-sm">
          {[
            ["Tratamiento", turno.servicio.nombre],
            ["Fecha", fechaHoraLarga(turno.inicio)],
            ["Duración", formatDuracion(turno.servicio.duracionMin)],
            ["Precio", formatPrecio(turno.precio)],
            ...(turno.montoSena ? [["Seña", formatPrecio(turno.montoSena)]] : []),
            ...(cfg.direccion ? [["Dirección", cfg.direccion]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-piedra">{k}</dt>
              <dd className="text-right first-letter:uppercase">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-col items-center gap-5">
          {(turno.estado === "CANCELADO" || vencido) && <Link href="/reservar" className="btn-oro">Reservar otro turno</Link>}
          {cfg.whatsapp && (
            <a href={linkWhatsapp(cfg.whatsapp, `Hola! Tengo una consulta sobre mi turno de ${turno.servicio.nombre} del ${fechaHoraLarga(turno.inicio)}`)}
              target="_blank" rel="noopener" className="btn-linea">Escribir por WhatsApp</a>
          )}
          {turno.estado === "CONFIRMADO" && futuro && <BotonCancelar turnoId={turno.id} token={turno.token} />}
        </div>
      </div>
    </div>
  );
}
