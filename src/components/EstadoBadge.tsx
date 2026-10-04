import type { EstadoTurno } from "@prisma/client";

const ESTILOS: Record<EstadoTurno, [string, string]> = {
  PENDIENTE_PAGO: ["Esperando pago", "bg-amber-100 text-amber-800"],
  CONFIRMADO: ["Confirmado", "bg-emerald-100 text-emerald-800"],
  COMPLETADO: ["Realizado", "bg-sky-100 text-sky-800"],
  AUSENTE: ["No vino", "bg-orange-100 text-orange-800"],
  CANCELADO: ["Cancelado", "bg-stone-200 text-stone-600"],
};

export function EstadoBadge({ estado }: { estado: EstadoTurno }) {
  const [txt, cls] = ESTILOS[estado];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{txt}</span>;
}
