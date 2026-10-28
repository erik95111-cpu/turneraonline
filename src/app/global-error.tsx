"use client";

/**
 * Último respaldo: se muestra sólo si falla el armazón general del sitio
 * (src/app/layout.tsx). Por eso no usa los estilos del sitio: tiene que
 * funcionar aunque todo lo demás esté roto.
 */
import { useEffect } from "react";
import { logError } from "@/lib/log";

export default function ErrorGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logError(`sitio completo${error.digest ? ` (digest ${error.digest})` : ""}`, error);
  }, [error]);

  return (
    <html lang="es-AR">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0a0c", color: "#f3ede4", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 16 }}>
        <div>
          <h1 style={{ fontWeight: 500 }}>No pudimos cargar la página</h1>
          <p style={{ color: "#a59d94" }}>Probá de nuevo en unos segundos.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 22px", borderRadius: 999, border: 0, background: "#c9a96e", color: "#0b0a0c", cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
