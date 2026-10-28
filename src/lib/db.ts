// Conexión a la base. "server-only": si un componente del navegador lo importara,
// el build falla en vez de intentar mandar la base al navegador.
import "server-only";
import { PrismaClient } from "@prisma/client";
import { completarVariablesDB } from "./env-db";

completarVariablesDB();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
