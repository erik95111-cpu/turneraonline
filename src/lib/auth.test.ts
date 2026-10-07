import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword, igualesSeguro, verificarPassword } from "./passwords";

describe("contraseñas", () => {
  it("verifica la contraseña correcta y rechaza otras", async () => {
    const h = await hashPassword("clave-segura-123");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verificarPassword("clave-segura-123", h)).toBe(true);
    expect(await verificarPassword("clave-segura-124", h)).toBe(false);
    expect(await verificarPassword("", h)).toBe(false);
  });
  it("la misma contraseña genera hashes distintos (sal aleatoria)", async () => {
    expect(await hashPassword("abcdefgh")).not.toBe(await hashPassword("abcdefgh"));
  });
  it("rechaza hashes con formato inválido", async () => {
    expect(await verificarPassword("x", "texto-cualquiera")).toBe(false);
  });
  it("compara textos en tiempo constante", () => {
    expect(igualesSeguro("abc", "abc")).toBe(true);
    expect(igualesSeguro("abc", "abd")).toBe(false);
    expect(igualesSeguro("abc", "abcd")).toBe(false);
  });
});

const d = process.env.TEST_DATABASE_URL ? describe : describe.skip;

d("ingreso al panel", async () => {
  const { prisma } = await import("./db");
  const { verificarCredenciales } = await import("./auth");

  beforeAll(async () => {
    process.env.ADMIN_PASSWORD = "maestra-123";
    await prisma.administrador.deleteMany();
    await prisma.administrador.create({
      data: { nombre: "María", email: "maria@example.com", passwordHash: await hashPassword("jefa-1234") },
    });
    await prisma.administrador.create({
      data: { nombre: "Ex", email: "ex@example.com", passwordHash: await hashPassword("ex-12345"), activo: false },
    });
  });
  afterAll(async () => {
    await prisma.administrador.deleteMany();
    await prisma.$disconnect();
  });

  it("la jefa entra con su email y contraseña (sin importar mayúsculas del email)", async () => {
    const r = await verificarCredenciales("  Maria@Example.com ", "jefa-1234");
    expect(r?.sub).toBeTruthy();
    const a = await prisma.administrador.findUniqueOrThrow({ where: { email: "maria@example.com" } });
    expect(r?.sub).toBe(a.id);
    expect(a.ultimoIngreso).not.toBeNull();
  });
  it("rechaza contraseña incorrecta, usuario inexistente y usuarios desactivados", async () => {
    expect(await verificarCredenciales("maria@example.com", "otra-cosa")).toBeNull();
    expect(await verificarCredenciales("nadie@example.com", "jefa-1234")).toBeNull();
    expect(await verificarCredenciales("ex@example.com", "ex-12345")).toBeNull();
  });
  it("acceso de emergencia con usuario admin + ADMIN_PASSWORD", async () => {
    expect(await verificarCredenciales("admin", "maestra-123")).toEqual({ sub: "admin", v: 0 });
    expect(await verificarCredenciales("admin", "mal")).toBeNull();
  });
});
