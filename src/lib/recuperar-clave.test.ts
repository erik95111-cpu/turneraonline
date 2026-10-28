/**
 * “Olvidé mi contraseña” contra PostgreSQL. Requiere TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mails = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
vi.mock("./email", () => ({
  enviarMail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    mails.push(m);
    return true;
  }),
}));

const d = process.env.TEST_DATABASE_URL ? describe : describe.skip;

d("recuperar contraseña del panel", async () => {
  const { prisma } = await import("./db");
  const r = await import("./recuperar-clave");
  const { verificarCredenciales } = await import("./auth");
  const { hashPassword } = await import("./passwords");

  let id: string;
  const tokenDelMail = () => /t=([\w-]+)/.exec(mails.at(-1)!.text)![1];

  beforeAll(async () => {
    await prisma.recuperacionClave.deleteMany();
    await prisma.administrador.deleteMany();
    await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  });

  beforeEach(async () => {
    await prisma.recuperacionClave.deleteMany();
    await prisma.administrador.deleteMany();
    id = (await prisma.administrador.create({
      data: { nombre: "María C.", email: "maria@ejemplo.com", passwordHash: await hashPassword("vieja-1234") },
    })).id;
    mails.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("manda el link al email del usuario (sin importar mayúsculas)", async () => {
    await r.pedirRecuperacion("  Maria@Ejemplo.com ");
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("maria@ejemplo.com");
    expect(mails[0].text).toContain("/admin/login/nueva?t=");
    expect(await r.linkValido(tokenDelMail())).toBe(true);
    // En la base no queda el código, sólo su hash
    const guardado = await prisma.recuperacionClave.findFirstOrThrow();
    expect(guardado.tokenHash).not.toBe(tokenDelMail());
  });

  it("con un email que no existe o un usuario desactivado no manda nada", async () => {
    await r.pedirRecuperacion("nadie@ejemplo.com");
    await prisma.administrador.update({ where: { id }, data: { activo: false } });
    await r.pedirRecuperacion("maria@ejemplo.com");
    expect(mails).toHaveLength(0);
  });

  it("cambia la contraseña, cierra las otras sesiones y avisa por mail", async () => {
    await r.pedirRecuperacion("maria@ejemplo.com");
    const token = tokenDelMail();
    const antes = await prisma.administrador.findUniqueOrThrow({ where: { id } });
    const sesion = await r.restablecerClave(token, "nueva-5678");
    expect(sesion).toEqual({ sub: id, v: antes.version + 1 });
    expect(await verificarCredenciales("maria@ejemplo.com", "vieja-1234")).toBeNull();
    expect(await verificarCredenciales("maria@ejemplo.com", "nueva-5678")).not.toBeNull();
    expect(mails.at(-1)!.subject).toMatch(/Se cambió tu contraseña/);
  });

  it("el link sirve una sola vez", async () => {
    await r.pedirRecuperacion("maria@ejemplo.com");
    const token = tokenDelMail();
    await r.restablecerClave(token, "nueva-5678");
    expect(await r.linkValido(token)).toBe(false);
    await expect(r.restablecerClave(token, "otra-9999")).rejects.toThrow(/venció o ya se usó/);
  });

  it("al usar un link se anulan los otros que se habían pedido", async () => {
    await r.pedirRecuperacion("maria@ejemplo.com");
    const primero = tokenDelMail();
    await r.pedirRecuperacion("maria@ejemplo.com");
    await r.restablecerClave(tokenDelMail(), "nueva-5678");
    expect(await r.linkValido(primero)).toBe(false);
  });

  it("vence a la hora", async () => {
    await r.pedirRecuperacion("maria@ejemplo.com");
    await prisma.recuperacionClave.updateMany({ data: { expiraEn: new Date(Date.now() - 1000) } });
    await expect(r.restablecerClave(tokenDelMail(), "nueva-5678")).rejects.toThrow(/venció/);
  });

  it("pide al menos 8 caracteres y no acepta links inventados", async () => {
    await r.pedirRecuperacion("maria@ejemplo.com");
    await expect(r.restablecerClave(tokenDelMail(), "corta")).rejects.toThrow(/8 caracteres/);
    await expect(r.restablecerClave("inventado", "nueva-5678")).rejects.toThrow(/venció o ya se usó/);
    expect(await r.linkValido("")).toBe(false);
  });

  it("como mucho 3 mails por hora a la misma persona", async () => {
    for (let i = 0; i < 5; i++) await r.pedirRecuperacion("maria@ejemplo.com");
    expect(mails).toHaveLength(3);
  });
});
