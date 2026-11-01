import { describe, expect, it } from "vitest";
import type { Configuracion } from "@prisma/client";
import { linkAvisoWhatsapp, linkImagenTurno, mensajeWhatsapp } from "./whatsapp";

const cfg = {
  nombreNegocio: "MC Healthy Skin",
  direccion: "Av. Siempre Viva 123",
} as Configuracion;

const turno = {
  id: "t1",
  token: "secreto",
  inicio: new Date("2026-11-07T13:00:00Z"), // sábado 10:00 en Argentina
  fin: new Date("2026-11-07T14:00:00Z"),
  estado: "CONFIRMADO",
  precio: 47000,
  montoSena: 10000,
  montoGiftCard: 0,
  giftCard: null,
  clienta: { nombre: "Elena Ruiz", telefono: "11 15 2222-3333" },
  servicio: { nombre: "Higiene profunda", duracionMin: 60, incluye: [] },
} as unknown as Parameters<typeof mensajeWhatsapp>[1];

describe("mensajes de WhatsApp", () => {
  it("la confirmación: saludo, día, hora, tratamiento, dirección y el link con la tarjeta al final", () => {
    const m = mensajeWhatsapp(cfg, turno, "confirmacion");
    expect(m).toContain("¡Tu turno está confirmado!");
    expect(m).toContain("Hola Elena");
    expect(m).toContain("*Sábado 7 de noviembre*");
    expect(m).toContain("*10:00 hs*");
    expect(m).toContain("Higiene profunda");
    expect(m).toContain("Av. Siempre Viva 123");
    expect(m.split("\n").at(-1)).toMatch(/\/reserva\/t1\?t=secreto&v=confirmacion$/);
    expect(m).not.toContain("$");
  });

  it("el precio va sólo si la profesional lo elige", () => {
    const m = mensajeWhatsapp(cfg, turno, "confirmacion", { conPrecio: true });
    expect(m).toMatch(/Total \$\s?47\.000 · Seña abonada \$\s?10\.000 · Resta \$\s?37\.000/);
  });

  it("el recordatorio sólo tiene día, hora y lugar (sin precio)", () => {
    const m = mensajeWhatsapp(cfg, turno, "recordatorio", { conPrecio: true });
    expect(m).toContain("Recordatorio de turno");
    expect(m).toContain("*10:00 hs*");
    expect(m).not.toContain("$");
    expect(m).toMatch(/&v=recordatorio$/);
  });

  it("dice “mañana” si el turno es mañana", () => {
    const manana = { ...turno, inicio: new Date(Date.now() + 24 * 3_600_000) } as typeof turno;
    expect(mensajeWhatsapp(cfg, manana, "recordatorio")).toContain("*mañana*");
  });

  it("el link de un toque va al celular de la clienta con el mensaje escrito", () => {
    const link = linkAvisoWhatsapp(cfg, turno, "confirmacion")!;
    expect(link.startsWith("https://wa.me/5491122223333?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("Hola Elena");
  });

  it("la imagen para descargar lleva el token del turno", () => {
    expect(linkImagenTurno(turno, "recordatorio")).toBe("/api/tarjeta/t1?t=secreto&v=recordatorio&descargar=1");
  });
});

describe("formato", () => {
  it("sin precio no queda un renglón vacío entre el tratamiento y la dirección", () => {
    const m = mensajeWhatsapp(cfg, turno, "confirmacion");
    expect(m).toContain("💆‍♀️ Higiene profunda\n📍 Av. Siempre Viva 123");
  });
});
