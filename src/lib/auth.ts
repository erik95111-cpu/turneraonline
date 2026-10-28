/**
 * ─── Sesiones del panel ───────────────────────────────────────
 *
 * Cómo funciona el ingreso:
 *  1. La persona escribe email + contraseña en /admin/login.
 *  2. `verificarCredenciales` las compara con la base (o con ADMIN_PASSWORD
 *     si el usuario es "admin").
 *  3. `crearSesion` guarda en el navegador una cookie "httpOnly" con un token
 *     firmado con AUTH_SECRET. httpOnly = el JavaScript de la página NO la puede
 *     leer, así que aunque alguien inyecte código no se la puede robar.
 *  4. En cada página del panel, `requireAdmin` lee la cookie, revisa la firma
 *     y que el usuario siga activo. Si algo falla → vuelve al login.
 *
 * AUTH_SECRET, ADMIN_PASSWORD y la base de datos existen SÓLO en el servidor.
 * La línea `import "server-only"` hace que el build falle si por error algún
 * componente del navegador intenta importar este archivo.
 */
import "server-only";
import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { COOKIE_ADMIN, secreto } from "./token";
import { igualesSeguro, verificarPassword } from "./passwords";

const DURACION_SEG = 60 * 60 * 24 * 7; // la sesión dura 7 días
/** Usuario de emergencia: entra con "admin" + ADMIN_PASSWORD (variable de Vercel) */
export const USUARIO_MAESTRO = "admin";

export interface Sesion {
  id: string;
  nombre: string;
  email: string;
  /** true = acceso de emergencia con ADMIN_PASSWORD */
  maestro: boolean;
}

/** Opciones de la cookie. Se usan iguales al crearla y al borrarla (si no, el navegador no la borra). */
const OPCIONES_COOKIE = {
  httpOnly: true, // el JavaScript del navegador no la puede leer
  secure: process.env.NODE_ENV === "production", // sólo viaja por https
  sameSite: "lax" as const, // otros sitios no pueden usarla para mandar formularios
  path: "/",
};

/**
 * "Huella" de ADMIN_PASSWORD que viaja dentro del token del usuario admin.
 * Si se cambia ADMIN_PASSWORD en Vercel, la huella cambia y todas las sesiones
 * de "admin" abiertas se cierran solas. Es un HMAC con AUTH_SECRET: con la
 * huella no se puede adivinar la contraseña.
 */
function huellaMaestra(): string {
  const pass = process.env.ADMIN_PASSWORD?.trim() ?? "";
  return createHmac("sha256", secreto()).update(`maestro:${pass}`).digest("base64url").slice(0, 22);
}

/** Valida email/usuario y contraseña. Devuelve los datos para la sesión o null. */
export async function verificarCredenciales(
  usuario: string,
  password: string,
): Promise<{ sub: string; v: number } | null> {
  const u = usuario.trim().toLowerCase();
  if (!u || !password) return null;

  if (u === USUARIO_MAESTRO) {
    // trim: en el celular es fácil que quede un espacio de más al cargarla en Vercel
    const real = process.env.ADMIN_PASSWORD?.trim();
    return real && igualesSeguro(password.trim(), real) ? { sub: USUARIO_MAESTRO, v: 0 } : null;
  }

  const admin = await prisma.administrador.findUnique({ where: { email: u } });
  if (!admin || !admin.activo || !(await verificarPassword(password, admin.passwordHash))) return null;
  await prisma.administrador.update({ where: { id: admin.id }, data: { ultimoIngreso: new Date() } });
  return { sub: admin.id, v: admin.version };
}

export async function crearSesion(datos: { sub: string; v: number }) {
  const claims = datos.sub === USUARIO_MAESTRO ? { v: datos.v, h: huellaMaestra() } : { v: datos.v };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(datos.sub)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEG}s`)
    .sign(secreto());
  (await cookies()).set(COOKIE_ADMIN, token, { ...OPCIONES_COOKIE, maxAge: DURACION_SEG });
}

/**
 * Cierra la sesión en ESTE navegador: pisa la cookie con una vacía que vence
 * en el acto. Se usan las mismas opciones con las que se creó; si el path o el
 * dominio no coinciden, el navegador la conserva y la sesión "no se cierra".
 */
export async function cerrarSesion() {
  (await cookies()).set(COOKIE_ADMIN, "", { ...OPCIONES_COOKIE, maxAge: 0, expires: new Date(0) });
}

/**
 * Lee la sesión actual. Devuelve null si no hay, venció, o el usuario fue desactivado o cambió su contraseña.
 * cache(): si el layout y la página la piden en la misma carga, se consulta la base una sola vez.
 */
export const getSesion = cache(async (): Promise<Sesion | null> => {
  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto());
    if (payload.sub === USUARIO_MAESTRO) {
      // Si cambiaron (o borraron) ADMIN_PASSWORD, la huella ya no coincide → sesión cerrada
      if (!process.env.ADMIN_PASSWORD?.trim() || payload.h !== huellaMaestra()) return null;
      return { id: USUARIO_MAESTRO, nombre: "Administrador", email: USUARIO_MAESTRO, maestro: true };
    }
    if (!payload.sub) return null;
    const admin = await prisma.administrador.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.activo || admin.version !== payload.v) return null;
    return { id: admin.id, nombre: admin.nombre, email: admin.email, maestro: false };
  } catch {
    // Token vencido, adulterado o base caída: tratamos como "sin sesión" (vuelve al login)
    return null;
  }
});

/** Usar al inicio de cada server action / página del panel */
export async function requireAdmin(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion) redirect("/admin/login");
  return sesion;
}
