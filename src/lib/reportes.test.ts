/**
 * Reportes en Excel contra PostgreSQL. Requiere TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

const d = process.env.TEST_DATABASE_URL ? describe : describe.skip;

async function leer(buf: Buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buf as unknown as ArrayBuffer);
  const filas = (nombre: string) => {
    const out: unknown[][] = [];
    libro.getWorksheet(nombre)!.eachRow((r) => out.push((r.values as unknown[]).slice(1)));
    return out;
  };
  return { hojas: libro.worksheets.map((w) => w.name), filas };
}

d("reportes en Excel", async () => {
  const { prisma } = await import("./db");
  const r = await import("./reportes");
  const { fechaISO, sumarDias, aFechaUTC } = await import("./tiempo");
  const hoy = fechaISO(new Date());

  beforeAll(async () => {
    await prisma.turno.deleteMany();
    await prisma.giftCard.deleteMany();
    await prisma.notaClienta.deleteMany();
    await prisma.clienta.deleteMany();
    await prisma.configuracion.upsert({ where: { id: 1 }, update: { nombreProfesional: "Marye Costanzo" }, create: { id: 1, nombreProfesional: "Marye Costanzo" } });
    const s = await prisma.servicio.create({ data: { nombre: "Higiene básica", duracionMin: 60, precio: 45000 } });
    const juli = await prisma.clienta.create({ data: { nombre: "Julieta Cancelo", email: "juli@example.com", telefono: "1139325005", fechaNacimiento: "1984-09-11", etiquetas: ["VIP", "Adeuda"] } });
    await prisma.clienta.create({ data: { nombre: "Emanuel Eijo", telefono: "1139369570" } });
    const inicio = aFechaUTC(sumarDias(hoy, 3), "10:00");
    await prisma.turno.create({ data: { clientaId: juli.id, servicioId: s.id, inicio, fin: new Date(inicio.getTime() + 3_600_000), precio: 45000, montoSena: 10000, estado: "CONFIRMADO", pagoEstado: "transferencia" } });
    const antes = aFechaUTC(sumarDias(hoy, -3), "10:00");
    await prisma.turno.create({ data: { clientaId: juli.id, servicioId: s.id, inicio: antes, fin: new Date(antes.getTime() + 3_600_000), precio: 45000, estado: "COMPLETADO" } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("clientas: mismas columnas que el sistema anterior, visitas y total gastado", async () => {
    const { hojas, filas } = await leer(await r.reporteClientas());
    expect(hojas).toEqual(["Clientes", "Filtros"]);
    const [encabezado, ...resto] = filas("Clientes");
    expect(encabezado).toEqual(["Nombre", "Apellido", "Email", "Teléfono", "Dirección", "Fecha de nacimiento", "Estado", "Etiquetas", "Primera visita", "Última visita", "Total visitas", "Total gastado", "Adeuda"]);
    const juli = resto.find((x) => x[0] === "Julieta")!;
    expect(juli.slice(1, 3)).toEqual(["Cancelo", "juli@example.com"]);
    expect(juli[5]).toBe("11/09/1984");
    expect(juli[6]).toBe("Recurrente");
    expect(juli.slice(10)).toEqual([2, 90000, "Sí"]);
  });

  it("clientas filtradas por etiqueta", async () => {
    const { filas } = await leer(await r.reporteClientas({ etiqueta: "VIP" }));
    expect(filas("Clientes")).toHaveLength(2);
    expect(String(filas("Filtros")[0][0])).toContain("VIP");
  });

  it("reservas del rango con profesional y estado", async () => {
    const { filas } = await leer(await r.reporteReservas({ desde: sumarDias(hoy, -7), hasta: sumarDias(hoy, 7) }));
    const [enc, ...resto] = filas("Reservas");
    expect(enc[0]).toBe("Fecha turno");
    expect(resto).toHaveLength(2);
    expect(resto.map((x) => x[11]).sort()).toEqual(["Confirmada", "Realizada"]);
    expect(resto[0][9]).toBe("Marye Costanzo");
  });

  it("transacciones: seña cobrada y saldo pendiente", async () => {
    const { filas } = await leer(await r.reporteTransacciones({ desde: sumarDias(hoy, -1), hasta: hoy }));
    const [, ...resto] = filas("Transacciones");
    const confirmado = resto.find((x) => x[11] === "Saldo pendiente de pago")!;
    expect(confirmado.slice(8, 11)).toEqual([45000, 10000, 35000]);
    expect(resto.find((x) => x[11] === "Pagado")?.[10]).toBe(0);
  });
});
