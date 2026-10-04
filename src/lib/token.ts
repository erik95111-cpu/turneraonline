import { jwtVerify } from "jose";

export const COOKIE_ADMIN = "hs_admin";

export function secreto() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("Falta AUTH_SECRET (mínimo 16 caracteres)");
  return new TextEncoder().encode(s);
}

export async function tokenValido(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secreto());
    return true;
  } catch {
    return false;
  }
}
