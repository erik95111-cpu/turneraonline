/**
 * Chequeo de seguridad que corre DESPUÉS de compilar (en Vercel y en GitHub).
 *
 * Busca el valor real de cada variable secreta dentro de .next/static, que es
 * la carpeta con los archivos que se descargan al navegador. Si encuentra
 * alguno, corta el deploy: mejor un deploy fallido que una clave publicada.
 *
 * Uso: node scripts/verificar-secretos.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SECRETAS = [
  "AUTH_SECRET",
  "ADMIN_PASSWORD",
  "CRON_SECRET",
  "SMTP_PASS",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PASSWORD",
];
const CARPETA = ".next/static";

/** Todos los archivos de una carpeta (y subcarpetas) */
function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : [p];
  });
}

// Valores muy cortos (ej: "ci" en los tests) aparecerían por casualidad: no se buscan
const buscar = SECRETAS.map((nombre) => ({ nombre, valor: process.env[nombre]?.trim() ?? "" })).filter((s) => s.valor.length >= 8);

let lista;
try {
  lista = archivos(CARPETA);
} catch {
  console.error(`[APP][ERROR] verificar-secretos · no existe ${CARPETA}: correr después de "next build"`);
  process.exit(1);
}

const filtrados = [];
for (const archivo of lista) {
  const contenido = readFileSync(archivo, "utf8");
  for (const s of buscar) {
    if (contenido.includes(s.valor)) filtrados.push(`${s.nombre} → ${archivo}`);
  }
}

if (filtrados.length) {
  console.error("[APP][ERROR] verificar-secretos · ¡Hay claves dentro de los archivos del navegador!");
  for (const f of filtrados) console.error("   ", f);
  process.exit(1);
}
console.log(`verificar-secretos · OK: ${buscar.length} claves revisadas en ${lista.length} archivos del navegador, ninguna expuesta.`);
