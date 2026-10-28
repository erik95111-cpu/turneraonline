/**
 * Combos / packs contra PostgreSQL. Requiere TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ahorroCombo, textoIncluye } from "./combos";

const mails = vi.hoisted(() => [] as { to: string; html: string }[]);
vi.mock("./email", () => ({
  enviarMail: vi.fn(async (m: { to: string; html: string }) => {
    mails.push(m);
    return true;
  }),
}));

describe("cálculos del combo", () => {
  it("texto de lo que incluye y ahorro frente a por separado", () => {
    const c = { precio: 60000, incluye: [{ nombre: "Higiene", precio: 47000 }, { nombre: "Celulitis", precio: 24000 }] };
    expect(textoIncluye(c)).toBe("Higiene + Celulitis");
    expect(ahorroCombo(c)).toEqual({ separado: 71000, ahorro: 11000 });
    expect(ahorroCombo({ precio: 90000, incluye: c.incluye }).ahorro).toBe(0);
  });
});

const d = process.env.TEST_DATABASE_URL ? describe : describe.skip;

d("combos", async () => {
  const { prisma } = await import("./db");
  const c = await import("./combos");
  const t = await import("./turnos");
  const { fechaISO, sumarDias, diaSemana } = await import("./tiempo");

  let sabado = sumarDias(fechaISO(new Date()), 2);
  while (diaSemana(sabado) !== 6) sabado = sumarDias(sabado, 1);
  let facial: string;
  let corporal: string;

  beforeAll(async () => {
    await prisma.turno.deleteMany();
    await prisma.giftCard.deleteMany();
    await prisma.clienta.deleteMany();
    await prisma.servicio.deleteMany();
    await prisma.horarioAtencion.deleteMany();
    await prisma.bloqueo.deleteMany();
    await prisma.configuracion.deleteMany();
    await prisma.configuracion.create({ data: { id: 1, emailProfesional: "pro@example.com", whatsapp: "" } });
    await prisma.horarioAtencion.create({ data: { diaSemana: 6, horaInicio: "09:00", horaFin: "13:00" } });
    facial = (await prisma.servicio.create({ data: { nombre: "Higiene profunda", duracionMin: 60, precio: 47000 } })).id;
    corporal = (await prisma.servicio.create({ data: { nombre: "Celulitis", duracionMin: 30, precio: 24000, categoria: "Corporales" } })).id;
  });

  beforeEach(async () => {
    await prisma.turno.deleteMany();
    await prisma.servicio.deleteMany({ where: { esCombo: true } });
    mails.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("se crea con el precio elegido y la duración sumada", async () => {
    const combo = await c.guardarCombo({ nombre: "Pack Glow", incluye: [facial, corporal], precio: 60000 });
    expect(combo).toMatchObject({ esCombo: true, categoria: "Combos", precio: 60000, duracionMin: 90 });
    const conLista = await prisma.servicio.findUniqueOrThrow({ where: { id: combo.id }, include: { incluye: true } });
    expect(conLista.incluye.map((s) => s.nombre).sort()).toEqual(["Celulitis", "Higiene profunda"]);
  });

  it("la duración se puede ajustar a mano", async () => {
    const combo = await c.guardarCombo({ nombre: "Pack express", incluye: [facial, corporal], precio: 60000, duracionMin: 75 });
    expect(combo.duracionMin).toBe(75);
  });

  it("pide al menos 2 tratamientos distintos y no acepta combos dentro de combos", async () => {
    await expect(c.guardarCombo({ nombre: "Solo uno", incluye: [facial], precio: 1000 })).rejects.toThrow(/al menos 2/);
    await expect(c.guardarCombo({ nombre: "Repetido", incluye: [facial, facial], precio: 1000 })).rejects.toThrow(/al menos 2/);
    const combo = await c.guardarCombo({ nombre: "Pack", incluye: [facial, corporal], precio: 60000 });
    await expect(c.guardarCombo({ nombre: "Mega", incluye: [combo.id, facial], precio: 1000 })).rejects.toThrow(/no otros combos/);
  });

  it("al editar se reemplaza lo que incluye", async () => {
    const extra = await prisma.servicio.create({ data: { nombre: "Ondas rusas", duracionMin: 40, precio: 24000 } });
    const combo = await c.guardarCombo({ nombre: "Pack", incluye: [facial, corporal], precio: 60000 });
    await c.guardarCombo({ id: combo.id, nombre: "Pack corporal", incluye: [corporal, extra.id], precio: 40000 });
    const editado = await prisma.servicio.findUniqueOrThrow({ where: { id: combo.id }, include: { incluye: true } });
    expect(editado.nombre).toBe("Pack corporal");
    expect(editado.duracionMin).toBe(70);
    expect(editado.incluye.map((s) => s.nombre).sort()).toEqual(["Celulitis", "Ondas rusas"]);
    await prisma.servicio.delete({ where: { id: extra.id } });
  });

  it("se reserva como un turno: ocupa su duración, cobra su precio y el mail dice qué incluye", async () => {
    const combo = await c.guardarCombo({ nombre: "Pack Glow", incluye: [facial, corporal], precio: 60000 });
    const libres = await t.horariosDisponibles(combo.id, sabado);
    expect(libres).toContain("11:30");
    expect(libres).not.toContain("12:00"); // 90 min no entran antes de las 13
    const r = await t.crearReserva({ servicioId: combo.id, fecha: sabado, hora: "09:00", nombre: "Ana", email: "ana@example.com", telefono: "1122223333", notas: "" });
    const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
    expect(turno.precio).toBe(60000);
    expect(turno.fin.getTime() - turno.inicio.getTime()).toBe(90 * 60_000);
    expect(mails.find((m) => m.to === "ana@example.com")?.html).toMatch(/Incluye.*(Higiene profunda|Celulitis)/s);
  });

  it("los combos aparecen primero para reservar, con lo que incluyen y el ahorro", async () => {
    await c.guardarCombo({ nombre: "Pack Glow", incluye: [facial, corporal], precio: 60000 });
    const lista = await c.serviciosParaReservar();
    expect(lista[0]).toMatchObject({ nombre: "Pack Glow", ahorro: 11000 });
    expect(lista[0].incluye).toContain(" + ");
    expect(lista.find((s) => s.id === facial)?.incluye).toBeUndefined();
  });
});
