"use client";

import { useState } from "react";

export function BotonCopiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        } catch {}
      }}
      className="rounded-md px-2 py-1 text-xs text-[#8a6d3b] hover:bg-[#f7f2ea]"
      aria-label={`Copiar ${etiqueta}`}
    >
      {copiado ? "¡Copiado!" : "Copiar"}
    </button>
  );
}
