"use client";

import { useEffect, useState } from "react";

const SEGUNDOS = 3;

/**
 * Botón para abonar por WhatsApp (seña o gift card). Si recién reservó o pidió
 * (autoAbrir), cuenta 3 segundos y abre WhatsApp sola, una sola vez por turno.
 */
export function IrAWhatsapp({ href, turnoId, autoAbrir, texto = "Abonar la seña por WhatsApp" }: { href: string; turnoId: string; autoAbrir: boolean; texto?: string }) {
  const [restan, setRestan] = useState<number | null>(null);

  useEffect(() => {
    if (!autoAbrir) return;
    const clave = `hs_wa_${turnoId}`;
    try {
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, "1");
    } catch {}
    setRestan(SEGUNDOS);
    const intervalo = setInterval(() => {
      setRestan((n) => {
        if (n === null) return null;
        if (n <= 1) {
          clearInterval(intervalo);
          window.location.href = href;
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(intervalo);
  }, [autoAbrir, href, turnoId]);

  return (
    <div className="space-y-2 text-center">
      <a href={href} target="_blank" rel="noopener" className="btn-oro w-full" onClick={() => setRestan(null)}>
        {texto}
      </a>
      {restan !== null && restan > 0 && (
        <p className="text-xs text-piedra" role="status">
          Te llevamos a WhatsApp en {restan}…{" "}
          <button type="button" className="underline" onClick={() => setRestan(null)}>Quedarme acá</button>
        </p>
      )}
    </div>
  );
}
