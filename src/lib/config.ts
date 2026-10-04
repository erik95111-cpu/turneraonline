import { cache } from "react";
import { prisma } from "./db";

/** Configuración del negocio (se crea con valores por defecto si no existe) */
export const getConfig = cache(async () => {
  return prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
});

/** URL pública del sitio. En Vercel se toma sola del dominio de producción. */
export function siteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}
