import type { TipoSena } from "@prisma/client";

export function calcularSena(precio: number, tipo: TipoSena, valor: number): number {
  if (tipo === "NINGUNA" || valor <= 0) return 0;
  if (tipo === "FIJO") return Math.min(valor, precio);
  // Redondeado a la centena para que quede un monto prolijo
  return Math.min(precio, Math.round((precio * Math.min(valor, 100)) / 100 / 100) * 100);
}

/** La seña se pide sólo si hay monto configurado y un WhatsApp donde coordinar el pago */
export function pideSena(cfg: { senaTipo: TipoSena; senaValor: number; whatsapp: string }): boolean {
  return cfg.senaTipo !== "NINGUNA" && cfg.senaValor > 0 && Boolean(cfg.whatsapp.trim());
}
