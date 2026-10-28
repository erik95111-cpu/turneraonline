"use client";

/**
 * Pantalla de respaldo: si alguna página de la web falla (por ejemplo, la base
 * de datos no responde), en vez de una pantalla en blanco la clienta ve este
 * mensaje con un botón para reintentar. El detalle técnico queda en el log
 * con la etiqueta [APP] o [LIB:…] para saber de dónde vino.
 */
import Link from "next/link";
import { useEffect } from "react";
import { logError } from "@/lib/log";

export default function ErrorPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // En producción Next.js oculta el mensaje real en el navegador; el "digest"
    // es el código para buscar el error completo en Vercel → Logs.
    logError(`página${error.digest ? ` (digest ${error.digest})` : ""}`, error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">Algo salió mal</p>
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">No pudimos cargar esta página</h1>
      <p className="mt-4 max-w-md text-piedra">
        Puede ser un problema momentáneo. Probá de nuevo en unos segundos; si sigue pasando, escribinos por WhatsApp.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-oro">Reintentar</button>
        <Link href="/" className="btn-linea">Volver al inicio</Link>
      </div>
    </div>
  );
}
