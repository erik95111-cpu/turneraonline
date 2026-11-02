/**
 * Fichas de clientas: cumpleaños, etiquetas, alta a mano. Los de base requieren TEST_DATABASE_URL.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Turno } from "@prisma/client";
import { diasParaCumple, edad, esNueva, eventosDelTurno, limpiarEtiqueta } from "./clientas";

describe("cumpleaños", () => {
  it("cuenta los días que faltan, y 0 si es hoy", () => {
    expect(diasParaCumple("1984-09-11", "2026-10-31")).toBe(315);
    expect(diasParaCumple("1990-10-31", "2026-10-31")).toBe(0);
    expect(diasParaCumple("1990-11-01", "2026-10-31")).toBe(1);
    expect(diasParaCumple("", "2026-10-31")).toBeNull();
  });

  it("los del 29 de febrero se festejan el 28 en años no bisiestos", () => {
    expect(diasParaCumple("2000-02-29", "2027-02-27")).toBe(1);
  });

  it("calcula la edad", () => {
    expect(edad("1984-09-11", "2026-10-31")).toBe(42);
    expect(edad("1984-11-11", "2026-10-31")).toBe(41);
  });
});

describe("etiquetas y estado", () => {
  it("limpia las etiquetas que escribe la profesional", () => {
    expect(limpiarEtiqueta("  prefiere   mañana ")).toBe("Prefiere mañana");
    expect(limpiarEtiqueta("   ")).toBe("");
  });

  it("es “Nueva” hasta la primera sesión realizada", () => {
    expect(esNueva([])).toBe(true);
    expect(esNueva([{ estado: "CONFIRMADO" }])).toBe(true);
    expect(esNueva([{ estado: "COMPLETADO" }])).toBe(false);
  });

  it("la línea de tiempo muestra seña y avisos por canal", () => {
    const t = {
      createdAt: new Date(), creadoPorAdmin: false, montoSena: 10000, estado: "CONFIRMADO", pagoEstado: "transferencia",
      avisarMail: true, confirmacionWaEn: new Date(), recordatorioEnviado: true, recordatorioWaEn: null,
    } as unknown as Turno;
    expect(eventosDelTurno(t).map((e) => [e.texto, e.canal ?? ""])).toEqual([
      ["Reservó desde la web", ""],
      ["Seña recibida", ""],
      ["Confirmación enviada", "Mail"],
      ["Confirmación enviada", "WhatsApp"],
      ["Recordatorio enviado", "Mail"],
    ]);
  });
});

const d = process.env.TEST_DATABASE_URL ? describe : describe.skip;

d("alta y edición de clientas", async () => {
  const { prisma } = await import("./db");
  const c = await import("./clientas");

  beforeEach(async () => {
    await prisma.turno.deleteMany();
    await prisma.notaClienta.deleteMany();
    await prisma.clienta.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("se carga a mano con nota inicial y sin mail", async () => {
    const nueva = await c.crearClienta({ nombre: "Julieta Cancelo", telefono: "+54 11 3932 5005", fechaNacimiento: "1984-09-11" }, "Piel sensible", "María");
    const guardada = await prisma.clienta.findUniqueOrThrow({ where: { id: nueva.id }, include: { registroNotas: true } });
    expect(guardada).toMatchObject({ email: null, whatsapp: "5491139325005", fechaNacimiento: "1984-09-11" });
    expect(guardada.registroNotas).toMatchObject([{ texto: "Piel sensible", autor: "María" }]);
  });

  it("no la duplica si ya existe ese WhatsApp (escrito distinto) o ese mail", async () => {
    const a = await c.crearClienta({ nombre: "Julieta", telefono: "11 3932-5005", email: "juli@example.com" });
    await expect(c.crearClienta({ nombre: "Juli", telefono: "+5491139325005" })).rejects.toMatchObject({ id: a.id });
    await expect(c.crearClienta({ nombre: "Juli", telefono: "1100000000", email: "JULI@example.com" })).rejects.toBeInstanceOf(c.ErrorClientaExistente);
  });

  it("valida la fecha de nacimiento y no deja usar un mail de otra clienta", async () => {
    await expect(c.crearClienta({ nombre: "Ana", telefono: "1111111111", fechaNacimiento: "2999-01-01" })).rejects.toThrow(/nacimiento/);
    const a = await c.crearClienta({ nombre: "Ana", telefono: "1111111111", email: "ana@example.com" });
    const b = await c.crearClienta({ nombre: "Bea", telefono: "1122222222" });
    await expect(c.actualizarClienta(b.id, { nombre: "Bea", telefono: "1122222222", email: "ana@example.com" })).rejects.toThrow(/otra clienta/);
    await c.actualizarClienta(a.id, { nombre: "Ana López", telefono: "11 15 3333-4444", direccion: "Calle 1" });
    expect(await prisma.clienta.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ nombre: "Ana López", whatsapp: "5491133334444", direccion: "Calle 1", email: null });
  });

  it("se borra una clienta cargada por error (con sus notas), pero no si tiene turnos", async () => {
    const a = await c.crearClienta({ nombre: "Error de carga", telefono: "1199999999" }, "nota");
    expect(await c.borrarClienta(a.id)).toBe("Error de carga");
    expect(await prisma.clienta.count({ where: { id: a.id } })).toBe(0);
    expect(await prisma.notaClienta.count({ where: { clientaId: a.id } })).toBe(0);

    const b = await c.crearClienta({ nombre: "Con historial", telefono: "1188888888" });
    const servicio = await prisma.servicio.create({ data: { nombre: "Prueba borrar", duracionMin: 30, precio: 1000 } });
    await prisma.turno.create({ data: { clientaId: b.id, servicioId: servicio.id, inicio: new Date(), fin: new Date(), precio: 1000 } });
    await expect(c.borrarClienta(b.id)).rejects.toThrow(/tiene 1 turno en su historial/);
    await prisma.turno.deleteMany({ where: { clientaId: b.id } });
    await prisma.servicio.delete({ where: { id: servicio.id } });
  });

  it("las etiquetas se ponen y se sacan tocándolas", async () => {
    const a = await c.crearClienta({ nombre: "Ana", telefono: "1111111111" });
    await c.alternarEtiqueta(a.id, "VIP");
    await c.alternarEtiqueta(a.id, " recomienda ");
    expect((await prisma.clienta.findUniqueOrThrow({ where: { id: a.id } })).etiquetas).toEqual(["VIP", "Recomienda"]);
    await c.alternarEtiqueta(a.id, "vip");
    expect((await prisma.clienta.findUniqueOrThrow({ where: { id: a.id } })).etiquetas).toEqual(["Recomienda"]);
  });
});
