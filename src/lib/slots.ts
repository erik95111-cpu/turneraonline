import { aFechaUTC, horaAMinutos } from "./tiempo";

export interface Franja {
  horaInicio: string;
  horaFin: string;
}

export interface Ocupado {
  inicio: Date;
  fin: Date;
}

export interface ParametrosSlots {
  /** "yyyy-MM-dd" en hora Argentina */
  fecha: string;
  franjas: Franja[];
  duracionMin: number;
  intervaloMin: number;
  ocupados: Ocupado[];
  /** No se ofrecen horarios que empiecen antes de este instante */
  minimoInicio: Date;
}

/**
 * Devuelve los horarios ("HH:mm") disponibles en un día para un servicio
 * de cierta duración, respetando franjas de atención, turnos y bloqueos.
 */
export function calcularSlots(p: ParametrosSlots): string[] {
  const resultado = new Set<string>();
  const paso = Math.max(5, p.intervaloMin);

  for (const franja of p.franjas) {
    const ini = horaAMinutos(franja.horaInicio);
    const fin = horaAMinutos(franja.horaFin);

    for (let m = ini; m + p.duracionMin <= fin; m += paso) {
      const hora = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const inicio = aFechaUTC(p.fecha, hora);
      const termina = new Date(inicio.getTime() + p.duracionMin * 60_000);

      if (inicio < p.minimoInicio) continue;
      const pisa = p.ocupados.some((o) => inicio < o.fin && termina > o.inicio);
      if (!pisa) resultado.add(hora);
    }
  }

  return [...resultado].sort();
}
