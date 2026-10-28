"use client";

import { useState, useTransition } from "react";
import { cancelarPorClienta } from "@/app/actions/reservas";
import { logError } from "@/lib/log";

export function BotonCancelar({ turnoId, token }: { turnoId: string; token: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, start] = useTransition();

  if (!confirmar) {
    return (
      <button type="button" onClick={() => setConfirmar(true)} className="text-sm text-piedra underline underline-offset-4 hover:text-cream">
        Cancelar turno
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-linea p-4 text-sm">
      <p>¿Seguro que querés cancelar este turno?</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pendiente}
          onClick={() => start(async () => {
            try {
              const r = await cancelarPorClienta(turnoId, token);
              if (r.error) setError(r.error);
            } catch (err) {
              // Fallback: sin conexión o servidor caído. El turno NO se canceló.
              logError("cancelar turno (navegador)", err);
              setError("No pudimos cancelar el turno. Revisá tu conexión y probá de nuevo, o escribinos por WhatsApp.");
            }
          })}
          className="rounded-full bg-red-500/80 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50"
        >
          {pendiente ? "Cancelando…" : "Sí, cancelar"}
        </button>
        <button type="button" onClick={() => setConfirmar(false)} className="rounded-full border border-linea px-4 py-2">
          No, mantener
        </button>
      </div>
      {error && <p className="mt-3 text-red-400">{error}</p>}
    </div>
  );
}
