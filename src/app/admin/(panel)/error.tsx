"use client";

/**
 * Respaldo del panel: si una pantalla o un botón del panel falla, se muestra
 * esto en lugar de la página en blanco, sin perder el menú de arriba.
 */
import { useEffect } from "react";
import { logError } from "@/lib/log";

export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logError(`panel${error.digest ? ` (digest ${error.digest})` : ""}`, error);
  }, [error]);

  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <h1 className="font-serif text-2xl">Algo salió mal</h1>
      <p className="mt-2 text-sm text-[#6b635b]">
        No se pudo completar la operación. Puede ser un corte momentáneo de la base de datos: probá de nuevo.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-[#8b8279]">
          Código para buscar en Vercel → Logs: <code>{error.digest}</code>
        </p>
      )}
      <button type="button" onClick={reset} className="btn mt-5">Reintentar</button>
    </div>
  );
}
