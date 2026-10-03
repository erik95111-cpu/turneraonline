/**
 * Tests de integración del circuito de reservas contra PostgreSQL.
 * Requieren TEST_DATABASE_URL (una base descartable); si no está, se saltean.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mp = vi.hoisted(() => ({
  habilitado: false,
  pagos: new Map<string, { id: string; estado: string; turnoId: string; monto: number }>(),
}));

vi.mock("./mercadopago", () => ({
  mpHabilitado: () => mp.habilitado,
  crearPreferenciaSena: vi.fn(async () => ({ id: "pref-1", url: "https://mp.test/pagar" })),
  obtenerPago: vi.fn(async (id: string) => {
    const p = mp.pagos.get(id);
    if (!p) throw new Error("pago inexistente");
    return p;
  }),
}));

const mails = vi.hoisted(() => [] as { to: string; subject: string }[]);
vi.mock("./email", () => ({
  enviarMail: vi.fn(async (m: { to: string; subject: string }) => {
    mails.push({ to: m.to, subject: m.subject });
    return true;
  }),
}));

const conDB = Boolean(process.env.TEST_DATABASE_URL);
const d = conDB ? describe : describe.skip;

d("circuito de reservas", async () => {
  const { prisma } = await import("./db");
  const t = await import("./turnos");
  const { fechaISO, sumarDias, diaSemana, aFechaUTC } = await import("./tiempo");

  // Próximo sábado con al menos 2 días de margen
  let sabado = sumarDias(fechaISO(new Date()), 2);
  while (diaSemana(sabado) !== 6) sabado = sumarDias(sabado, 1);
  let martes = sabado;
  while (diaSemana(martes) !== 2) martes = sumarDias(martes, 1);

  let facial: string; // 60 min
  let corporal: string; // 30 min

  const datos = (extra: Partial<Parameters<typeof t.crearReserva>[0]> = {}) => ({
    servicioId: facial,
    fecha: sabado,
    hora: "10:00",
    nombre: "Lucía Gómez",
    email: "lucia@example.com",
    telefono: "1155554444",
    notas: "",
    ...extra,
  });

  beforeAll(async () => {
    await prisma.turno.deleteMany();
    await prisma.clienta.deleteMany();
    await prisma.servicio.deleteMany();
    await prisma.horarioAtencion.deleteMany();
    await prisma.bloqueo.deleteMany();
    await prisma.configuracion.deleteMany();
    await prisma.configuracion.create({
      data: { id: 1, senaTipo: "FIJO", senaValor: 10000, emailProfesional: "pro@example.com", intervaloMin: 30 },
    });
    await prisma.horarioAtencion.createMany({
      data: [
        { diaSemana: 6, horaInicio: "09:00", horaFin: "13:00" },
        { diaSemana: 6, horaInicio: "14:00", horaFin: "18:00" },
      ],
    });
    facial = (await prisma.servicio.create({ data: { nombre: "Higiene profunda", duracionMin: 60, precio: 47000 } })).id;
    corporal = (await prisma.servicio.create({ data: { nombre: "Celulitis", duracionMin: 30, precio: 24000, categoria: "Corporales" } })).id;
  });

  beforeEach(async () => {
    await prisma.turno.deleteMany();
    await prisma.bloqueo.deleteMany();
    mails.length = 0;
    mp.habilitado = false;
    mp.pagos.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sólo hay horarios los sábados", async () => {
    expect(await t.horariosDisponibles(facial, martes)).toEqual([]);
    const libres = await t.horariosDisponibles(facial, sabado);
    expect(libres[0]).toBe("09:00");
    expect(libres).toContain("12:00");
    expect(libres).not.toContain("12:30"); // terminaría 13:30, fuera de la franja
    expect(libres).not.toContain("13:00");
    expect(libres.at(-1)).toBe("17:00");
  });

  it("no ofrece fechas pasadas ni fuera del rango", async () => {
    expect(await t.horariosDisponibles(facial, "2020-01-04")).toEqual([]);
    expect(await t.horariosDisponibles(facial, sumarDias(sabado, 400))).toEqual([]);
    expect(await t.horariosDisponibles("no-existe", sabado)).toEqual([]);
  });

  it("sin Mercado Pago confirma el turno y manda mail a la clienta y a la profesional", async () => {
    const r = await t.crearReserva(datos());
    expect(r.urlPago).toBeUndefined();
    const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
    expect(turno.estado).toBe("CONFIRMADO");
    expect(turno.montoSena).toBe(0);
    expect(turno.token.length).toBeGreaterThanOrEqual(30);
    expect(mails.map((m) => m.to).sort()).toEqual(["lucia@example.com", "pro@example.com"]);
  });

  it("no permite reservar un horario superpuesto", async () => {
    await t.crearReserva(datos({ hora: "10:00" }));
    await expect(t.crearReserva(datos({ hora: "10:30", email: "otra@example.com" }))).rejects.toThrow(t.ErrorReserva);
    await expect(t.crearReserva(datos({ hora: "09:30", email: "otra@example.com" }))).rejects.toThrow(/no está disponible/);
    // Un servicio corto que entra justo antes sí se puede
    await expect(t.crearReserva(datos({ servicioId: corporal, hora: "09:30", email: "otra@example.com" }))).resolves.toBeTruthy();
  });

  it("dos reservas simultáneas al mismo horario: sólo una gana", async () => {
    const resultados = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => t.crearReserva(datos({ hora: "15:00", email: `c${i}@example.com` }))),
    );
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of resultados.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(t.ErrorReserva);
    }
    expect(await prisma.turno.count({ where: { estado: "CONFIRMADO" } })).toBe(1);
  });

  it("respeta los bloqueos", async () => {
    await prisma.bloqueo.create({ data: { desde: aFechaUTC(sabado, "00:00"), hasta: aFechaUTC(sabado, "23:59"), motivo: "Feriado" } });
    expect(await t.horariosDisponibles(facial, sabado)).toEqual([]);
  });

  it("rechaza datos inválidos", () => {
    expect(t.reservaSchema.safeParse({ ...datos(), email: "no-es-mail" }).success).toBe(false);
    expect(t.reservaSchema.safeParse({ ...datos(), nombre: "" }).success).toBe(false);
    expect(t.reservaSchema.safeParse({ ...datos(), telefono: "12" }).success).toBe(false);
    expect(t.reservaSchema.safeParse({ ...datos(), hora: "10" }).success).toBe(false);
  });

  describe("con Mercado Pago", () => {
    beforeEach(() => {
      mp.habilitado = true;
    });

    it("deja el turno pendiente con seña de $10.000 y devuelve el link de pago", async () => {
      const r = await t.crearReserva(datos());
      expect(r.urlPago).toBe("https://mp.test/pagar");
      const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
      expect(turno.estado).toBe("PENDIENTE_PAGO");
      expect(turno.montoSena).toBe(10000);
      expect(turno.expiraEn!.getTime()).toBeGreaterThan(Date.now());
      expect(mails).toHaveLength(0); // todavía no pagó
      // El horario queda reservado mientras paga
      expect(await t.horariosDisponibles(facial, sabado)).not.toContain("10:00");
    });

    it("al aprobarse el pago confirma el turno y manda los mails una sola vez", async () => {
      const r = await t.crearReserva(datos());
      mp.pagos.set("111", { id: "111", estado: "approved", turnoId: r.turnoId, monto: 10000 });
      await t.procesarPago("111");
      await t.procesarPago("111"); // el webhook puede llegar repetido
      const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
      expect(turno.estado).toBe("CONFIRMADO");
      expect(turno.mpPaymentId).toBe("111");
      expect(mails).toHaveLength(2);
    });

    it("un pago rechazado no confirma", async () => {
      const r = await t.crearReserva(datos());
      mp.pagos.set("222", { id: "222", estado: "rejected", turnoId: r.turnoId, monto: 10000 });
      await t.procesarPago("222");
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("PENDIENTE_PAGO");
    });

    it("un pago por menos de la seña no confirma", async () => {
      const r = await t.crearReserva(datos());
      mp.pagos.set("333", { id: "333", estado: "approved", turnoId: r.turnoId, monto: 1 });
      await t.procesarPago("333");
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("PENDIENTE_PAGO");
    });

    it("si no paga a tiempo el horario se libera", async () => {
      const r = await t.crearReserva(datos());
      await prisma.turno.update({ where: { id: r.turnoId }, data: { expiraEn: new Date(Date.now() - 1000) } });
      expect(await t.horariosDisponibles(facial, sabado)).toContain("10:00");
    });

    it("pago tardío con el horario ya tomado: cancela y avisa a la profesional", async () => {
      const r = await t.crearReserva(datos());
      await prisma.turno.update({ where: { id: r.turnoId }, data: { expiraEn: new Date(Date.now() - 1000) } });
      mp.habilitado = false;
      await t.crearReserva(datos({ email: "otra@example.com" })); // otra persona toma el horario
      mails.length = 0;
      mp.habilitado = true;
      mp.pagos.set("444", { id: "444", estado: "approved", turnoId: r.turnoId, monto: 10000 });
      await t.procesarPago("444");
      const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
      expect(turno.estado).toBe("CANCELADO");
      expect(turno.pagoEstado).toBe("approved_sin_lugar");
      expect(mails.map((m) => m.to)).toEqual(["pro@example.com"]);
    });

    it("pago tardío con el horario libre: confirma igual", async () => {
      const r = await t.crearReserva(datos());
      await prisma.turno.update({ where: { id: r.turnoId }, data: { expiraEn: new Date(Date.now() - 1000) } });
      mp.pagos.set("555", { id: "555", estado: "approved", turnoId: r.turnoId, monto: 10000 });
      await t.procesarPago("555");
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("CONFIRMADO");
    });

    it("si Mercado Pago falla, no queda el turno colgado", async () => {
      const { crearPreferenciaSena } = await import("./mercadopago");
      vi.mocked(crearPreferenciaSena).mockRejectedValueOnce(new Error("MP caído"));
      await expect(t.crearReserva(datos())).rejects.toThrow(/link de pago/);
      expect(await prisma.turno.count()).toBe(0);
      expect(await t.horariosDisponibles(facial, sabado)).toContain("10:00");
    });

    it("los turnos cargados desde el panel no piden seña", async () => {
      const r = await t.crearReserva(datos(), { porAdmin: true, sinSena: true });
      expect(r.urlPago).toBeUndefined();
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("CONFIRMADO");
    });
  });

  describe("cancelaciones", () => {
    it("la clienta puede cancelar con anticipación y se avisa a ambas", async () => {
      const r = await t.crearReserva(datos());
      mails.length = 0;
      await t.cancelarTurno(r.turnoId, "clienta");
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("CANCELADO");
      expect(mails).toHaveLength(2);
      // y el horario vuelve a estar libre
      expect(await t.horariosDisponibles(facial, sabado)).toContain("10:00");
    });

    it("la clienta no puede cancelar dentro de las 24 hs, la profesional sí", async () => {
      const r = await t.crearReserva(datos());
      const enUnRato = new Date(Date.now() + 5 * 3_600_000);
      await prisma.turno.update({ where: { id: r.turnoId }, data: { inicio: enUnRato, fin: new Date(enUnRato.getTime() + 3_600_000) } });
      await expect(t.cancelarTurno(r.turnoId, "clienta")).rejects.toThrow(/24 hs/);
      await t.cancelarTurno(r.turnoId, "admin");
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("CANCELADO");
    });

    it("no se puede cancelar dos veces", async () => {
      const r = await t.crearReserva(datos());
      await t.cancelarTurno(r.turnoId, "admin");
      await expect(t.cancelarTurno(r.turnoId, "admin")).rejects.toThrow(t.ErrorReserva);
    });
  });
});
