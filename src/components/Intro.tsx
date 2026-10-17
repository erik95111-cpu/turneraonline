"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CLAVE = "hs_intro_vista";
const DURACION_MS = 3200;

/**
 * Intro animada con el logo. Se muestra la primera vez que alguien entra en la
 * sesión del navegador y después lleva a la página de reservas.
 * Si JavaScript falla, la animación CSS igual la oculta sola al terminar.
 */
export function Intro() {
  const router = useRouter();
  const [activa, setActiva] = useState(true);

  useEffect(() => {
    let vista = false;
    try {
      vista = sessionStorage.getItem(CLAVE) === "1" || window.location.hash !== "";
    } catch {}
    if (vista) {
      setActiva(false);
      return;
    }
    try {
      sessionStorage.setItem(CLAVE, "1");
    } catch {}
    router.prefetch("/reservar");
    const corta = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => router.push("/reservar"), corta ? 1200 : DURACION_MS);
    return () => clearTimeout(t);
  }, [router]);

  if (!activa) return null;

  return (
    <>
      {/* Antes de pintar: si ya la vio en esta sesión, la ocultamos para que no parpadee */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("${CLAVE}")==="1"||location.hash)document.documentElement.dataset.intro="no"}catch(e){}`,
        }}
      />
      <div className="intro" role="dialog" aria-label="Bienvenida a MC Healthy Skin">
        <div className="intro-logo">
          <svg className="intro-aro" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="96" />
          </svg>
          <div className="intro-img">
            <Image src="/logo.png" alt="MC Healthy Skin, Dermatocosmiatría" width={320} height={320} priority />
            <span className="intro-brillo" />
          </div>
        </div>
        <p className="intro-texto">Reservá tu turno</p>
        <button type="button" className="intro-saltar" onClick={() => router.push("/reservar")}>
          Saltar
        </button>
      </div>
    </>
  );
}
