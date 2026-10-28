import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { PedirGiftCard } from "@/components/PedirGiftCard";
import { pedirGiftCard } from "@/app/actions/giftcards";

export const metadata: Metadata = { title: "Gift cards", description: "Regalá un tratamiento o un monto para usar en MC Healthy Skin." };

export default async function GiftCards() {
  const [cfg, servicios] = await Promise.all([
    getConfig(),
    prisma.servicio.findMany({
      where: { activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, precio: true, categoria: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="eyebrow flex items-center gap-3"><span className="h-px w-8 bg-gold" />Gift cards</p>
      <h1 className="mt-4 font-serif text-4xl leading-tight text-cream sm:text-5xl">
        Regalá <em className="texto-oro">bienestar</em>
      </h1>
      <p className="mt-3 mb-10 max-w-lg text-sm text-piedra">
        Elegí un monto o un tratamiento, escribí para quién es y pagala por WhatsApp. Te mandamos la tarjeta por mail, lista para reenviar o imprimir.
      </p>
      {cfg.giftcardsActivas && cfg.whatsapp ? (
        <PedirGiftCard monto={cfg.giftcardMonto} meses={cfg.giftcardMeses} servicios={servicios} accion={pedirGiftCard} />
      ) : (
        <p className="text-piedra">Por el momento las gift cards se piden por WhatsApp o en el consultorio.</p>
      )}
    </div>
  );
}
