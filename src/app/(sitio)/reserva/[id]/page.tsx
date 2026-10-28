import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { fechaHoraLarga } from "@/lib/tiempo";
import { formatDuracion, formatPrecio, linkWhatsapp } from "@/lib/formato";
import { mensajeSena } from "@/lib/plantillas-email";
import { duracionTurnoMin, nombreTratamientos } from "@/lib/tratamientos";
import { BotonCancelar } from "@/components/BotonCancelar";
import { IrAWhatsapp } from "@/components/IrAWhatsapp";

export const metadata: Metadata = { title: "Mi turno", robots: { index: false } };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; nuevo?: string }>;
}

export default async function TurnoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t: token, nuevo } = await searchParams;

  const turno = await prisma.turno.findUnique({ where: { id }, include: { servicio: true, clienta: true, giftCard: true, tratamientos: { orderBy: { orden: "asc" as const } } } });
  if (!turno || !token || turno.token !== token) notFound();

  const cfg = await getConfig();
  const ahora = new Date();
  const pendiente = turno.estado === "PENDIENTE_PAGO";
  const vencido = pendiente && turno.expiraEn !== null && turno.expiraEn < ahora;
  const futuro = turno.inicio > ahora;

  const estados = {
    CONFIRMADO: { icono: "✓", titulo: "¡Turno confirmado!", texto: `Te enviamos los detalles a ${turno.clienta.email}.` },
    PENDIENTE_PAGO: vencido
      ? { icono: "!", titulo: "La reserva venció", texto: "No se abonó la seña a tiempo y el horario se liberó. Si ya la abonaste, escribinos por WhatsApp." }
      : { icono: "…", titulo: "¡Turno reservado!", texto: "Para confirmarlo, aboná la seña por WhatsApp. Ahí te pasamos los datos de pago." },
    CANCELADO: { icono: "×", titulo: "Turno cancelado", texto: "Este turno fue cancelado." },
    COMPLETADO: { icono: "✓", titulo: "Turno realizado", texto: "¡Gracias por tu visita!" },
    AUSENTE: { icono: "!", titulo: "Turno no asistido", texto: "" },
  }[turno.estado];

  const filas: [string, string][] = [
    [turno.tratamientos.length > 1 ? "Tratamientos" : "Tratamiento", nombreTratamientos(turno)],
    ["Fecha", fechaHoraLarga(turno.inicio)],
    ["Duración", formatDuracion(duracionTurnoMin(turno))],
    ["Precio", formatPrecio(turno.precio)],
    ...(turno.montoSena ? [[pendiente ? "Seña a abonar" : "Seña", formatPrecio(turno.montoSena)] as [string, string]] : []),
    ...(turno.giftCard ? [["Gift card", `${turno.giftCard.codigo} · cubre ${formatPrecio(turno.montoGiftCard)}`] as [string, string]] : []),
    ...(turno.giftCard && turno.precio > turno.montoGiftCard ? [["A abonar en la sesión", formatPrecio(turno.precio - turno.montoGiftCard)] as [string, string]] : []),
    ...(cfg.direccion ? [["Dirección", cfg.direccion] as [string, string]] : []),
  ];

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-linea bg-carbon p-6 text-center sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/60 font-serif text-3xl text-gold-light">
          {estados.icono}
        </span>
        <h1 className="mt-6 font-serif text-4xl">{estados.titulo}</h1>
        {estados.texto && <p className="mt-3 text-piedra">{estados.texto}</p>}

        {pendiente && !vencido && (
          <div className="mt-8 space-y-3 text-left">
            <p className="text-center font-serif text-2xl text-gold-light">Seña: {formatPrecio(turno.montoSena)}</p>
            {turno.expiraEn && (
              <p className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm first-letter:uppercase">
                ⏰ Tenés tiempo hasta el <strong>{fechaHoraLarga(turno.expiraEn)}</strong>. Si no se abona la seña, el horario se libera.
              </p>
            )}
            {cfg.whatsapp && (
              <IrAWhatsapp href={linkWhatsapp(cfg.whatsapp, mensajeSena(turno))} turnoId={turno.id} autoAbrir={nuevo === "1"} />
            )}
            <p className="text-center text-xs text-piedra">
              Te mandamos los datos de la reserva a {turno.clienta.email}. Cuando confirmemos la seña te llega otro mail.
            </p>
          </div>
        )}

        <dl className="mt-8 space-y-3 border-y border-linea py-6 text-left text-sm">
          {filas.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-piedra">{k}</dt>
              <dd className="text-right first-letter:uppercase">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-col items-center gap-5">
          {(turno.estado === "CANCELADO" || vencido) && <Link href="/reservar" className="btn-oro">Reservar otro turno</Link>}
          {cfg.whatsapp && !(pendiente && !vencido) && (
            <a href={linkWhatsapp(cfg.whatsapp, `Hola! Tengo una consulta sobre mi turno de ${nombreTratamientos(turno)} del ${fechaHoraLarga(turno.inicio)}`)}
              target="_blank" rel="noopener" className="btn-linea">Escribir por WhatsApp</a>
          )}
          {(turno.estado === "CONFIRMADO" || (pendiente && !vencido)) && futuro && <BotonCancelar turnoId={turno.id} token={turno.token} />}
        </div>
      </div>
    </div>
  );
}
