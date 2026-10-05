/**
 * Las integraciones de base de datos de Vercel (Neon, Prisma Postgres, etc.) usan
 * nombres de variables distintos. Completamos los que espera Prisma.
 */
export function completarVariablesDB(env: NodeJS.ProcessEnv = process.env) {
  env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || "";
  env.DATABASE_URL_UNPOOLED ||= env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
}
