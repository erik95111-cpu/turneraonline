import { SignJWT } from "jose";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_ADMIN, secreto, tokenValido } from "./token";

const DURACION_SEG = 60 * 60 * 24 * 7;

export function passwordCorrecta(intento: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const a = Buffer.from(intento);
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function crearSesion() {
  const token = await new SignJWT({ rol: "admin" })
    .setProtectedHeader({ alg: "HS256" })
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

/** Usar al inicio de cada server action / página del panel */
export async function requireAdmin() {
  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
  if (!(await tokenValido(token))) redirect("/admin/login");
}
