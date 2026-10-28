"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Fase = "quieta" | "cubre" | "tapada" | "descubre";

const ENTRA_MS = 450;
const SALE_MS = 550;
const MAXIMO_TAPADA_MS = 4000; // si la página tarda, igual destapamos

/**
 * Transición entre páginas: una cortina dorada con el logo cruza la pantalla.
 * Intercepta los clics en links internos que cambian de página; los anclas
 * (#tratamientos) y los links externos siguen funcionando normal.
 */
export function CortinaDorada() {
  const router = useRouter();
  const ruta = usePathname();
  const [fase, setFase] = useState<Fase>("quieta");
  const destino = useRef<string | null>(null);

  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!(e.target instanceof Element)) return;
      const a = e.target.closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (url.pathname.startsWith("/admin") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // En captura: llegamos antes que el <Link> de Next y frenamos su navegación
      e.preventDefault();
      e.stopPropagation();
      destino.current = url.pathname;
      setFase("cubre");
      window.setTimeout(() => {
        setFase("tapada");
        router.push(url.pathname + url.search + url.hash);
      }, ENTRA_MS);
    };
    document.addEventListener("click", alClic, true);
    return () => document.removeEventListener("click", alClic, true);
  }, [router]);

  // La página nueva ya está: corremos la cortina hacia el otro lado
  useEffect(() => {
    if (fase === "tapada" && ruta === destino.current) {
      destino.current = null;
      setFase("descubre");
    }
  }, [fase, ruta]);

  useEffect(() => {
    if (fase === "descubre") {
      const t = window.setTimeout(() => setFase("quieta"), SALE_MS);
      return () => window.clearTimeout(t);
    }
    if (fase === "tapada") {
      const t = window.setTimeout(() => setFase("descubre"), MAXIMO_TAPADA_MS);
      return () => window.clearTimeout(t);
    }
  }, [fase]);

  if (fase === "quieta") return null;
  return (
    <div className={`cortina cortina-${fase}`} aria-hidden="true">
      <Image src="/logo.png" alt="" width={120} height={120} className="cortina-logo" priority />
    </div>
  );
}
