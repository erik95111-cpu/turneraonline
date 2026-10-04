import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { formatInTimeZone } from "date-fns-tz";
import { siteUrl } from "./config";
import { TZ } from "./tiempo";

export function mpHabilitado(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function cliente() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Mercado Pago no está configurado (MP_ACCESS_TOKEN)");
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

export async function crearPreferenciaSena(args: {
  turnoId: string;
  token: string;
  titulo: string;
  monto: number;
  email: string;
  nombre: string;
  expira: Date;
}) {
  const base = siteUrl();
  const vuelta = `${base}/reserva/${args.turnoId}?t=${args.token}`;
  // Mercado Pago sólo acepta auto_return y webhooks con URLs públicas https
  const publica = base.startsWith("https://");

  const pref = await new Preference(cliente()).create({
    body: {
      items: [{ id: args.turnoId, title: args.titulo, quantity: 1, unit_price: args.monto, currency_id: "ARS" }],
      payer: { email: args.email, name: args.nombre },
      external_reference: args.turnoId,
      back_urls: { success: vuelta, pending: vuelta, failure: vuelta },
      ...(publica ? { auto_return: "approved", notification_url: `${base}/api/mercadopago/webhook` } : {}),
      expires: true,
      expiration_date_to: formatInTimeZone(args.expira, TZ, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
      statement_descriptor: "HEALTHY SKIN",
    },
  });
  if (!pref.id || !pref.init_point) throw new Error("Mercado Pago no devolvió el link de pago");
  return { id: pref.id, url: pref.init_point };
}

export async function obtenerPago(id: string) {
  const pago = await new Payment(cliente()).get({ id });
  return {
    id: String(pago.id),
    estado: pago.status ?? "unknown",
    turnoId: pago.external_reference ?? "",
    monto: pago.transaction_amount ?? 0,
  };
}
