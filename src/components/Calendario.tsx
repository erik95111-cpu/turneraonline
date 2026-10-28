"use client";

import { DIAS_CORTO, MESES, ORDEN_SEMANA } from "@/lib/dias";

const DIAS = ORDEN_SEMANA.map((d) => DIAS_CORTO[d]);
/** Con esta cantidad de horarios libres o menos, el día se marca "pocos lugares" */
export const POCOS_LUGARES = 3;

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

type EstadoDia = "disponible" | "pocos" | "completo" | "cerrado";

function estadoDe(fecha: string, disponibilidad: Record<string, number> | null): EstadoDia {
  if (!disponibilidad || !(fecha in disponibilidad)) return "cerrado";
  const libres = disponibilidad[fecha];
  if (libres === 0) return "completo";
  return libres <= POCOS_LUGARES ? "pocos" : "disponible";
}

const ESTILO: Record<EstadoDia, string> = {
  disponible: "bg-gold/15 text-gold-light ring-1 ring-gold/50 hover:bg-gold/30 font-semibold",
  pocos: "bg-[#b86b3c]/15 text-[#c98552] ring-1 ring-[#b86b3c]/60 hover:bg-[#b86b3c]/30 font-semibold",
  completo: "text-piedra/60 line-through cursor-not-allowed",
  cerrado: "opacity-25 cursor-not-allowed",
};

export function Calendario(props: {
  mes: { y: number; m: number };
  onCambiarMes: (mes: { y: number; m: number }) => void;
  /** Primer y último mes navegables, "yyyy-MM" */
  mesMin: string;
  mesMax: string;
  disponibilidad: Record<string, number> | null;
  seleccion: string | null;
  onElegir: (fecha: string) => void;
}) {
  const { y, m } = props.mes;
  const primero = new Date(Date.UTC(y, m, 1));
  const offset = (primero.getUTCDay() + 6) % 7; // lunes primero
  const diasMes = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const actual = iso(y, m, 1).slice(0, 7);

  const mover = (delta: number) => {
    const d = new Date(Date.UTC(y, m + delta, 1));
    props.onCambiarMes({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => mover(-1)} disabled={actual <= props.mesMin} aria-label="Mes anterior"
          className="h-9 w-9 rounded-full border border-linea text-cream transition hover:border-gold disabled:opacity-20">‹</button>
        <p className="font-serif text-xl text-gold-light" aria-live="polite">{MESES[m]} {y}</p>
        <button type="button" onClick={() => mover(1)} disabled={actual >= props.mesMax} aria-label="Mes siguiente"
          className="h-9 w-9 rounded-full border border-linea text-cream transition hover:border-gold disabled:opacity-20">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {DIAS.map((d) => (
          <span key={d} className="pb-1 text-[0.65rem] tracking-widest text-piedra uppercase">{d}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: diasMes }, (_, i) => {
          const fecha = iso(y, m, i + 1);
          const estado = estadoDe(fecha, props.disponibilidad);
          const elegible = estado === "disponible" || estado === "pocos";
          const sel = props.seleccion === fecha;
          return (
            <button
              key={fecha}
              type="button"
              disabled={!elegible}
              onClick={() => props.onElegir(fecha)}
              aria-pressed={sel}
              aria-label={`${i + 1} de ${MESES[m]}${estado === "completo" ? ", completo" : estado === "pocos" ? ", pocos lugares" : estado === "cerrado" ? ", sin atención" : ""}`}
              className={[
                "aspect-square rounded-full text-sm tabular-nums transition",
                sel ? "bg-gold font-semibold text-[#0b0a0c] ring-2 ring-gold ring-offset-2 ring-offset-carbon" : ESTILO[estado],
              ].join(" ")}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-piedra">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-gold/40 ring-1 ring-gold" />Disponible</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#b86b3c]/40 ring-1 ring-[#b86b3c]" />Pocos lugares</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-piedra/30" />Completo</span>
      </div>
      {props.disponibilidad === null && <p className="mt-2 text-xs text-piedra">Cargando disponibilidad…</p>}
    </div>
  );
}
