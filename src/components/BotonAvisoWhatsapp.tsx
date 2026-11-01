"use client";

import { useState } from "react";
import { marcarAvisoWhatsapp } from "@/app/admin/acciones";

const TEXTOS = {
  confirmacion: ["Mandar confirmación por WhatsApp", "Confirmación enviada"],
  recordatorio: ["Mandar recordatorio por WhatsApp", "Recordatorio enviado"],
  cancelacion: ["Avisar la cancelación por WhatsApp", "Cancelación avisada"],
} as const;

/**
 * Abre el WhatsApp de la profesional con el mensaje ya escrito para la clienta
 * y deja anotado en el turno que se mandó (para no mandarlo dos veces).
 * En la confirmación se puede elegir si el mensaje lleva el precio.
 */
export function BotonAvisoWhatsapp(p: {
  href: string;
  /** Mismo mensaje con el precio (sólo confirmación) */
  hrefConPrecio?: string;
  /** La tarjeta con el logo, para descargarla y mandarla como foto */
  imagen?: string;
  turnoId: string;
  tipo: keyof typeof TEXTOS;
  enviadoEn?: string | null;
  destacado?: boolean;
}) {
  const [enviado, setEnviado] = useState(Boolean(p.enviadoEn));
  const [conPrecio, setConPrecio] = useState(false);
  const [pedir, hecho] = TEXTOS[p.tipo];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <a
        href={conPrecio && p.hrefConPrecio ? p.hrefConPrecio : p.href}
        target="_blank"
        rel="noopener"
        onClick={() => {
          setEnviado(true);
          if (p.tipo !== "cancelacion") void marcarAvisoWhatsapp(p.turnoId, p.tipo);
        }}
        className={enviado ? "btn-sec !text-emerald-800" : p.destacado ? "btn" : "btn-sec"}
        title={enviado ? "Tocá para volver a mandarlo" : undefined}
      >
        {enviado ? `✓ ${hecho}` : pedir}
      </a>
      {p.hrefConPrecio && (
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#6b635b]">
          <input type="checkbox" checked={conPrecio} onChange={(e) => setConPrecio(e.target.checked)} />
          Con precio
        </label>
      )}
      {p.imagen && (
        <a href={p.imagen} className="text-xs text-[#6b635b] underline underline-offset-2 hover:text-[#8a6d3b]" title="Descargá la tarjeta con el logo para mandarla como foto">
          Imagen
        </a>
      )}
    </span>
  );
}
