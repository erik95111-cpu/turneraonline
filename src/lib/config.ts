import { cache } from "react";
import { prisma } from "./db";

/** Configuración del negocio (se crea con valores por defecto si no existe) */
export const getConfig = cache(async () => {
  return prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
});

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
