import Link from "next/link";
import { prisma } from "@/lib/db";
import { fechaISO, sumarDias } from "@/lib/tiempo";
import { leerRango } from "@/lib/reportes";

/** Rangos rápidos: este mes, mes pasado, últimos 30 días, este año */
function atajos(hoy: string) {
  const [y, m] = hoy.split("-").map(Number);
  const iso = (a: number, mes: number, d: number) => `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const finMes = (a: number, mes: number) => new Date(Date.UTC(a, mes, 0)).getUTCDate();
  const [ya, ma] = m === 1 ? [y - 1, 12] : [y, m - 1];
  return [
    ["Este mes", iso(y, m, 1), iso(y, m, finMes(y, m))],
    ["Mes pasado", iso(ya, ma, 1), iso(ya, ma, finMes(ya, ma))],
    ["Últimos 30 días", sumarDias(hoy, -30), hoy],
    ["Este año", iso(y, 1, 1), iso(y, 12, 31)],
  ] as const;
}

export default async function Reportes({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const sp = await searchParams;
  const rango = leerRango(new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")));
  const hoy = fechaISO(new Date());
  const q = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
  const totalClientas = await prisma.clienta.count();

  const reportes = [
    {
      titulo: "Clientas",
      texto: `Las ${totalClientas} clientas con contacto, cumpleaños, etiquetas, primera y última visita, cantidad de visitas y total gastado.`,
      href: "/admin/reportes/clientas",
      nota: "Es toda la base (no usa las fechas). Para una parte, filtrá en Clientas y tocá “Exportar Excel”.",
    },
    {
      titulo: "Reservas",
      texto: "Cada turno de esas fechas: día y hora, clienta, cuándo reservó, tratamiento, precio, si vino de la web o del panel y su estado.",
      href: `/admin/reportes/reservas?${q}`,
    },
    {
      titulo: "Transacciones",
      texto: "Lo cobrado y lo que falta cobrar: cada turno y gift card vendida, con seña, descuento por gift card y saldo pendiente.",
      href: `/admin/reportes/transacciones?${q}`,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/clientas" className="text-sm text-[#6b635b] hover:underline">← Clientas</Link>
      <h1 className="mt-2 font-serif text-3xl">Reportes</h1>
      <p className="mb-6 text-sm text-[#6b635b]">Se descargan en Excel, con las mismas columnas que el sistema anterior.</p>

      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div><label className="lbl" htmlFor="desde">Desde</label><input id="desde" name="desde" type="date" defaultValue={rango.desde} className="input" /></div>
        <div><label className="lbl" htmlFor="hasta">Hasta</label><input id="hasta" name="hasta" type="date" defaultValue={rango.hasta} className="input" /></div>
        <button className="btn-sec">Aplicar fechas</button>
        <div className="flex w-full flex-wrap gap-1.5">
          {atajos(hoy).map(([nombre, d, h]) => (
            <Link key={nombre} href={`/admin/clientas/reportes?desde=${d}&hasta=${h}`} className={rango.desde === d && rango.hasta === h ? "btn" : "btn-sec"}>{nombre}</Link>
          ))}
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        {reportes.map((r) => (
          <section key={r.titulo} className="card flex flex-col p-5">
            <h2 className="font-serif text-2xl">{r.titulo}</h2>
            <p className="mt-2 flex-1 text-sm text-[#6b635b]">{r.texto}</p>
            {r.nota && <p className="mt-2 text-xs text-[#8b8279]">{r.nota}</p>}
            <a href={r.href} className="btn mt-4 self-start">Descargar Excel</a>
          </section>
        ))}
      </div>
    </div>
  );
}
