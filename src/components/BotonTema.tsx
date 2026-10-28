"use client";

import { useEffect, useState } from "react";

type Tema = "oscuro" | "claro";
const CLAVE = "hs_tema";

/** Script que corre antes de pintar la página, para que no parpadee el tema guardado */
export const SCRIPT_TEMA = `try{if(localStorage.getItem("${CLAVE}")==="claro")document.documentElement.dataset.theme="claro"}catch(e){}`;

export function BotonTema() {
  const [tema, setTema] = useState<Tema>("oscuro");

  useEffect(() => {
    setTema(document.documentElement.dataset.theme === "claro" ? "claro" : "oscuro");
  }, []);

  function cambiar() {
    const nuevo: Tema = tema === "claro" ? "oscuro" : "claro";
    setTema(nuevo);
    if (nuevo === "claro") document.documentElement.dataset.theme = "claro";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {}
  }

  const proximo = tema === "claro" ? "oscuro" : "claro";
  return (
    <button
      type="button"
      onClick={cambiar}
      aria-label={`Cambiar a modo ${proximo}`}
      title={`Modo ${proximo}`}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-linea text-gold-light transition hover:border-gold"
    >
      {tema === "claro" ? (
        // Luna: pasar a oscuro
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      ) : (
        // Sol: pasar a claro
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
