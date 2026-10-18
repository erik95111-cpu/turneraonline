import { describe, expect, it } from "vitest";
import { calcularSlots } from "./slots";
import { aFechaUTC, diaSemana, sumarDias } from "./tiempo";
import { calcularSena, senaPorTransferencia } from "./sena";

const base = {
  fecha: "2026-10-05",
  franjas: [{ horaInicio: "09:00", horaFin: "12:00" }],
  intervaloMin: 30,
  ocupados: [],
  minimoInicio: new Date(0),
};

describe("calcularSlots", () => {
  it("genera horarios que entran completos en la franja", () => {
    expect(calcularSlots({ ...base, duracionMin: 60 })).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00",
    ]);
  });

  it("excluye horarios que se superponen con turnos ocupados", () => {
    const ocupados = [{ inicio: aFechaUTC(base.fecha, "10:00"), fin: aFechaUTC(base.fecha, "11:00") }];
    expect(calcularSlots({ ...base, duracionMin: 60, ocupados })).toEqual(["09:00", "11:00"]);
  });

  it("respeta la anticipación mínima", () => {
    const minimoInicio = aFechaUTC(base.fecha, "10:15");
    expect(calcularSlots({ ...base, duracionMin: 30, minimoInicio })).toEqual(["10:30", "11:00", "11:30"]);
  });

  it("combina varias franjas sin duplicar", () => {
    const franjas = [
      { horaInicio: "09:00", horaFin: "10:00" },
      { horaInicio: "15:00", horaFin: "16:00" },
    ];
    expect(calcularSlots({ ...base, franjas, duracionMin: 60 })).toEqual(["09:00", "15:00"]);
  });
});

describe("tiempo", () => {
  it("interpreta las horas en zona horaria de Argentina", () => {
    expect(aFechaUTC("2026-10-05", "09:00").toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });
  it("calcula el día de la semana", () => {
    expect(diaSemana("2026-10-05")).toBe(1); // lunes
    expect(diaSemana("2026-10-04")).toBe(0); // domingo
  });
  it("suma días cruzando meses", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("calcularSena", () => {
  it("calcula porcentaje redondeado a la centena", () => {
    expect(calcularSena(35_000, "PORCENTAJE", 30)).toBe(10_500);
    expect(calcularSena(33_333, "PORCENTAJE", 30)).toBe(10_000);
  });
  it("no supera el precio con monto fijo", () => {
    expect(calcularSena(5_000, "FIJO", 10_000)).toBe(5_000);
  });
  it("devuelve 0 sin seña", () => {
    expect(calcularSena(35_000, "NINGUNA", 30)).toBe(0);
  });
});

import { linkWhatsapp, numeroWhatsapp, resumenHorarios } from "./formato";

describe("resumenHorarios", () => {
  it("agrupa franjas de los sábados", () => {
    expect(
      resumenHorarios([
        { diaSemana: 6, horaInicio: "14:00", horaFin: "18:00" },
        { diaSemana: 6, horaInicio: "09:00", horaFin: "13:00" },
      ]),
    ).toEqual(["Sábados · 09:00 a 13:00 y 14:00 a 18:00"]);
  });
  it("agrupa días con el mismo horario", () => {
    expect(
      resumenHorarios([
        { diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" },
        { diaSemana: 2, horaInicio: "09:00", horaFin: "13:00" },
        { diaSemana: 6, horaInicio: "10:00", horaFin: "12:00" },
      ]),
    ).toEqual(["Lunes, Martes · 09:00 a 13:00", "Sábados · 10:00 a 12:00"]);
  });
});

describe("senaPorTransferencia", () => {
  const base = { senaTipo: "FIJO" as const, senaValor: 10000, cbu: "", alias: "" };
  it("pide seña sólo si hay alias o CBU cargado", () => {
    expect(senaPorTransferencia(base)).toBe(false);
    expect(senaPorTransferencia({ ...base, alias: "mc.skin" })).toBe(true);
    expect(senaPorTransferencia({ ...base, cbu: "000123" })).toBe(true);
  });
  it("no pide seña si está configurado 'sin seña' o en 0", () => {
    expect(senaPorTransferencia({ ...base, alias: "x", senaTipo: "NINGUNA" })).toBe(false);
    expect(senaPorTransferencia({ ...base, alias: "x", senaValor: 0 })).toBe(false);
  });
});

describe("numeroWhatsapp", () => {
  it("completa el 549 en celulares argentinos escritos de cualquier forma", () => {
    for (const n of ["9 11 6405-2481", "11 6405-2481", "1164052481", "011 6405-2481", "+54 9 11 6405 2481",
      "54 11 6405 2481", "011 15 6405-2481", "11 15 6405 2481", "0054 9 11 6405 2481"]) {
      expect(numeroWhatsapp(n), n).toBe("5491164052481");
    }
  });
  it("funciona con códigos de área del interior", () => {
    expect(numeroWhatsapp("351 15 555 1234")).toBe("5493515551234");
    expect(numeroWhatsapp("0351 555-1234")).toBe("5493515551234");
  });
  it("arma el link con el mensaje", () => {
    expect(linkWhatsapp("9 11 6405-2481", "Hola!")).toBe("https://wa.me/5491164052481?text=Hola!");
  });
});
