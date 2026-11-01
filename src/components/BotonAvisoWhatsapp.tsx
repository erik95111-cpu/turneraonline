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
 */
export function BotonAvisoWhatsapp(p: {
  href: string;
  turnoId: string;
  tipo: keyof typeof TEXTOS;
  enviadoEn?: string | null;
  destacado?: boolean;
}) {
  const [enviado, setEnviado] = useState(Boolean(p.enviadoEn));
  const [pedir, hecho] = TEXTOS[p.tipo];
  return (
    <a
      href={p.href}
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
  );
}
