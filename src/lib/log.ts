/**
 * ─── Registro de errores y avisos ───────────────────────────────
 *
 * Cada mensaje que sale en la consola (o en Vercel → Logs) empieza con una
 * etiqueta que dice DE DÓNDE viene el problema:
 *
 *   [APP]              → error de NUESTRO código (lógica de turnos, validaciones…)
 *   [LIB:prisma]       → la base de datos (Prisma / PostgreSQL / Neon)
 *   [LIB:nodemailer]   → el envío de mails (Gmail / SMTP)
 *   [LIB:jose]         → los tokens de sesión (JWT)
 *   [LIB:red]          → se cortó la conexión (internet, servidor caído)
 *   [LIB:otra]         → cualquier otra biblioteca externa (node_modules)
 *
 * y después el nivel:  [ERROR] algo falló · [WARN] algo raro pero se siguió.
 *
 * Ejemplo en Vercel → Logs:
 *   [LIB:prisma][ERROR] reserva · Can't reach database server …
 *   → el problema es la base, no el código: revisar Neon / DATABASE_URL.
 *
 * Este archivo no importa nada del servidor, así que también se puede usar
 * desde componentes del navegador (los mensajes salen en la consola del navegador).
 */

export type Origen = "APP" | "LIB:prisma" | "LIB:nodemailer" | "LIB:jose" | "LIB:red" | "LIB:otra";

/** Error "esperado" de nuestro código (ej: "Ese horario ya no está disponible") */
export class ErrorApp extends Error {
  override name = "ErrorApp";
}

/** Mira el error y decide si viene de nuestro código o de una biblioteca */
export function origenDelError(err: unknown): Origen {
  if (err instanceof ErrorApp) return "APP";
  if (!(err instanceof Error)) return "APP";

  const e = err as Error & { code?: unknown; responseCode?: unknown; command?: unknown };
  const code = typeof e.code === "string" ? e.code : "";

  // Prisma: sus errores se llaman PrismaClient… y los códigos son P1001, P2002, etc.
  if (e.name.startsWith("PrismaClient") || /^P\d{4}$/.test(code)) return "LIB:prisma";
  // jose (JWT): códigos ERR_JWT_EXPIRED, ERR_JWS_SIGNATURE_VERIFICATION_FAILED…
  if (code.startsWith("ERR_JW")) return "LIB:jose";
  // nodemailer: trae responseCode (respuesta SMTP) o códigos EAUTH / EENVELOPE / EMESSAGE
  if (e.responseCode !== undefined || e.command !== undefined || /^E(AUTH|ENVELOPE|MESSAGE|SOCKET|CONNECTION|DNS|TLS)$/.test(code)) {
    return "LIB:nodemailer";
  }
  // Problemas de red (navegador: "Failed to fetch"; Node: ECONNRESET, ETIMEDOUT…)
  if (/^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)$/.test(code) || /failed to fetch|network ?error|load failed/i.test(e.message)) {
    return "LIB:red";
  }
  // Último recurso: si el error nació dentro de node_modules, es de una biblioteca
  const primeraLinea = e.stack?.split("\n").find((l) => l.trim().startsWith("at "));
  if (primeraLinea?.includes("node_modules")) return "LIB:otra";
  return "APP";
}

/** Texto del error en una sola línea (Prisma, por ejemplo, arranca sus mensajes con saltos de línea) */
function mensaje(err: unknown): string {
  const texto = err instanceof Error ? err.message : typeof err === "string" ? err : String(JSON.stringify(err));
  return texto.replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * Registra un ERROR.
 * @param donde  qué estaba haciendo la página (ej: "reserva", "login", "cron")
 * @param err    el error capturado
 * @returns      el origen detectado, por si se quiere mostrar un mensaje distinto
 */
export function logError(donde: string, err: unknown): Origen {
  const origen = origenDelError(err);
  console.error(`[${origen}][ERROR] ${donde} · ${mensaje(err)}`, err);
  return origen;
}

/** Registra un AVISO: algo no salió como se esperaba pero la página siguió funcionando */
export function logWarn(donde: string, detalle?: unknown, origen?: Origen): void {
  const o = origen ?? (detalle instanceof Error ? origenDelError(detalle) : "APP");
  console.warn(`[${o}][WARN] ${donde}${detalle === undefined ? "" : ` · ${mensaje(detalle)}`}`);
}
