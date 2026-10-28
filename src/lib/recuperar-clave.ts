import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { getConfig, siteUrl } from "./config";
import { enviarMail } from "./email";
import { hashPassword } from "./passwords";
import { mailClaveCambiada, mailRecuperarClave } from "./plantillas-email";

/** El link vence a la hora */
export const MINUTOS_VALIDEZ = 60;
/** Como mucho 3 mails por hora a la misma persona, para que no le llenen la casilla */
const MAXIMO_POR_HORA = 3;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * “Olvidé mi contraseña”: si el email es de un usuario activo, le manda un link para
 * elegir una nueva. No avisa si el email existe o no (para no dar pistas a nadie).
 */
export async function pedirRecuperacion(email: string): Promise<void> {
  const admin = await prisma.administrador.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!admin || !admin.activo) return;

  const haceUnaHora = new Date(Date.now() - 3_600_000);
  const recientes = await prisma.recuperacionClave.count({ where: { administradorId: admin.id, createdAt: { gt: haceUnaHora } } });
  if (recientes >= MAXIMO_POR_HORA) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.recuperacionClave.create({
    data: { administradorId: admin.id, tokenHash: hashToken(token), expiraEn: new Date(Date.now() + MINUTOS_VALIDEZ * 60_000) },
  });
  const link = `${siteUrl()}/admin/login/nueva?t=${token}`;
  await enviarMail(mailRecuperarClave(await getConfig(), admin, link, MINUTOS_VALIDEZ));
}

/** El link sirve si existe, no se usó, no venció y el usuario sigue activo */
export async function linkValido(token: string): Promise<boolean> {
  if (!token) return false;
  const r = await prisma.recuperacionClave.findUnique({ where: { tokenHash: hashToken(token) }, include: { administrador: true } });
  return Boolean(r && !r.usadoEn && r.expiraEn > new Date() && r.administrador.activo);
}

export class ErrorRecuperacion extends Error {}

/**
 * Cambia la contraseña con el link del mail. Cierra las sesiones abiertas en otros
 * dispositivos, anula los demás links pendientes y avisa por mail del cambio.
 */
export async function restablecerClave(token: string, nueva: string): Promise<{ sub: string; v: number }> {
  if (nueva.length < 8) throw new ErrorRecuperacion("La contraseña tiene que tener al menos 8 caracteres");
  const passwordHash = await hashPassword(nueva);
  const ahora = new Date();

  const admin = await prisma.$transaction(async (tx) => {
    // Condicional: el mismo link no se puede usar dos veces, ni aunque lo abran a la vez
    const r = await tx.recuperacionClave.findUnique({ where: { tokenHash: hashToken(token) } });
    const usado = r && (await tx.recuperacionClave.updateMany({
      where: { id: r.id, usadoEn: null, expiraEn: { gt: ahora } },
      data: { usadoEn: ahora },
    })).count;
    if (!r || !usado) throw new ErrorRecuperacion("El link venció o ya se usó. Pedí uno nuevo.");
    const a = await tx.administrador.findUniqueOrThrow({ where: { id: r.administradorId } });
    if (!a.activo) throw new ErrorRecuperacion("Este usuario está desactivado. Pedile a otra persona del panel que lo active.");
    await tx.recuperacionClave.updateMany({ where: { administradorId: a.id, usadoEn: null }, data: { usadoEn: ahora } });
    return tx.administrador.update({ where: { id: a.id }, data: { passwordHash, version: { increment: 1 } } });
  });

  await enviarMail(mailClaveCambiada(await getConfig(), admin));
  return { sub: admin.id, v: admin.version };
}
