"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const CLAVE = "hs_intro_vista";

/**
 * Portada animada con el logo. Se muestra la primera vez que alguien entra en la
 * sesión del navegador y se queda en movimiento hasta que la clienta toca
 * "Reservá tu turno" (o "Ver la página"). Los dos son links, así que funcionan sin JavaScript.
 */
export function Intro() {
  const [activa, setActiva] = useState(true);

  useEffect(() => {
    let vista = false;
    try {
      vista = sessionStorage.getItem(CLAVE) === "1" || window.location.hash !== "";
      sessionStorage.setItem(CLAVE, "1");
    } catch {}
    if (vista) setActiva(false);
  }, []);

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
        <div className="intro-flota">
          <div className="intro-logo">
            <svg className="intro-aro" viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="96" />
            </svg>
            <span className="intro-orbita" aria-hidden="true"><span /></span>
            <div className="intro-img">
              <Image src="/logo.png" alt="MC Healthy Skin, Dermatocosmiatría" width={320} height={320} priority />
              <span className="intro-brillo" />
            </div>
          </div>
        </div>
        <Link href="/reservar" className="btn-oro intro-boton">Reservá tu turno</Link>
        <Link href="/?intro=0" className="intro-ver" onClick={() => setActiva(false)}>
          Ver la página
        </Link>
      </div>
    </>
  );
}
