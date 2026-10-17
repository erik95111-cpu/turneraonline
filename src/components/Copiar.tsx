"use client";

import { useState } from "react";

/** Muestra un dato (CBU, alias) con un botón para copiarlo */
export function Copiar({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      const r = document.createRange();
      const el = document.getElementById(`dato-${etiqueta}`);
      if (el) {
        r.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-humo px-4 py-3 text-left">
      <div className="min-w-0">
        <p className="text-xs tracking-widest text-piedra uppercase">{etiqueta}</p>
        <p id={`dato-${etiqueta}`} className="font-mono text-base break-all text-cream select-all">{valor}</p>
      </div>
      <button type="button" onClick={copiar} className="btn-linea shrink-0 !px-3 !py-1.5 !text-[0.65rem]">
        {copiado ? "¡Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
