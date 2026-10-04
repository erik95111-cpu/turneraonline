import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

export const TZ = "America/Argentina/Buenos_Aires";

/** "2026-10-03" + "09:30" (hora Argentina) → Date en UTC */
export function aFechaUTC(fecha: string, hora: string): Date {
  return fromZonedTime(`${fecha}T${hora}:00`, TZ);
}

/** Date → "2026-10-03" en hora Argentina */
export function fechaISO(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

/** Date → "09:30" en hora Argentina */
export function horaAR(d: Date): string {
  return formatInTimeZone(d, TZ, "HH:mm");
}

/** Día de la semana (0 = domingo) de una fecha "yyyy-MM-dd" */
export function diaSemana(fecha: string): number {
  return Number(formatInTimeZone(aFechaUTC(fecha, "12:00"), TZ, "i")) % 7;
}

/** Suma días a una fecha "yyyy-MM-dd" */
export function sumarDias(fecha: string, dias: number): string {
  const d = aFechaUTC(fecha, "12:00");
  return fechaISO(new Date(d.getTime() + dias * 86_400_000));
}

/** "sábado 3 de octubre" */
export function fechaLarga(d: Date): string {
  return formatInTimeZone(d, TZ, "EEEE d 'de' MMMM", { locale: es });
}

/** "sábado 3 de octubre, 09:30 hs" */
export function fechaHoraLarga(d: Date): string {
  return `${fechaLarga(d)}, ${horaAR(d)} hs`;
}

export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}
