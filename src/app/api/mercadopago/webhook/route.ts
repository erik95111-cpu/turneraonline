import { NextResponse } from "next/server";
import { procesarPago } from "@/lib/turnos";
import { mpHabilitado } from "@/lib/mercadopago";

/**
 * Notificaciones de Mercado Pago. No confiamos en el contenido: sólo tomamos
 * el id del pago y lo consultamos directamente a la API de Mercado Pago.
 */
export async function POST(req: Request) {
  if (!mpHabilitado()) return NextResponse.json({ ok: false }, { status: 503 });

  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const tipo = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");

  if (tipo === "payment" && id && /^\d+$/.test(String(id))) {
    try {
      await procesarPago(String(id));
    } catch (err) {
      console.error("[webhook mp]", err);
      return NextResponse.json({ ok: false }, { status: 500 }); // MP reintenta
    }
  }
  return NextResponse.json({ ok: true });
}
