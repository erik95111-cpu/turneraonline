import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getConfig, siteUrl } from "@/lib/config";
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { fechaLarga } from "@/lib/tiempo";
import { estadoVisible, linkGiftCard, mensajeGiftCard } from "@/lib/giftcards";
import { TarjetaRegalo } from "@/components/TarjetaRegalo";
import { IrAWhatsapp } from "@/components/IrAWhatsapp";
import { BotonImprimir } from "@/components/BotonImprimir";

export const metadata: Metadata = { title: "Gift card", robots: { index: false } };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; nuevo?: string }>;
}

export default async function VerGiftCard({ params, searchParams }: Props) {
  const { id } = await params;
  const { t: token, nuevo } = await searchParams;
  const g = await prisma.giftCard.findUnique({ where: { id }, include: { servicio: true } });
  if (!g || !token || g.token !== token) notFound();

  const cfg = await getConfig();
  const estado = estadoVisible(g);
  const activa = estado === "ACTIVA";
  const conSaldo = !g.servicioId && g.saldo < g.monto;
  const reservar = `/reservar?gift=${g.codigo}${g.servicioId ? `&servicio=${g.servicioId}` : ""}`;
  const compartir = `https://wa.me/?text=${encodeURIComponent(`¡Te regalo una gift card de ${cfg.nombreNegocio}! 🎁\n${linkGiftCard(siteUrl(), g)}`)}`;

  const avisos: Record<typeof estado, { titulo: string; texto: string }> = {
    PENDIENTE_PAGO: { titulo: "¡Pedido recibido!", texto: `Para activarla, aboná ${formatPrecio(g.monto)} por WhatsApp. Cuando confirmemos el pago te llega la gift card con su código a ${g.compradorEmail}.` },
    ACTIVA: { titulo: `Gift card para ${g.para}`, texto: g.venceEn ? `Vale hasta el ${fechaLarga(g.venceEn)}. Se usa ingresando el código al reservar el turno.` : "" },
    VENCIDA: { titulo: "Gift card vencida", texto: g.venceEn ? `Venció el ${fechaLarga(g.venceEn)}. Si tenés dudas, escribinos por WhatsApp.` : "" },
    USADA: { titulo: "Gift card usada", texto: "Esta gift card ya se usó. ¡Gracias!" },
    ANULADA: { titulo: "Gift card anulada", texto: "Esta gift card fue anulada. Si tenés dudas, escribinos por WhatsApp." },
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <p className="eyebrow no-imprimir">Gift card</p>
        <h1 className="mt-3 font-serif text-4xl text-cream">{avisos[estado].titulo}</h1>
        {avisos[estado].texto && <p className="mx-auto mt-3 max-w-md text-sm text-piedra">{avisos[estado].texto}</p>}
      </div>

      <div className={`mt-8 ${activa ? "" : "opacity-90 grayscale-[0.4]"}`}>
        <TarjetaRegalo
          titulo={g.servicio ? g.servicio.nombre : "Bienestar"}
          monto={g.servicio ? undefined : formatPrecio(g.monto)}
          para={g.para}
          de={g.de}
          codigo={activa ? g.codigo : undefined}
        />
      </div>
      {g.mensaje && <p className="mt-6 text-center font-serif text-2xl text-cream italic">“{g.mensaje}”</p>}

      {activa && (
        <dl className="mt-8 space-y-3 border-y border-linea py-5 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-piedra">Código</dt><dd className="font-semibold tracking-[0.2em] text-gold-light">{g.codigo}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-piedra">Vale por</dt><dd className="text-right">{g.servicio ? g.servicio.nombre : formatPrecio(g.monto)}</dd></div>
          {conSaldo && <div className="flex justify-between gap-4"><dt className="text-piedra">Saldo disponible</dt><dd>{formatPrecio(g.saldo)}</dd></div>}
          {g.venceEn && <div className="flex justify-between gap-4"><dt className="text-piedra">Válida hasta</dt><dd className="text-right first-letter:uppercase">{fechaLarga(g.venceEn)}</dd></div>}
        </dl>
      )}

      <div className="no-imprimir mt-8 flex flex-col items-center gap-4">
        {estado === "PENDIENTE_PAGO" && cfg.whatsapp && (
          <div className="w-full">
            <IrAWhatsapp href={linkWhatsapp(cfg.whatsapp, mensajeGiftCard(g))} turnoId={g.id} autoAbrir={nuevo === "1"} texto="Abonar la gift card por WhatsApp" />
          </div>
        )}
        {activa && (
          <>
            <Link href={reservar} className="btn-oro">Reservar turno con esta gift card</Link>
            <div className="flex flex-wrap justify-center gap-3">
              <a href={compartir} target="_blank" rel="noopener" className="btn-linea">Mandarla por WhatsApp</a>
              <BotonImprimir />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
