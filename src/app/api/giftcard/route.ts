import { NextResponse } from "next/server";
import { ErrorReserva } from "@/lib/errores";
import { consultarGiftCard } from "@/lib/giftcards";
import { listaIds } from "@/lib/tratamientos";

/** Valida un código de gift card para el tratamiento elegido (paso "Tus datos" de la reserva) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const codigo = url.searchParams.get("codigo") ?? "";
  const servicios = listaIds(url.searchParams.get("servicio"));
  try {
    return NextResponse.json({ ok: true, ...(await consultarGiftCard(codigo, servicios)) });
  } catch (err) {
    if (err instanceof ErrorReserva) return NextResponse.json({ ok: false, error: err.message });
    throw err;
  }
}
