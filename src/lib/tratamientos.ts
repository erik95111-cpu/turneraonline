/** Como mucho estos tratamientos en un mismo turno */
export const MAX_TRATAMIENTOS = 4;

/** Ids únicos, en el orden en que se eligieron; acepta "a,b" o una lista */
export function listaIds(entrada: string | string[] | null | undefined): string[] {
  const partes = Array.isArray(entrada) ? entrada : (entrada ?? "").split(",");
  return [...new Set(partes.map((s) => s.trim()).filter(Boolean))].slice(0, MAX_TRATAMIENTOS);
}

/** “Higiene profunda + Celulitis”. Turnos viejos sin lista: el tratamiento principal. */
export function nombreTratamientos(t: { servicio: { nombre: string }; tratamientos?: { nombre: string; orden: number }[] }): string {
  const lista = [...(t.tratamientos ?? [])].sort((a, b) => a.orden - b.orden);
  return lista.length ? lista.map((x) => x.nombre).join(" + ") : t.servicio.nombre;
}

export function duracionTurnoMin(t: { inicio: Date; fin: Date }): number {
  return Math.round((t.fin.getTime() - t.inicio.getTime()) / 60_000);
}
