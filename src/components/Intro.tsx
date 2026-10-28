"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const CLAVE = "hs_intro_vista";

/**
 * Portada animada: partículas de polvo dorado que se juntan formando el círculo
 * del logo y después quedan girando suave alrededor mientras la clienta decide.
 * Se muestra una vez por sesión. Sin JavaScript, el logo y el botón aparecen igual (CSS).
 */
export function Intro() {
  const [activa, setActiva] = useState(true);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const logo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vista = false;
    try {
      vista = sessionStorage.getItem(CLAVE) === "1" || window.location.hash !== "";
      sessionStorage.setItem(CLAVE, "1");
    } catch {}
    if (vista) setActiva(false);
  }, []);

  useEffect(() => {
    if (!activa) return;
    const canvas = lienzo.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return animarPolvo(canvas, ctx, () => logo.current?.getBoundingClientRect() ?? null);
  }, [activa]);

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
        <canvas ref={lienzo} className="intro-polvo" aria-hidden="true" />
        <div className="intro-flota">
          <div ref={logo} className="intro-logo">
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

interface Particula {
  x0: number; y0: number; // de dónde sale (proporción de la pantalla)
  angulo: number; // lugar en el anillo
  radio: number; // 1 = sobre el borde del logo
  demora: number; // ms antes de empezar a moverse
  tam: number;
  fase: number; // para el titileo
}

const CANTIDAD = 240;
const LLEGADA_MS = 1900;

/** Dibuja el polvo dorado. Devuelve la función que lo detiene. */
function animarPolvo(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, rectLogo: () => DOMRect | null) {
  const particulas: Particula[] = Array.from({ length: CANTIDAD }, (_, i) => ({
    x0: Math.random(),
    y0: Math.random(),
    angulo: (i / CANTIDAD) * Math.PI * 2 + Math.random() * 0.05,
    radio: 1.03 + Math.random() * 0.1,
    demora: Math.random() * 450,
    tam: 0.6 + Math.random() * 1.5,
    fase: Math.random() * Math.PI * 2,
  }));
  const suave = (p: number) => 1 - Math.pow(1 - p, 3);
  let ancho = 0;
  let alto = 0;

  const ajustar = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = window.innerWidth;
    alto = window.innerHeight;
    canvas.width = ancho * dpr;
    canvas.height = alto * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  ajustar();
  window.addEventListener("resize", ajustar);

  const inicio = performance.now();
  let cuadro = 0;
  const dibujar = (ahora: number) => {
    const t = ahora - inicio;
    const r = rectLogo();
    ctx.clearRect(0, 0, ancho, alto);
    if (r) {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const R = (r.width / 2) * 0.93;
      const giro = t * 0.00006; // vuelta lenta una vez armado el anillo
      for (const p of particulas) {
        const avance = suave(Math.min(1, Math.max(0, (t - p.demora) / LLEGADA_MS)));
        const a = p.angulo + giro;
        const destinoX = cx + Math.cos(a) * R * p.radio;
        const destinoY = cy + Math.sin(a) * R * p.radio;
        const x = p.x0 * ancho + (destinoX - p.x0 * ancho) * avance;
        const y = p.y0 * alto + (destinoY - p.y0 * alto) * avance;
        const titileo = 0.55 + 0.45 * Math.sin(t * 0.003 + p.fase);
        ctx.fillStyle = `rgba(230, 207, 159, ${(avance < 1 ? 0.9 : titileo).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.tam, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    cuadro = requestAnimationFrame(dibujar);
  };
  cuadro = requestAnimationFrame(dibujar);

  return () => {
    cancelAnimationFrame(cuadro);
    window.removeEventListener("resize", ajustar);
  };
}
