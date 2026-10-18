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

/**
 * Pasa un celular argentino escrito de cualquier forma al formato internacional
 * que usa WhatsApp: 549 + código de área + número (ej: 5491164052481).
 * Acepta "11 6405-2481", "9 11 6405-2481", "011 15 6405-2481", "+54 9 11 6405 2481".
 */
export function numeroWhatsapp(numero: string): string {
  const internacional = /^\s*(\+|00)/.test(numero);
  let d = numero.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2); // prefijo internacional 00
  if (d.startsWith("54") && (internacional || d.length >= 12)) {
    d = d.slice(2);
  } else if (internacional) {
    return d; // número de otro país: se deja como está
  }
  if (d.startsWith("0")) d = d.slice(1); // 011… → 11…
  if (d.startsWith("9")) d = d.slice(1); // 9 11… → 11…
  // Quitar el "15" de los celulares escritos a la vieja usanza (11 15 6405 2481)
  for (const area of [2, 3, 4]) {
    if (d.length === 12 && d.slice(area, area + 2) === "15") {
      d = d.slice(0, area) + d.slice(area + 2);
      break;
    }
  }
  return d.length === 10 ? `549${d}` : d;
}

/** Link de WhatsApp a partir de un número en cualquier formato */
export function linkWhatsapp(numero: string, texto?: string): string {
  const limpio = numeroWhatsapp(numero);
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
