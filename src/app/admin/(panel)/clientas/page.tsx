import Link from "next/link";
import { prisma } from "@/lib/db";
import { fechaLarga } from "@/lib/tiempo";

export default async function Clientas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const clientas = await prisma.clienta.findMany({
    where: q
      ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { telefono: { contains: q } }] }
      : {},
    include: {
      _count: { select: { turnos: { where: { estado: { in: ["CONFIRMADO", "COMPLETADO"] } } } } },
      turnos: { orderBy: { inicio: "desc" }, take: 1, select: { inicio: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Clientas</h1>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, email o teléfono" className="input sm:!w-80" />
          <button className="btn-sec">Buscar</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[#6b635b] uppercase">
            <tr className="border-b border-[#f0ebe3]"><th className="p-3">Nombre</th><th className="p-3">Contacto</th><th className="p-3">Turnos</th><th className="p-3">Último turno</th></tr>
          </thead>
          <tbody className="divide-y divide-[#f0ebe3]">
            {clientas.map((c) => (
              <tr key={c.id}>
                <td className="p-3"><Link href={`/admin/clientas/${c.id}`} className="font-medium hover:underline">{c.nombre}</Link></td>
                <td className="p-3 text-[#6b635b]">{c.email}<br />{c.telefono}</td>
                <td className="p-3">{c._count.turnos}</td>
                <td className="p-3 first-letter:uppercase">{c.turnos[0] ? fechaLarga(c.turnos[0].inicio) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientas.length === 0 && <p className="p-6 text-center text-sm text-[#8b8279]">No se encontraron clientas.</p>}
      </div>
    </div>
  );
}
