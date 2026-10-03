import Link from "next/link";
import { prisma } from "@/lib/db";
import { aFechaUTC, fechaISO } from "@/lib/tiempo";
import { formatPrecio } from "@/lib/formato";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default async function Estadisticas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const actual = fechaISO(new Date()).slice(0, 7);
  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : actual;
  const [y, m] = mes.split("-").map(Number);
  const sig = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const ant = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const rango = { gte: aFechaUTC(`${mes}-01`, "00:00"), lt: aFechaUTC(`${sig}-01`, "00:00") };

  const [turnos, nuevas, servicios] = await Promise.all([
    prisma.turno.findMany({ where: { inicio: rango, estado: { not: "PENDIENTE_PAGO" } }, select: { estado: true, precio: true, servicioId: true, clientaId: true } }),
    prisma.clienta.count({ where: { createdAt: rango, turnos: { some: { estado: { in: ["CONFIRMADO", "COMPLETADO"] } } } } }),
    prisma.servicio.findMany({ select: { id: true, nombre: true } }),
  ]);

  const cuenta = (e: string) => turnos.filter((t) => t.estado === e).length;
  const realizados = turnos.filter((t) => t.estado === "COMPLETADO");
  const agendados = turnos.filter((t) => t.estado === "CONFIRMADO");
  const ausentes = cuenta("AUSENTE");
  const asistibles = realizados.length + ausentes;

  const porServicio = servicios
    .map((s) => {
      const ts = turnos.filter((t) => t.servicioId === s.id && ["CONFIRMADO", "COMPLETADO"].includes(t.estado));
      return { nombre: s.nombre, cantidad: ts.length, monto: ts.reduce((a, t) => a + t.precio, 0) };
    })
    .filter((s) => s.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);

  const filas: [string, string][] = [
    ["Ingresos por turnos realizados", formatPrecio(realizados.reduce((a, t) => a + t.precio, 0))],
    ["Ingresos por turnos agendados (a realizar)", formatPrecio(agendados.reduce((a, t) => a + t.precio, 0))],
    ["Turnos realizados", String(realizados.length)],
    ["Turnos agendados", String(agendados.length)],
    ["Cancelados", String(cuenta("CANCELADO"))],
    ["No asistieron", `${ausentes}${asistibles ? ` (${Math.round((ausentes / asistibles) * 100)}%)` : ""}`],
    ["Clientas distintas", String(new Set(turnos.filter((t) => t.estado !== "CANCELADO").map((t) => t.clientaId)).size)],
    ["Clientas nuevas", String(nuevas)],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Estadísticas · {MESES[m - 1]} {y}</h1>
        <div className="flex gap-2">
          <Link className="btn-sec" href={`/admin/estadisticas?mes=${ant}`}>← {MESES[(m + 10) % 12]}</Link>
          {mes !== actual && <Link className="btn-sec" href={`/admin/estadisticas?mes=${sig}`}>{MESES[m % 12]} →</Link>}
        </div>
      </div>

      <div className="card divide-y divide-[#f0ebe3]">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-[#6b635b]">{k}</span>
            <span className="font-semibold tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-semibold">Tratamientos más pedidos</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[#6b635b] uppercase">
            <tr className="border-b border-[#f0ebe3]"><th className="p-3">Tratamiento</th><th className="p-3 text-right">Turnos</th><th className="p-3 text-right">Monto</th></tr>
          </thead>
          <tbody className="divide-y divide-[#f0ebe3]">
            {porServicio.map((s) => (
              <tr key={s.nombre}>
                <td className="p-3">{s.nombre}</td>
                <td className="p-3 text-right tabular-nums">{s.cantidad}</td>
                <td className="p-3 text-right tabular-nums">{formatPrecio(s.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {porServicio.length === 0 && <p className="p-6 text-center text-sm text-[#8b8279]">Sin turnos este mes.</p>}
      </div>
    </div>
  );
}
