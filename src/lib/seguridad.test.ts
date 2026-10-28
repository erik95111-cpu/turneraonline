/**
 * Tests de seguridad:
 *  - clasificación de errores [APP] / [LIB:…]
 *  - RLS activado en TODAS las tablas (si alguien agrega una tabla sin RLS, este test falla)
 */
import { describe, expect, it } from "vitest";
import { ErrorApp, origenDelError } from "./log";

describe("origen de los errores", () => {
  it("distingue nuestro código de las bibliotecas", () => {
    expect(origenDelError(new ErrorApp("horario ocupado"))).toBe("APP");
    expect(origenDelError(Object.assign(new Error("db"), { name: "PrismaClientInitializationError" }))).toBe("LIB:prisma");
    expect(origenDelError(Object.assign(new Error("único"), { code: "P2002" }))).toBe("LIB:prisma");
    expect(origenDelError(Object.assign(new Error("vencido"), { code: "ERR_JWT_EXPIRED" }))).toBe("LIB:jose");
    expect(origenDelError(Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 }))).toBe("LIB:nodemailer");
    expect(origenDelError(new TypeError("Failed to fetch"))).toBe("LIB:red");
    expect(origenDelError(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe("LIB:red");
    const deLib = new Error("algo");
    deLib.stack = "Error: algo\n    at f (/app/node_modules/algo/index.js:1:1)";
    expect(origenDelError(deLib)).toBe("LIB:otra");
    expect(origenDelError(new Error("nuestro"))).toBe("APP");
  });
});

const d = process.env.TEST_DATABASE_URL ? describe : describe.skip;

d("base de datos", async () => {
  const { prisma } = await import("./db");

  it("todas las tablas tienen RLS activado", async () => {
    const tablas = await prisma.$queryRaw<{ tabla: string; rls: boolean }[]>`
      SELECT c.relname AS tabla, c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;
    expect(tablas.length).toBeGreaterThan(5);
    expect(tablas.filter((t) => !t.rls).map((t) => t.tabla)).toEqual([]);
  });

  it("el rol PUBLIC no tiene permisos sobre ninguna tabla", async () => {
    const permisos = await prisma.$queryRaw<{ tabla: string }[]>`
      SELECT table_name AS tabla FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = 'PUBLIC'`;
    expect(permisos).toEqual([]);
  });
});
