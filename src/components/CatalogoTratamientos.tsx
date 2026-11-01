"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDuracion, formatPrecio } from "@/lib/formato";

export interface ItemCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  duracionMin: number;
  precio: number;
  /** Sólo combos */
  incluye?: string;
  separado?: number;
  ahorro?: number;
  /** Seña a pagar (0 = no se pide) */
  sena: number;
}

type Orden = "recomendado" | "menor" | "mayor";

/** Tratamientos de la web con botonera por categoría y orden por precio */
export function CatalogoTratamientos({ items, categorias }: { items: ItemCatalogo[]; categorias: string[] }) {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [orden, setOrden] = useState<Orden>("recomendado");

  const visibles = useMemo(() => {
    const lista = items.filter((s) => !categoria || s.categoria === categoria);
    if (orden === "recomendado") return lista;
    return [...lista].sort((a, b) => (orden === "menor" ? a.precio - b.precio : b.precio - a.precio));
  }, [items, categoria, orden]);

  // Agrupado por categoría sólo en el orden recomendado y con “Todos”
  const grupos = orden === "recomendado" && !categoria
    ? categorias.map((c) => ({ titulo: c, lista: visibles.filter((s) => s.categoria === c) })).filter((g) => g.lista.length)
    : [{ titulo: "", lista: visibles }];

  const chip = (activo: boolean) =>
    `rounded-full border px-4 py-2 text-xs tracking-[0.15em] uppercase transition ${activo ? "border-gold bg-gold text-[#0b0a0c]" : "border-linea text-piedra hover:border-gold/60 hover:text-cream"}`;

  return (
    <>
      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Filtrar por tipo de tratamiento">
          <button type="button" className={chip(!categoria)} aria-pressed={!categoria} onClick={() => setCategoria(null)}>Todos</button>
          {categorias.map((c) => (
            <button key={c} type="button" className={chip(categoria === c)} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{c}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs tracking-[0.15em] text-piedra uppercase">
          Ordenar
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}
            className="rounded-full border border-linea bg-carbon px-4 py-2 text-xs tracking-normal text-cream normal-case focus:border-gold focus:outline-none">
            <option value="recomendado">Recomendado</option>
            <option value="menor">Precio: menor a mayor</option>
            <option value="mayor">Precio: mayor a menor</option>
          </select>
        </label>
      </div>
      <p className="mt-4 text-center text-xs text-piedra sm:text-left" aria-live="polite">
        {visibles.length} {visibles.length === 1 ? "tratamiento" : "tratamientos"}{categoria && ` · ${categoria}`}
      </p>

      {grupos.map((g) => (
        <div key={g.titulo || "todos"} className="mt-10">
          {g.titulo && grupos.length > 1 && (
            <h3 className="mb-6 flex items-center gap-4 font-serif text-2xl text-gold-light">
              {g.titulo}
              <span className="h-px flex-1 bg-linea" />
            </h3>
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {g.lista.map((s) => (
              <article key={s.id} className="group flex flex-col rounded-2xl border border-linea bg-carbon p-6 transition hover:border-gold/50">
                {(categoria === null && orden !== "recomendado") && <p className="mb-2 text-[0.65rem] tracking-[0.2em] text-piedra uppercase">{s.categoria}</p>}
                <h4 className="font-serif text-2xl leading-tight">{s.nombre}</h4>
                {s.incluye && <p className="mt-2 text-sm text-gold-light">Incluye: {s.incluye}</p>}
                {s.descripcion && <p className="mt-3 flex-1 text-sm leading-relaxed text-piedra">{s.descripcion}</p>}
                <div className="mt-6 flex items-end justify-between border-t border-linea pt-4">
                  <div>
                    <p className="text-xs tracking-widest text-piedra uppercase">{formatDuracion(s.duracionMin)}</p>
                    <p className="mt-1 font-serif text-2xl text-gold-light">{formatPrecio(s.precio)}</p>
                    {s.ahorro ? <p className="text-xs text-piedra"><s>{formatPrecio(s.separado ?? 0)}</s> · ahorrás {formatPrecio(s.ahorro)}</p> : null}
                    {s.sena > 0 && <p className="text-xs text-piedra">Seña {formatPrecio(s.sena)}</p>}
                  </div>
                  <Link href={`/reservar?servicio=${s.id}`} className="btn-linea !px-4 !py-2 !text-[0.65rem]">Reservar</Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
