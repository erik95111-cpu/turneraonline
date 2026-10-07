import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pass: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const LARGO = 64;

/** Devuelve "scrypt$<sal>$<hash>" (base64) para guardar en la base */
export async function hashPassword(plano: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(plano, sal, LARGO);
  return `scrypt$${sal.toString("base64")}$${hash.toString("base64")}`;
}

export async function verificarPassword(plano: string, guardado: string): Promise<boolean> {
  const [alg, sal64, hash64] = guardado.split("$");
  if (alg !== "scrypt" || !sal64 || !hash64) return false;
  const esperado = Buffer.from(hash64, "base64");
  const calculado = await scrypt(plano, Buffer.from(sal64, "base64"), esperado.length);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/** Compara dos textos en tiempo constante */
export function igualesSeguro(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
