/**
 * ─── Freno a los ataques de fuerza bruta en el login ───────────
 *
 * Cada intento FALLIDO se anota en la tabla IntentoLogin con dos claves:
 *   "ip:<dirección>"     → frena a quien prueba muchas contraseñas desde una compu
 *   "usuario:<email>"    → frena a quien prueba muchas contraseñas contra una cuenta
 * Si se pasa del límite en los últimos 15 minutos, el login se rechaza sin
 * siquiera revisar la contraseña. Al entrar bien se borran sus intentos.
 *
 * Fallback: si la base no responde, NO bloqueamos (dejamos un aviso en el log);
 * mejor que la profesional pueda entrar a que quede afuera por un problema técnico.
 */
import "server-only";
import { prisma } from "./db";
import { logWarn } from "./log";

const VENTANA_MS = 15 * 60_000;
const MAX_POR_IP = 8;
const MAX_POR_USUARIO = 15;

function claves(ip: string, usuario: string) {
  return { ip: `ip:${ip || "desconocida"}`, usuario: `usuario:${usuario.trim().toLowerCase()}` };
}

/** true = hay demasiados intentos fallidos recientes: no dejar probar */
export async function loginBloqueado(ip: string, usuario: string): Promise<boolean> {
  const c = claves(ip, usuario);
  const desde = new Date(Date.now() - VENTANA_MS);
  try {
    const [porIp, porUsuario] = await Promise.all([
      prisma.intentoLogin.count({ where: { clave: c.ip, creadoEn: { gt: desde } } }),
      prisma.intentoLogin.count({ where: { clave: c.usuario, creadoEn: { gt: desde } } }),
    ]);
    return porIp >= MAX_POR_IP || porUsuario >= MAX_POR_USUARIO;
  } catch (err) {
    logWarn("login · no se pudo revisar el límite de intentos (se deja pasar)", err);
    return false;
  }
}

export async function registrarFallo(ip: string, usuario: string): Promise<void> {
  const c = claves(ip, usuario);
  try {
    await prisma.intentoLogin.createMany({ data: [{ clave: c.ip }, { clave: c.usuario }] });
    // Limpieza: borramos lo de más de un día para que la tabla no crezca
    await prisma.intentoLogin.deleteMany({ where: { creadoEn: { lt: new Date(Date.now() - 86_400_000) } } });
  } catch (err) {
    logWarn("login · no se pudo anotar el intento fallido", err);
  }
}

export async function limpiarFallos(ip: string, usuario: string): Promise<void> {
  const c = claves(ip, usuario);
  try {
    await prisma.intentoLogin.deleteMany({ where: { clave: { in: [c.ip, c.usuario] } } });
  } catch (err) {
    logWarn("login · no se pudieron borrar los intentos fallidos", err);
  }
}
