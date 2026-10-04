"use client";

import { useState } from "react";

import { DIAS_CORTO, MESES, ORDEN_SEMANA } from "@/lib/dias";

const DIAS = ORDEN_SEMANA.map((d) => DIAS_CORTO[d]);

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function Calendario(props: {
  desde: string;
  hasta: string;
  diasAtencion: number[];
  seleccion: string | null;
  onElegir: (fecha: string) => void;
  tema?: "oscuro" | "claro";
}) {
  const [y0, m0] = props.desde.split("-").map(Number);
  const [mes, setMes] = useState({ y: y0, m: m0 - 1 });
  const claro = props.tema === "claro";

  const primero = new Date(Date.UTC(mes.y, mes.m, 1));
  const offset = (primero.getUTCDay() + 6) % 7; // lunes primero
  const diasMes = new Date(Date.UTC(mes.y, mes.m + 1, 0)).getUTCDate();

  const mover = (delta: number) => {
    const d = new Date(Date.UTC(mes.y, mes.m + delta, 1));
    setMes({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const puedeAtras = iso(mes.y, mes.m, 1) > props.desde.slice(0, 8) + "01";
  const puedeAdelante = iso(mes.y, mes.m + 1, 1) <= props.hasta;

  return (
    <div className={claro ? "text-[#1a1714]" : ""}>
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => mover(-1)} disabled={!puedeAtras} aria-label="Mes anterior"
          className="h-9 w-9 rounded-full border border-current/20 disabled:opacity-20">‹</button>
        <p className={`font-serif text-xl ${claro ? "" : "text-gold-light"}`}>{MESES[mes.m]} {mes.y}</p>
        <button type="button" onClick={() => mover(1)} disabled={!puedeAdelante} aria-label="Mes siguiente"
          className="h-9 w-9 rounded-full border border-current/20 disabled:opacity-20">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS.map((d) => (
          <span key={d} className={`pb-2 text-[0.65rem] tracking-widest uppercase ${claro ? "text-[#8b8279]" : "text-piedra"}`}>{d}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: diasMes }, (_, i) => {
          const fecha = iso(mes.y, mes.m, i + 1);
          const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay();
          const habil = fecha >= props.desde && fecha <= props.hasta && props.diasAtencion.includes(dow);
          const sel = props.seleccion === fecha;
          return (
            <button
              key={fecha}
              type="button"
              disabled={!habil}
              onClick={() => props.onElegir(fecha)}
              className={[
                "aspect-square rounded-full text-sm transition",
                sel
                  ? "bg-gold text-ink font-semibold"
                  : habil
                    ? claro ? "hover:bg-[#f1ece4] font-medium" : "hover:bg-gold/15 text-cream"
                    : "opacity-25 cursor-not-allowed",
              ].join(" ")}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
