import { afterEach, describe, expect, it, vi } from "vitest";
import type { Configuracion } from "@prisma/client";
import { enviarWhatsappAutomatico, linkAvisoWhatsapp, mensajeWhatsapp, whatsappAutomatico } from "./whatsapp";

const cfg = {
  nombreNegocio: "MC Healthy Skin",
  direccion: "Av. Siempre Viva 123",
  politicaCancelacion: "Cancelá hasta 24 hs antes.",
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
  it("la confirmación tiene lo mismo que el mail: día, tratamiento, saldo, dirección y link", () => {
    const m = mensajeWhatsapp(cfg, turno, "confirmacion");
    expect(m).toContain("Hola Elena!");
    expect(m).toContain("confirmado");
    expect(m).toMatch(/sábado 7 de noviembre, 10:00 hs/);
    expect(m).toContain("Higiene profunda");
    expect(m).toMatch(/A abonar en la sesión: \$\s?37\.000/);
    expect(m).toContain("Av. Siempre Viva 123");
    expect(m).toContain("/reserva/t1?t=secreto");
  });

  it("el recordatorio dice que es mañana", () => {
    expect(mensajeWhatsapp(cfg, turno, "recordatorio")).toContain("*mañana*");
  });

  it("el link de un toque va al celular de la clienta con el mensaje escrito", () => {
    const link = linkAvisoWhatsapp(cfg, turno, "confirmacion")!;
    expect(link.startsWith("https://wa.me/5491122223333?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("Hola Elena!");
  });
});

describe("envío automático (API de Meta)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sin credenciales no hace nada", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(whatsappAutomatico()).toBe(false);
    expect(await enviarWhatsappAutomatico(cfg, turno, "confirmacion")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("con credenciales manda la plantilla con los datos del turno", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "tok");
    vi.stubEnv("WHATSAPP_PHONE_ID", "123");
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await enviarWhatsappAutomatico(cfg, turno, "recordatorio")).toBe(true);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/graph\.facebook\.com\/v\d+\.\d+\/123\/messages$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const body = JSON.parse(String(init.body));
    expect(body.to).toBe("5491122223333");
    expect(body.template.name).toBe("turno_recordatorio");
    expect(body.template.components[0].parameters.map((x: { text: string }) => x.text)).toEqual([
      "Elena", "MC Healthy Skin", "sábado 7 de noviembre, 10:00 hs", "Higiene profunda", "Av. Siempre Viva 123", expect.stringContaining("/reserva/t1?t=secreto"),
    ]);
  });

  it("si Meta lo rechaza devuelve false (queda el botón de un toque)", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "tok");
    vi.stubEnv("WHATSAPP_PHONE_ID", "123");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 400 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await enviarWhatsappAutomatico(cfg, turno, "confirmacion")).toBe(false);
  });
});
