/**
 * Gift cards: códigos (unitarios) y circuito completo contra PostgreSQL
 * (pedido → pago → reserva → cancelación). Los de base requieren TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularVencimiento, estadoVisible, generarCodigo, normalizarCodigo } from "./giftcards";
import { fechaISO } from "./tiempo";

const mails = vi.hoisted(() => [] as { to: string; subject: string }[]);
vi.mock("./email", () => ({
  enviarMail: vi.fn(async (m: { to: string; subject: string }) => {
    mails.push({ to: m.to, subject: m.subject });
    return true;
  }),
}));

describe("códigos de gift card", () => {
  it("tienen el formato HS- más 6 caracteres sin letras confusas", () => {
    for (let i = 0; i < 200; i++) expect(generarCodigo()).toMatch(/^HS-[A-HJ-NP-Z2-9]{6}$/);
  });

  it("se normalizan como los escriba la clienta", () => {
    expect(normalizarCodigo("hs-7k2m9q")).toBe("HS-7K2M9Q");
    expect(normalizarCodigo(" HS 7K2M9Q ")).toBe("HS-7K2M9Q");
    expect(normalizarCodigo("7k2m9q")).toBe("HS-7K2M9Q");
    expect(normalizarCodigo("")).toBe("");
  });

  it("vencen a los N meses, al final del día (hora Argentina)", () => {
    const v = calcularVencimiento(new Date("2026-10-28T15:00:00Z"), 2);
    expect(fechaISO(v)).toBe("2026-12-28");
    expect(v.toISOString()).toBe("2026-12-29T02:59:00.000Z");
    // 31 de diciembre + 2 meses → último día de febrero
    expect(fechaISO(calcularVencimiento(new Date("2026-12-31T15:00:00Z"), 2))).toBe("2027-02-28");
  });

  it("una activa con fecha pasada se ve como vencida", () => {
    const ayer = new Date(Date.now() - 86_400_000);
    expect(estadoVisible({ estado: "ACTIVA", venceEn: ayer })).toBe("VENCIDA");
    expect(estadoVisible({ estado: "ACTIVA", venceEn: new Date(Date.now() + 86_400_000) })).toBe("ACTIVA");
    expect(estadoVisible({ estado: "USADA", venceEn: ayer })).toBe("USADA");
  });
});

const conDB = Boolean(process.env.TEST_DATABASE_URL);
const d = conDB ? describe : describe.skip;

d("circuito de gift cards", async () => {
  const { prisma } = await import("./db");
  const g = await import("./giftcards");
  const t = await import("./turnos");
  const { sumarDias, diaSemana } = await import("./tiempo");

  let sabado = sumarDias(fechaISO(new Date()), 2);
  while (diaSemana(sabado) !== 6) sabado = sumarDias(sabado, 1);

  let facial: string; // $47.000
  let corporal: string; // $24.000

  const pedido = (extra: Partial<Parameters<typeof g.crearGiftCard>[0]> = {}) => ({
    servicioId: "",
    para: "Sofía",
    de: "Lucía",
    mensaje: "¡Feliz cumple!",
    email: "lucia@example.com",
    telefono: "1155554444",
    ...extra,
  });
  const reserva = (extra: Partial<Parameters<typeof t.crearReserva>[0]> = {}) => ({
    servicioId: facial,
    fecha: sabado,
    hora: "10:00",
    nombre: "Sofía Pérez",
    email: "sofia@example.com",
    telefono: "1166667777",
    notas: "",
    ...extra,
  });
  /** Pedido + pago */
  const activa = async (extra: Partial<Parameters<typeof g.crearGiftCard>[0]> = {}) => {
    const p = await g.crearGiftCard(pedido(extra));
    await g.activarGiftCard(p.id);
    return prisma.giftCard.findUniqueOrThrow({ where: { id: p.id } });
  };

  beforeAll(async () => {
    await prisma.turno.deleteMany();
    await prisma.giftCard.deleteMany();
    await prisma.clienta.deleteMany();
    await prisma.servicio.deleteMany();
    await prisma.horarioAtencion.deleteMany();
    await prisma.bloqueo.deleteMany();
    await prisma.configuracion.deleteMany();
    await prisma.configuracion.create({
      data: { id: 1, senaTipo: "FIJO", senaValor: 10000, emailProfesional: "pro@example.com", whatsapp: "11 6405-2481" },
    });
    await prisma.horarioAtencion.create({ data: { diaSemana: 6, horaInicio: "09:00", horaFin: "18:00" } });
    facial = (await prisma.servicio.create({ data: { nombre: "Higiene profunda", duracionMin: 60, precio: 47000 } })).id;
    corporal = (await prisma.servicio.create({ data: { nombre: "Celulitis", duracionMin: 30, precio: 24000 } })).id;
  });

  beforeEach(async () => {
    await prisma.turno.deleteMany();
    await prisma.giftCard.deleteMany();
    mails.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("el pedido web queda esperando el pago y avisa a quien compra y a la profesional", async () => {
    const p = await g.crearGiftCard(pedido());
    expect(p.estado).toBe("PENDIENTE_PAGO");
    expect(p.monto).toBe(50000);
    expect(p.saldo).toBe(50000);
    expect(p.venceEn).toBeNull();
    expect(mails.map((m) => m.to).sort()).toEqual(["lucia@example.com", "pro@example.com"]);
  });

  it("la de tratamiento toma el precio del tratamiento", async () => {
    const p = await g.crearGiftCard(pedido({ servicioId: corporal }));
    expect(p.monto).toBe(24000);
    expect(p.servicioId).toBe(corporal);
  });

  it("al marcar el pago queda activa por 2 meses y se manda por mail", async () => {
    const p = await g.crearGiftCard(pedido());
    mails.length = 0;
    await g.activarGiftCard(p.id);
    const a = await prisma.giftCard.findUniqueOrThrow({ where: { id: p.id } });
    expect(a.estado).toBe("ACTIVA");
    expect(fechaISO(a.venceEn!)).toBe(fechaISO(g.calcularVencimiento(new Date(), 2)));
    expect(mails).toEqual([expect.objectContaining({ to: "lucia@example.com", subject: expect.stringContaining(p.codigo) })]);
    await expect(g.activarGiftCard(p.id)).rejects.toThrow(/ya no está esperando/);
  });

  it("sin pagar no sirve para reservar", async () => {
    const p = await g.crearGiftCard(pedido());
    await expect(t.crearReserva(reserva({ giftCard: p.codigo }))).rejects.toThrow(/falta confirmar el pago/);
    expect(await prisma.turno.count()).toBe(0);
  });

  it("con gift card de monto el turno queda confirmado sin seña y descuenta el saldo", async () => {
    const gc = await activa();
    const r = await t.crearReserva(reserva({ servicioId: corporal, giftCard: gc.codigo.toLowerCase() }));
    expect(r.pendienteSena).toBe(false);
    const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
    expect(turno.estado).toBe("CONFIRMADO");
    expect(turno.montoSena).toBe(0);
    expect(turno.montoGiftCard).toBe(24000);
    const despues = await prisma.giftCard.findUniqueOrThrow({ where: { id: gc.id } });
    expect(despues.saldo).toBe(26000);
    expect(despues.estado).toBe("ACTIVA");

    // Con el saldo que queda paga parte del facial ($47.000) y se agota
    const r2 = await t.crearReserva(reserva({ hora: "14:00", giftCard: gc.codigo }));
    expect((await prisma.turno.findUniqueOrThrow({ where: { id: r2.turnoId } })).montoGiftCard).toBe(26000);
    const agotada = await prisma.giftCard.findUniqueOrThrow({ where: { id: gc.id } });
    expect(agotada.saldo).toBe(0);
    expect(agotada.estado).toBe("USADA");
    await expect(t.crearReserva(reserva({ hora: "16:00", giftCard: gc.codigo }))).rejects.toThrow(/ya fue usada/);
  });

  it("la de tratamiento sólo sirve para ese tratamiento y se usa una vez", async () => {
    const gc = await activa({ servicioId: corporal });
    await expect(t.crearReserva(reserva({ giftCard: gc.codigo }))).rejects.toThrow(/es para “Celulitis”/);
    const r = await t.crearReserva(reserva({ servicioId: corporal, giftCard: gc.codigo }));
    expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).montoGiftCard).toBe(24000);
    expect((await prisma.giftCard.findUniqueOrThrow({ where: { id: gc.id } })).estado).toBe("USADA");
  });

  it("si se cancela el turno la gift card recupera el saldo", async () => {
    const gc = await activa();
    const r = await t.crearReserva(reserva({ giftCard: gc.codigo }));
    expect((await prisma.giftCard.findUniqueOrThrow({ where: { id: gc.id } })).saldo).toBe(3000);
    await t.cancelarTurno(r.turnoId, "admin");
    const g2 = await prisma.giftCard.findUniqueOrThrow({ where: { id: gc.id } });
    expect(g2.saldo).toBe(50000);
    expect(g2.estado).toBe("ACTIVA");
  });

  it("vencida, anulada o inexistente no sirve", async () => {
    const gc = await activa();
    await prisma.giftCard.update({ where: { id: gc.id }, data: { venceEn: new Date(Date.now() - 60_000) } });
    await expect(t.crearReserva(reserva({ giftCard: gc.codigo }))).rejects.toThrow(/venció/);
    const otra = await activa();
    await g.anularGiftCard(otra.id);
    await expect(t.crearReserva(reserva({ giftCard: otra.codigo }))).rejects.toThrow(/anulada/);
    await expect(t.crearReserva(reserva({ giftCard: "HS-ZZZZZZ" }))).rejects.toThrow(/No encontramos/);
  });

  it("dos reservas a la vez con la misma gift card de tratamiento: sólo una la usa", async () => {
    const gc = await activa({ servicioId: corporal });
    const r = await Promise.allSettled(
      ["10:00", "12:00", "15:00"].map((hora, i) => t.crearReserva(reserva({ servicioId: corporal, hora, email: `c${i}@example.com`, giftCard: gc.codigo }))),
    );
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.turno.count({ where: { giftCardId: gc.id } })).toBe(1);
  });

  it("en un turno con varios tratamientos: la de tratamiento cubre ese, la de monto hasta su saldo", async () => {
    const deTratamiento = await activa({ servicioId: corporal });
    expect(await g.consultarGiftCard(deTratamiento.codigo, [facial, corporal])).toMatchObject({ cubre: 24000, resta: 47000 });
    const r = await t.crearReserva(reserva({ servicioIds: [facial, corporal], giftCard: deTratamiento.codigo }));
    const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
    expect(turno.montoGiftCard).toBe(24000);
    expect(turno.estado).toBe("CONFIRMADO");

    const deMonto = await activa();
    const r2 = await t.crearReserva(reserva({ servicioIds: [facial, corporal], hora: "14:00", giftCard: deMonto.codigo }));
    expect((await prisma.turno.findUniqueOrThrow({ where: { id: r2.turnoId } })).montoGiftCard).toBe(50000);
    expect((await prisma.giftCard.findUniqueOrThrow({ where: { id: deMonto.id } })).estado).toBe("USADA");
  });

  it("consultar muestra cuánto cubre y cuánto queda por pagar", async () => {
    const gc = await activa();
    const c = await g.consultarGiftCard(gc.codigo, [facial]);
    expect(c).toMatchObject({ codigo: gc.codigo, para: "Sofía", cubre: 47000, resta: 0 });
    await prisma.giftCard.update({ where: { id: gc.id }, data: { saldo: 20000 } });
    expect(await g.consultarGiftCard(gc.codigo, [facial])).toMatchObject({ cubre: 20000, resta: 27000 });
  });

  it("venta en persona: queda activa en el momento", async () => {
    const p = await g.crearGiftCard(pedido({ email: "" }), { porAdmin: true });
    expect(p.estado).toBe("ACTIVA");
    expect(p.venceEn).not.toBeNull();
    expect(p.creadaPorAdmin).toBe(true);
  });
});
