"use client";

import { useMemo, useState } from "react";

export interface ClientaElegible { id: string; nombre: string; telefono: string; email: string }

/** Quita tildes y pasa a minúsculas para buscar “Julieta”, “julieta” o “Juliéta” igual */
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Buscador de clientas del panel: elegís una y se cargan sus datos en el turno */
export function ElegirClienta(p: { clientas: ClientaElegible[]; elegida: ClientaElegible | null; onElegir: (c: ClientaElegible | null) => void }) {
  const [busqueda, setBusqueda] = useState("");
  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return [];
    const digitos = q.replace(/\D/g, "");
    return p.clientas
      .filter((c) => normalizar(c.nombre).includes(q) || (digitos.length >= 3 && c.telefono.replace(/\D/g, "").includes(digitos)))
      .slice(0, 6);
  }, [busqueda, p.clientas]);

  if (p.elegida) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gold/50 bg-gold/10 p-4">
        <div className="min-w-0">
          <p className="text-[0.65rem] tracking-[0.2em] text-piedra uppercase">Clienta</p>
          <p className="truncate font-serif text-xl text-cream">{p.elegida.nombre}</p>
          <p className="truncate text-xs text-piedra">{p.elegida.telefono}{p.elegida.email && ` · ${p.elegida.email}`}</p>
        </div>
        <button type="button" onClick={() => p.onElegir(null)} className="shrink-0 text-xs text-piedra underline underline-offset-2 hover:text-cream">Cambiar</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-linea p-4">
      <label htmlFor="buscar-clienta" className="text-[0.65rem] tracking-[0.2em] text-piedra uppercase">Clienta</label>
      <input
        id="buscar-clienta"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscá por nombre o teléfono…"
        autoComplete="off"
        className="campo mt-2"
      />
      {busqueda.trim() && (
        <ul className="mt-2 divide-y divide-linea overflow-hidden rounded-xl border border-linea" aria-label="Clientas encontradas">
          {resultados.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { p.onElegir(c); setBusqueda(""); }} className="w-full px-3 py-2.5 text-left hover:bg-gold/10">
                <span className="block text-sm text-cream">{c.nombre}</span>
                <span className="block text-xs text-piedra">{c.telefono}</span>
              </button>
            </li>
          ))}
          {resultados.length === 0 && <li className="px-3 py-2.5 text-xs text-piedra">No hay ninguna con ese nombre. Cargala en “Tus datos” y queda guardada.</li>}
        </ul>
      )}
      <p className="mt-2 text-xs text-piedra">Si es nueva, dejalo vacío y cargá sus datos en el paso 3.</p>
    </div>
  );
}
