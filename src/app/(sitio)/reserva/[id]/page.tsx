import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { fechaHoraLarga } from "@/lib/tiempo";
import { formatDuracion, formatPrecio, linkWhatsapp } from "@/lib/formato";
import { mensajeComprobante } from "@/lib/plantillas-email";
import { BotonCancelar } from "@/components/BotonCancelar";
import { Copiar } from "@/components/Copiar";

export const metadata: Metadata = { title: "Mi turno", robots: { index: false } };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function TurnoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t: token } = await searchParams;

  const turno = await prisma.turno.findUnique({ where: { id }, include: { servicio: true, clienta: true } });
  if (!turno || !token || turno.token !== token) notFound();

  const cfg = await getConfig();
  const ahora = new Date();
  const pendiente = turno.estado === "PENDIENTE_PAGO";
  const vencido = pendiente && turno.expiraEn !== null && turno.expiraEn < ahora;
  const futuro = turno.inicio > ahora;

  const estados = {
    CONFIRMADO: { icono: "✓", titulo: "¡Turno confirmado!", texto: `Te enviamos los detalles a ${turno.clienta.email}.` },
    PENDIENTE_PAGO: vencido
      ? { icono: "!", titulo: "La reserva venció", texto: "No recibimos la seña a tiempo y el horario se liberó. Si ya la transferiste, escribinos por WhatsApp." }
      : { icono: "…", titulo: "¡Turno reservado!", texto: "Para confirmarlo, transferí la seña y mandanos la captura por WhatsApp." },
    CANCELADO: { icono: "×", titulo: "Turno cancelado", texto: "Este turno fue cancelado." },
    COMPLETADO: { icono: "✓", titulo: "Turno realizado", texto: "¡Gracias por tu visita!" },
    AUSENTE: { icono: "!", titulo: "Turno no asistido", texto: "" },
  }[turno.estado];

  const filas: [string, string][] = [
    ["Tratamiento", turno.servicio.nombre],
    ["Fecha", fechaHoraLarga(turno.inicio)],
    ["Duración", formatDuracion(turno.servicio.duracionMin)],
    ["Precio", formatPrecio(turno.precio)],
    ...(turno.montoSena ? [[pendiente ? "Seña a transferir" : "Seña", formatPrecio(turno.montoSena)] as [string, string]] : []),
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
            {cfg.alias && <Copiar etiqueta="Alias" valor={cfg.alias} />}
            {cfg.cbu && <Copiar etiqueta="CBU / CVU" valor={cfg.cbu} />}
            {(cfg.titularCuenta || cfg.banco) && (
              <p className="px-1 text-sm text-piedra">
                {cfg.titularCuenta && <>Titular: <span className="text-cream">{cfg.titularCuenta}</span></>}
                {cfg.titularCuenta && cfg.banco && " · "}
                {cfg.banco && <>Banco: <span className="text-cream">{cfg.banco}</span></>}
              </p>
            )}
            {turno.expiraEn && (
              <p className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm first-letter:uppercase">
                ⏰ Tenés tiempo hasta el <strong>{fechaHoraLarga(turno.expiraEn)}</strong>. Si no recibimos la seña, el horario se libera.
              </p>
            )}
            {cfg.whatsapp && (
              <a
                href={linkWhatsapp(cfg.whatsapp, mensajeComprobante(turno))}
                target="_blank"
                rel="noopener"
                className="btn-oro mt-2 w-full"
              >
                Enviar comprobante por WhatsApp
              </a>
            )}
            <p className="text-center text-xs text-piedra">
              Te mandamos estos datos también a {turno.clienta.email}. Cuando confirmemos la seña te llega otro mail.
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
            <a href={linkWhatsapp(cfg.whatsapp, `Hola! Tengo una consulta sobre mi turno de ${turno.servicio.nombre} del ${fechaHoraLarga(turno.inicio)}`)}
              target="_blank" rel="noopener" className="btn-linea">Escribir por WhatsApp</a>
          )}
          {(turno.estado === "CONFIRMADO" || (pendiente && !vencido)) && futuro && <BotonCancelar turnoId={turno.id} token={turno.token} />}
        </div>
      </div>
    </div>
  );
}
