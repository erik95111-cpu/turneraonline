import { z } from "zod";
import { prisma } from "./db";
import { ErrorReserva } from "./errores";

export const CATEGORIA_COMBOS = "Combos";

export const comboSchema = z.object({
  id: z.string().default(""),
  nombre: z.string().trim().min(2, "Poné un nombre al combo").max(80),
  descripcion: z.string().trim().max(500).default(""),
  incluye: z.array(z.string().min(1)).min(2, "Elegí al menos 2 tratamientos para el combo").max(8),
  precio: z.number().int().min(1, "Poné el precio del combo"),
  /** 0 = sumar sola la duración de los tratamientos */
  duracionMin: z.number().int().min(0).default(0),
  orden: z.number().int().default(0),
  activo: z.boolean().default(true),
});
export type DatosCombo = z.input<typeof comboSchema>;

/** Crea o actualiza un combo. La duración, si no se indica, es la suma de sus tratamientos. */
export async function guardarCombo(entrada: DatosCombo) {
  const r = comboSchema.safeParse(entrada);
  if (!r.success) throw new ErrorReserva(r.error.issues[0]?.message ?? "Datos inválidos");
  const d = r.data;
  const ids = [...new Set(d.incluye)];
  if (ids.length < 2) throw new ErrorReserva("Elegí al menos 2 tratamientos distintos para el combo");

  const tratamientos = await prisma.servicio.findMany({ where: { id: { in: ids }, esCombo: false } });
  if (tratamientos.length !== ids.length) throw new ErrorReserva("Un combo sólo puede incluir tratamientos sueltos (no otros combos)");
  const duracionMin = d.duracionMin >= 5 ? d.duracionMin : tratamientos.reduce((t, s) => t + s.duracionMin, 0);

  const data = {
    nombre: d.nombre,
    descripcion: d.descripcion,
    categoria: CATEGORIA_COMBOS,
    precio: d.precio,
    duracionMin,
    orden: d.orden,
    activo: d.activo,
    esCombo: true,
  };
  if (d.id) {
    const actual = await prisma.servicio.findUnique({ where: { id: d.id } });
    if (!actual?.esCombo) throw new ErrorReserva("Combo no encontrado");
    return prisma.servicio.update({ where: { id: d.id }, data: { ...data, incluye: { set: ids.map((id) => ({ id })) } } });
  }
  return prisma.servicio.create({ data: { ...data, incluye: { connect: ids.map((id) => ({ id })) } } });
}

/** “Higiene profunda + Celulitis” */
export function textoIncluye(c: { incluye?: { nombre: string }[] }): string {
  return (c.incluye ?? []).map((s) => s.nombre).join(" + ");
}

/** Cuánto saldría por separado y cuánto se ahorra */
export function ahorroCombo(c: { precio: number; incluye?: { precio: number }[] }): { separado: number; ahorro: number } {
  const separado = (c.incluye ?? []).reduce((t, s) => t + s.precio, 0);
  return { separado, ahorro: Math.max(0, separado - c.precio) };
}

/** Incluir en las consultas de servicios para mostrar el contenido del combo */
export const conIncluye = { incluye: { select: { id: true, nombre: true, precio: true, duracionMin: true }, orderBy: [{ orden: "asc" as const }, { nombre: "asc" as const }] } };

/** Tratamientos activos para reservar, con los combos primero y lo que incluye cada uno */
export async function serviciosParaReservar() {
  const lista = await prisma.servicio.findMany({
    where: { activo: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    include: conIncluye,
  });
  return [...lista.filter((s) => s.esCombo), ...lista.filter((s) => !s.esCombo)].map((s) => ({
    id: s.id,
    nombre: s.nombre,
    descripcion: s.descripcion,
    categoria: s.categoria,
    duracionMin: s.duracionMin,
    precio: s.precio,
    incluye: s.esCombo ? textoIncluye(s) : undefined,
    ahorro: s.esCombo ? ahorroCombo(s).ahorro : undefined,
  }));
}
