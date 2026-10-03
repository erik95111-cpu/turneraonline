import { describe, expect, it } from "vitest";
import { calcularSlots } from "./slots";
import { aFechaUTC, diaSemana, sumarDias } from "./tiempo";
import { calcularSena } from "./sena";

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

import { resumenHorarios } from "./formato";

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
