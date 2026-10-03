import { DIAS_PLURAL, ORDEN_SEMANA } from "./dias";

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatPrecio(monto: number): string {
  return pesos.format(monto);
}

export function formatDuracion(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Link de WhatsApp a partir de un número en cualquier formato */
export function linkWhatsapp(numero: string, texto?: string): string {
  const limpio = numero.replace(/\D/g, "");
  const q = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return `https://wa.me/${limpio}${q}`;
}

export function linkInstagram(usuario: string): string {
  if (usuario.startsWith("http")) return usuario;
  return `https://instagram.com/${usuario.replace(/^@/, "")}`;
}

/** ["Sábados · 09:00 a 13:00 y 14:00 a 18:00", …] agrupando días con el mismo horario */
export function resumenHorarios(franjas: { diaSemana: number; horaInicio: string; horaFin: string }[]): string[] {
  const porDia = new Map<number, string>();
  for (const d of ORDEN_SEMANA) {
    const del = franjas
      .filter((f) => f.diaSemana === d)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      .map((f) => `${f.horaInicio} a ${f.horaFin}`);
    if (del.length) porDia.set(d, del.join(" y "));
  }
  const grupos = new Map<string, number[]>();
  for (const [d, h] of porDia) grupos.set(h, [...(grupos.get(h) ?? []), d]);
  return [...grupos].map(([h, dias]) => `${dias.map((d) => DIAS_PLURAL[d]).join(", ")} · ${h}`);
}
