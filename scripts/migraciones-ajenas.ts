/**
 * Antes de migrar: si la base tiene una migración FALLIDA que no existe en este
 * código (por ejemplo la dejó una vista previa de otra rama que usa la misma
 * base), la marca como deshecha para que no bloquee el deploy (error P3009).
 * Las migraciones fallidas que sí son de este código no se tocan: ésas hay que revisarlas.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const existe = await prisma.$queryRaw<{ ok: boolean }[]>`SELECT to_regclass('_prisma_migrations') IS NOT NULL AS ok`;
    if (!existe[0]?.ok) return;
    const fallidas = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
    for (const { migration_name: nombre } of fallidas) {
      if (existsSync(`prisma/migrations/${nombre}`)) continue;
      console.log(`Migración fallida ajena a este código: ${nombre} → se marca como deshecha`);
      execFileSync("npx", ["prisma", "migrate", "resolve", "--rolled-back", nombre], { stdio: "inherit" });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
