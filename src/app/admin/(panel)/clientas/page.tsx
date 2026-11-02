import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fechaLarga } from "@/lib/tiempo";
import { COLOR_ETIQUETA, diasParaCumple } from "@/lib/clientas";
import { BotonBorrar } from "@/components/BotonBorrar";
import { IconoLapiz } from "@/components/Iconos";
import { borrarClientaAccion } from "../../acciones";

export default async function Clientas({ searchParams }: { searchParams: Promise<{ q?: string; etiqueta?: string; ok?: string; error?: string }> }) {
  const { q = "", etiqueta = "", ok, error } = await searchParams;
  const where: Prisma.ClientaWhereInput = {
    AND: [
      q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { telefono: { contains: q } }] } : {},
      etiqueta ? { etiquetas: { has: etiqueta } } : {},
    ],
  };
  const [clientas, todas] = await Promise.all([
    prisma.clienta.findMany({
      where,
      include: {
        _count: { select: { turnos: { where: { estado: { in: ["CONFIRMADO", "COMPLETADO"] } } } } },
        turnos: { orderBy: { inicio: "desc" }, take: 1, select: { inicio: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    prisma.clienta.findMany({ select: { etiquetas: true, fechaNacimiento: true, nombre: true, id: true } }),
  ]);
  const etiquetas = [...new Set(todas.flatMap((c) => c.etiquetas))].sort();
  // Cumpleaños de los próximos 7 días
  const cumples = todas
    .map((c) => ({ ...c, dias: diasParaCumple(c.fechaNacimiento) }))
    .filter((c): c is typeof c & { dias: number } => c.dias !== null && c.dias <= 7)
    .sort((a, b) => a.dias - b.dias);
  const link = (cambios: Record<string, string>) => `/admin/clientas?${new URLSearchParams(Object.entries({ q, etiqueta, ...cambios }).filter(([, v]) => v))}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Clientas</h1>
          <p className="text-sm text-[#6b635b]">{clientas.length} {clientas.length === 1 ? "clienta" : "clientas"}{etiqueta && ` con la etiqueta “${etiqueta}”`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-2">
            {etiqueta && <input type="hidden" name="etiqueta" value={etiqueta} />}
            <input name="q" defaultValue={q} placeholder="Buscar por nombre, email o teléfono" className="input sm:!w-72" />
            <button className="btn-sec">Buscar</button>
          </form>
          <a href={`/admin/reportes/clientas?${new URLSearchParams(Object.entries({ q, etiqueta }).filter(([, v]) => v))}`} className="btn-sec" title="Descarga la lista (con el filtro que tengas puesto) en Excel">
            Exportar Excel
          </a>
          <Link href="/admin/clientas/reportes" className="btn-sec">Reportes</Link>
          <Link href="/admin/clientas/nueva" className="btn">+ Nueva clienta</Link>
        </div>
      </div>

      {ok && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}

      {cumples.length > 0 && (
        <section className="card mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
          <span className="font-semibold">🎂 Cumpleaños esta semana:</span>
          {cumples.map((c) => (
            <Link key={c.id} href={`/admin/clientas/${c.id}`} className="hover:underline">
              {c.nombre} <span className="text-[#8b8279]">({c.dias === 0 ? "¡hoy!" : c.dias === 1 ? "mañana" : `en ${c.dias} días`})</span>
            </Link>
          ))}
        </section>
      )}

      {etiquetas.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Link href={link({ etiqueta: "" })} className={etiqueta ? "btn-sec" : "btn"}>Todas</Link>
          {etiquetas.map((e) => (
            <Link key={e} href={link({ etiqueta: e })} className={`${etiqueta === e ? "btn" : "btn-sec"} gap-1.5`}>
              <i className={`h-2 w-2 rounded-full ${COLOR_ETIQUETA[e] ?? "bg-[#c9a96e]"}`} />{e}
            </Link>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[#6b635b] uppercase">
            <tr className="border-b border-[#f0ebe3]"><th className="p-3">Nombre</th><th className="p-3">Contacto</th><th className="p-3">Etiquetas</th><th className="p-3">Turnos</th><th className="p-3">Último turno</th><th className="p-3"><span className="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody className="divide-y divide-[#f0ebe3]">
            {clientas.map((c) => (
              <tr key={c.id}>
                <td className="p-3"><Link href={`/admin/clientas/${c.id}`} className="font-medium hover:underline">{c.nombre}</Link></td>
                <td className="p-3 text-[#6b635b]">{c.email ?? <span className="italic">Sin mail</span>}<br />{c.telefono}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {c.etiquetas.map((e) => (
                      <span key={e} className="flex items-center gap-1 rounded-full border border-[#e8e1d6] px-2 py-0.5 text-xs">
                        <i className={`h-1.5 w-1.5 rounded-full ${COLOR_ETIQUETA[e] ?? "bg-[#c9a96e]"}`} />{e}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3">{c._count.turnos}</td>
                <td className="p-3 first-letter:uppercase">{c.turnos[0] ? fechaLarga(c.turnos[0].inicio) : "-"}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1.5">
                    <Link href={`/admin/clientas/${c.id}?editar=1`} className="btn-sec !px-2.5" aria-label={`Editar a ${c.nombre}`} title="Editar"><IconoLapiz /></Link>
                    <BotonBorrar accion={borrarClientaAccion} campos={{ id: c.id }} etiqueta={`Borrar a ${c.nombre}`}
                      pregunta={`¿Borrar a ${c.nombre}? Se borran también sus notas. No se puede deshacer.`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientas.length === 0 && <p className="p-6 text-center text-sm text-[#8b8279]">No se encontraron clientas.</p>}
      </div>
    </div>
  );
}
