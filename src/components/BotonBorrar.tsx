"use client";

import { IconoBasura } from "./Iconos";

/** Tachito de basura que pregunta antes de borrar */
export function BotonBorrar(p: { accion: (fd: FormData) => Promise<void>; campos: Record<string, string>; pregunta: string; etiqueta: string; conTexto?: boolean }) {
  return (
    <form action={p.accion} onSubmit={(e) => { if (!window.confirm(p.pregunta)) e.preventDefault(); }}>
      {Object.entries(p.campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className="btn-sec gap-1.5 !px-2.5 text-red-700 hover:!border-red-300 hover:!bg-red-50" aria-label={p.etiqueta} title={p.etiqueta}>
        <IconoBasura />{p.conTexto && <span>Borrar</span>}
      </button>
    </form>
  );
}
