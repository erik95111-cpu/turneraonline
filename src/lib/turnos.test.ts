/**
 * Tests de integración del circuito de reservas contra PostgreSQL.
 * Requieren TEST_DATABASE_URL (una base descartable); si no está, se saltean.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
    await prisma.configuracion.update({ where: { id: 1 }, data: { whatsapp: "", horasParaSena: 24 } });
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

  it("sin WhatsApp cargado confirma el turno y manda mail a la clienta y a la profesional", async () => {
    const r = await t.crearReserva(datos());
    expect(r.pendienteSena).toBe(false);
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

  it("una reserva con el email de otra clienta no pisa su ficha", async () => {
    await t.crearReserva(datos({ nombre: "Lucía Gómez", telefono: "1155554444" }));
    await t.crearReserva(datos({ hora: "15:00", nombre: "Otra Persona", telefono: "1199999999" }));
    const c = await prisma.clienta.findUniqueOrThrow({ where: { email: "lucia@example.com" } });
    expect(c.nombre).toBe("Lucía Gómez");
    expect(c.telefono).toBe("1155554444");
  });

  it("la misma clienta nueva reservando dos cosas a la vez no da error", async () => {
    await prisma.clienta.deleteMany({ where: { email: "nueva@example.com" } });
    const r = await Promise.allSettled([
      t.crearReserva(datos({ hora: "09:00", email: "nueva@example.com" })),
      t.crearReserva(datos({ hora: "15:00", email: "nueva@example.com" })),
    ]);
    expect(r.map((x) => x.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await prisma.clienta.count({ where: { email: "nueva@example.com" } })).toBe(1);
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

  describe("con seña por WhatsApp", () => {
    beforeEach(async () => {
      await prisma.configuracion.update({ where: { id: 1 }, data: { whatsapp: "9 11 6405-2481" } });
    });

    it("deja el turno apartado esperando la seña y avisa a las dos", async () => {
      const r = await t.crearReserva(datos());
      expect(r.pendienteSena).toBe(true);
      const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
      expect(turno.estado).toBe("PENDIENTE_PAGO");
      expect(turno.montoSena).toBe(10000);
      const horas = (turno.expiraEn!.getTime() - Date.now()) / 3_600_000;
      expect(horas).toBeGreaterThan(23.9);
      expect(horas).toBeLessThanOrEqual(24);
      expect(mails.find((m) => m.to === "lucia@example.com")?.subject).toMatch(/pendiente de seña/);
      expect(mails.find((m) => m.to === "pro@example.com")?.subject).toMatch(/esperando seña/);
      // El horario queda apartado mientras tanto
      expect(await t.horariosDisponibles(facial, sabado)).not.toContain("10:00");
    });

    it("el plazo para la seña nunca pasa del horario del turno", async () => {
      await prisma.configuracion.update({ where: { id: 1 }, data: { horasParaSena: 168 } });
      const r = await t.crearReserva(datos());
      const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
      expect(turno.expiraEn!.getTime()).toBe(turno.inicio.getTime());
    });

    it("al marcar 'Seña recibida' se confirma y le llega el mail a la clienta", async () => {
      const r = await t.crearReserva(datos());
      mails.length = 0;
      await t.confirmarSena(r.turnoId);
      const turno = await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } });
      expect(turno.estado).toBe("CONFIRMADO");
      expect(turno.pagoEstado).toBe("transferencia");
      expect(turno.expiraEn).toBeNull();
      expect(mails).toEqual([expect.objectContaining({ to: "lucia@example.com", subject: expect.stringMatching(/Turno confirmado/) })]);
      await expect(t.confirmarSena(r.turnoId)).rejects.toThrow(t.ErrorReserva);
    });

    it("si no manda la seña a tiempo, el horario se libera", async () => {
      const r = await t.crearReserva(datos());
      await prisma.turno.update({ where: { id: r.turnoId }, data: { expiraEn: new Date(Date.now() - 1000) } });
      expect(await t.horariosDisponibles(facial, sabado)).toContain("10:00");
    });

    it("seña tardía con el horario libre: se puede confirmar igual", async () => {
      const r = await t.crearReserva(datos());
      await prisma.turno.update({ where: { id: r.turnoId }, data: { expiraEn: new Date(Date.now() - 1000) } });
      await t.confirmarSena(r.turnoId);
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("CONFIRMADO");
    });

    it("seña tardía con el horario ya tomado: no deja confirmar", async () => {
      const r = await t.crearReserva(datos());
      await prisma.turno.update({ where: { id: r.turnoId }, data: { expiraEn: new Date(Date.now() - 1000) } });
      await t.crearReserva(datos({ email: "otra@example.com" }), { porAdmin: true, sinSena: true });
      await expect(t.confirmarSena(r.turnoId)).rejects.toThrow(/ocupado/);
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("PENDIENTE_PAGO");
    });

    it("dos confirmaciones simultáneas de reservas vencidas del mismo horario: sólo una gana", async () => {
      const a = await t.crearReserva(datos({ email: "a@example.com" }));
      await prisma.turno.update({ where: { id: a.turnoId }, data: { expiraEn: new Date(Date.now() - 1000) } });
      const b = await t.crearReserva(datos({ email: "b@example.com" }));
      await prisma.turno.update({ where: { id: b.turnoId }, data: { expiraEn: new Date(Date.now() - 1000) } });
      const res = await Promise.allSettled([t.confirmarSena(a.turnoId), t.confirmarSena(b.turnoId)]);
      expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.turno.count({ where: { estado: "CONFIRMADO" } })).toBe(1);
    });

    it("la profesional puede cancelar una reserva que espera la seña", async () => {
      const r = await t.crearReserva(datos());
      await t.cancelarTurno(r.turnoId, "admin");
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("CANCELADO");
      expect(await t.horariosDisponibles(facial, sabado)).toContain("10:00");
    });

    it("los turnos cargados desde el panel no piden seña", async () => {
      const r = await t.crearReserva(datos(), { porAdmin: true, sinSena: true });
      expect(r.pendienteSena).toBe(false);
      expect((await prisma.turno.findUniqueOrThrow({ where: { id: r.turnoId } })).estado).toBe("CONFIRMADO");
    });

    it("con 'sin seña' en la configuración se confirma directo", async () => {
      await prisma.configuracion.update({ where: { id: 1 }, data: { senaTipo: "NINGUNA" } });
      const r = await t.crearReserva(datos());
      await prisma.configuracion.update({ where: { id: 1 }, data: { senaTipo: "FIJO" } });
      expect(r.pendienteSena).toBe(false);
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
