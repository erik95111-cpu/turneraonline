/**
 * Recordatorios: automático (cron) y a mano desde el panel. Requiere TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mails = vi.hoisted(() => ({ lista: [] as { to: string; subject: string; html: string }[], fallar: false }));
vi.mock("./email", () => ({
  enviarMail: vi.fn(async (m: { to: string; subject: string; html: string }) => {
    if (!m.to || mails.fallar) return false;
    mails.lista.push(m);
    return true;
  }),
}));

const d = process.env.TEST_DATABASE_URL ? describe : describe.skip;

d("recordatorios", async () => {
  const { prisma } = await import("./db");
  const r = await import("./recordatorios");
  const { fechaISO, sumarDias, aFechaUTC } = await import("./tiempo");
  const manana = sumarDias(fechaISO(new Date()), 1);
  let servicio: string;

  const turno = async (nombre: string, email: string | null, hora: string, extra: Record<string, unknown> = {}) => {
    const c = await prisma.clienta.create({ data: { nombre, email, telefono: "11" + Math.floor(Math.random() * 1e8) } });
    const inicio = aFechaUTC(manana, hora);
    return prisma.turno.create({
      data: { clientaId: c.id, servicioId: servicio, inicio, fin: new Date(inicio.getTime() + 3_600_000), precio: 45000, estado: "CONFIRMADO", ...extra },
    });
  };

  beforeAll(async () => {
    await prisma.turno.deleteMany();
    await prisma.giftCard.deleteMany();
    await prisma.notaClienta.deleteMany();
    await prisma.clienta.deleteMany();
    await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    servicio = (await prisma.servicio.create({ data: { nombre: "Recordatorio test", duracionMin: 60, precio: 45000 } })).id;
  });

  beforeEach(async () => {
    await prisma.turno.deleteMany();
    await prisma.clienta.deleteMany();
    mails.lista.length = 0;
    mails.fallar = false;
  });

  afterAll(async () => {
    await prisma.turno.deleteMany();
    await prisma.servicio.delete({ where: { id: servicio } });
    await prisma.$disconnect();
  });

  it("el automático manda a las confirmadas con mail y deja anotado qué hizo", async () => {
    await turno("Ana Mail", "ana@example.com", "10:00");
    await turno("Bea Sin Mail", null, "11:00");
    await turno("Caro Sin Seña", "caro@example.com", "12:00", { estado: "PENDIENTE_PAGO", expiraEn: new Date(Date.now() + 3_600_000) });
    const res = await r.recordatoriosAutomaticos();
    expect(res).toMatchObject({ revisados: 3, enviados: 1, sinMail: 1, sinConfirmar: 1 });
    expect(mails.lista.map((m) => m.to)).toEqual(["ana@example.com"]);
    expect(mails.lista[0].html).toContain("Te esperamos mañana");
    const cfg = await prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } });
    expect(cfg.recordatoriosAutoEn).not.toBeNull();
    expect(cfg.recordatoriosAutoResultado).toBe("3 turnos para mañana · 1 mail enviado · 1 sin mail (mandar por WhatsApp) · 1 esperando seña (no se les manda)");
    // No lo manda dos veces
    await r.recordatoriosAutomaticos();
    expect(mails.lista).toHaveLength(1);
  });

  it("si falla el envío de mails lo anota", async () => {
    await turno("Ana Mail", "ana@example.com", "10:00");
    mails.fallar = true;
    await r.recordatoriosAutomaticos();
    expect((await prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } })).recordatoriosAutoResultado).toContain("1 no se pudieron mandar");
  });

  it("a mano: manda (y reenvía) por mail; sin mail o con falla avisa", async () => {
    const t = await turno("Ana Mail", "ana@example.com", "10:00");
    expect(await r.enviarRecordatorioMail(t.id)).toBe("Ana Mail");
    expect(await r.enviarRecordatorioMail(t.id)).toBe("Ana Mail");
    expect(mails.lista).toHaveLength(2);
    expect((await prisma.turno.findUniqueOrThrow({ where: { id: t.id } })).recordatorioEnviado).toBe(true);
    const sinMail = await turno("Bea", null, "11:00");
    await expect(r.enviarRecordatorioMail(sinMail.id)).rejects.toThrow(/no tiene mail/);
    mails.fallar = true;
    await expect(r.enviarRecordatorioMail(t.id)).rejects.toThrow(/No se pudo mandar/);
  });

  it("a mano, todos los del día: también a las que esperan la seña, sin repetir", async () => {
    await turno("Ana", "ana@example.com", "10:00");
    await turno("Caro", "caro@example.com", "12:00", { estado: "PENDIENTE_PAGO", expiraEn: new Date(Date.now() + 3_600_000) });
    await turno("Bea", null, "11:00");
    await turno("Ya avisada", "ya@example.com", "13:00", { recordatorioEnviado: true });
    expect(await r.enviarRecordatoriosDelDia(manana)).toEqual({ enviados: 2, sinMail: 1, fallidos: 0 });
    expect(mails.lista.map((m) => m.to).sort()).toEqual(["ana@example.com", "caro@example.com"]);
    expect((await r.turnosDelDia(manana)).map((t) => t.clienta.nombre)).toEqual(["Ana", "Bea", "Caro", "Ya avisada"]);
  });
});
