"use server";

import { ErrorReserva } from "@/lib/errores";
import { crearGiftCard, giftCardSchema } from "@/lib/giftcards";

export type ResultadoGiftCard = { ok: true; url: string } | { ok: false; error: string };

export async function pedirGiftCard(input: unknown, honeypot?: string): Promise<ResultadoGiftCard> {
  if (honeypot) return { ok: false, error: "No se pudo procesar el pedido" };
  const parsed = giftCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const g = await crearGiftCard(parsed.data);
    return { ok: true, url: `/gift-cards/${g.id}?t=${g.token}&nuevo=1` };
  } catch (err) {
    if (err instanceof ErrorReserva) return { ok: false, error: err.message };
    console.error("[gift card]", err);
    return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo o escribinos por WhatsApp." };
  }
}
