import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { COOKIE_ADMIN, secreto } from "./token";
import { igualesSeguro, verificarPassword } from "./passwords";

const DURACION_SEG = 60 * 60 * 24 * 7;
/** Usuario de emergencia: entra con "admin" + ADMIN_PASSWORD (variable de Vercel) */
export const USUARIO_MAESTRO = "admin";

export interface Sesion {
  id: string;
  nombre: string;
  email: string;
  /** true = acceso de emergencia con ADMIN_PASSWORD */
  maestro: boolean;
}

/** Valida email/usuario y contraseña. Devuelve los datos para la sesión o null. */
export async function verificarCredenciales(
  usuario: string,
  password: string,
): Promise<{ sub: string; v: number } | null> {
  const u = usuario.trim().toLowerCase();
  if (!u || !password) return null;

  if (u === USUARIO_MAESTRO) {
    const real = process.env.ADMIN_PASSWORD;
    return real && igualesSeguro(password, real) ? { sub: USUARIO_MAESTRO, v: 0 } : null;
  }

  const admin = await prisma.administrador.findUnique({ where: { email: u } });
  if (!admin || !admin.activo || !(await verificarPassword(password, admin.passwordHash))) return null;
  await prisma.administrador.update({ where: { id: admin.id }, data: { ultimoIngreso: new Date() } });
  return { sub: admin.id, v: admin.version };
}

export async function crearSesion(datos: { sub: string; v: number }) {
  const token = await new SignJWT({ v: datos.v })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(datos.sub)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEG}s`)
    .sign(secreto());
  (await cookies()).set(COOKIE_ADMIN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SEG,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE_ADMIN);
}

/** Lee la sesión actual. Devuelve null si no hay, venció, o el usuario fue desactivado o cambió su contraseña. */
export async function getSesion(): Promise<Sesion | null> {
  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto());
    if (payload.sub === USUARIO_MAESTRO) {
      return { id: USUARIO_MAESTRO, nombre: "Administrador", email: USUARIO_MAESTRO, maestro: true };
    }
    if (!payload.sub) return null;
    const admin = await prisma.administrador.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.activo || admin.version !== payload.v) return null;
    return { id: admin.id, nombre: admin.nombre, email: admin.email, maestro: false };
  } catch {
    return null;
  }
}

/** Usar al inicio de cada server action / página del panel */
export async function requireAdmin(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion) redirect("/admin/login");
  return sesion;
}
