import Link from "next/link";
import type { EstadoTurno, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fechaHoraLarga } from "@/lib/tiempo";
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { EstadoBadge } from "@/components/EstadoBadge";

const POR_PAGINA = 50;
const ESTADOS: [EstadoTurno | "", string][] = [
  ["", "Todos los estados"],
  ["CONFIRMADO", "Confirmados"],
  ["PENDIENTE_PAGO", "Esperando pago"],
  ["COMPLETADO", "Realizados"],
  ["AUSENTE", "No vinieron"],
  ["CANCELADO", "Cancelados"],
];

interface Filtros { ver?: string; estado?: string; q?: string; pagina?: string }

export default async function Turnos({ searchParams }: { searchParams: Promise<Filtros> }) {
  const sp = await searchParams;
  const ver = sp.ver === "pasados" || sp.ver === "todos" ? sp.ver : "proximos";
  const estado = ESTADOS.some(([e]) => e && e === sp.estado) ? (sp.estado as EstadoTurno) : undefined;
  const q = (sp.q ?? "").trim();
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const ahora = new Date();

  const where: Prisma.TurnoWhereInput = {
    ...(ver === "proximos" ? { inicio: { gte: ahora } } : ver === "pasados" ? { inicio: { lt: ahora } } : {}),
    ...(estado ? { estado } : {}),
    ...(q
      ? {
          OR: [
            { clienta: { nombre: { contains: q, mode: "insensitive" } } },
            { clienta: { email: { contains: q, mode: "insensitive" } } },
            { clienta: { telefono: { contains: q } } },
            { servicio: { nombre: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, turnos] = await Promise.all([
    prisma.turno.count({ where }),
    prisma.turno.findMany({
      where,
      include: { clienta: true, servicio: true },
      orderBy: { inicio: ver === "proximos" ? "asc" : "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const link = (cambios: Partial<Filtros>) => {
    const p = new URLSearchParams();
    const todo = { ver, estado: estado ?? "", q, pagina: "1", ...cambios };
    for (const [k, v] of Object.entries(todo)) if (v && !(k === "pagina" && v === "1")) p.set(k, String(v));
    return `/admin/turnos?${p}`;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Turnos</h1>
          <p className="text-sm text-[#6b635b]">{total} turno{total === 1 ? "" : "s"}</p>
        </div>
        <Link className="btn" href="/admin/turnos/nuevo">+ Nuevo turno</Link>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {([["proximos", "Próximos"], ["pasados", "Pasados"], ["todos", "Todos"]] as const).map(([v, t]) => (
          <Link key={v} href={link({ ver: v })} className={ver === v ? "btn" : "btn-sec"}>{t}</Link>
        ))}
      </div>

      <form className="card mb-5 flex flex-wrap items-end gap-3 p-3">
        <input type="hidden" name="ver" value={ver} />
        <div className="min-w-48 flex-1">
          <label className="lbl" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={q} placeholder="Clienta, email, teléfono o tratamiento" className="input" />
        </div>
        <div>
          <label className="lbl" htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={estado ?? ""} className="input">
            {ESTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <button className="btn-sec">Filtrar</button>
      </form>

      <ul className="card divide-y divide-[#f0ebe3]">
        {turnos.length === 0 && <li className="p-6 text-center text-sm text-[#8b8279]">No hay turnos con estos filtros.</li>}
        {turnos.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="w-56 text-sm font-medium first-letter:uppercase">{fechaHoraLarga(t.inicio)}</div>
            <div className="min-w-48 flex-1">
              <Link href={`/admin/clientas/${t.clientaId}`} className="font-medium hover:underline">{t.clienta.nombre}</Link>
              <p className="text-sm text-[#6b635b]">
                {t.servicio.nombre} · {formatPrecio(t.precio)}
                {t.montoSena > 0 && t.pagoEstado?.startsWith("approved") && ` · seña ${formatPrecio(t.montoSena)} pagada`}
              </p>
            </div>
            <EstadoBadge estado={t.estado} />
            {t.clienta.telefono && (
              <a className="btn-sec" target="_blank" rel="noopener" href={linkWhatsapp(t.clienta.telefono)}>WhatsApp</a>
            )}
          </li>
        ))}
      </ul>

      {paginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {pagina > 1 && <Link className="btn-sec" href={link({ pagina: String(pagina - 1) })}>← Anterior</Link>}
          <span className="text-[#6b635b]">Página {pagina} de {paginas}</span>
          {pagina < paginas && <Link className="btn-sec" href={link({ pagina: String(pagina + 1) })}>Siguiente →</Link>}
        </div>
      )}
    </div>
  );
}
