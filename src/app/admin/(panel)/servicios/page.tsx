import Link from "next/link";
import type { Servicio } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDuracion, formatPrecio } from "@/lib/formato";
import { eliminarServicio, guardarServicio } from "../../acciones";

export default async function Servicios({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const servicios = await prisma.servicio.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
  const enEdicion = editar === "nuevo" ? null : servicios.find((s) => s.id === editar);
  const categorias = [...new Set(servicios.map((s) => s.categoria))];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Tratamientos</h1>
        <Link href="/admin/servicios?editar=nuevo" className="btn">+ Nuevo tratamiento</Link>
      </div>

      {(editar === "nuevo" || enEdicion) && <FormServicio s={enEdicion ?? undefined} categorias={categorias} />}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[#6b635b] uppercase">
            <tr className="border-b border-[#f0ebe3]">
              <th className="p-3">Tratamiento</th><th className="p-3">Categoría</th><th className="p-3">Duración</th>
              <th className="p-3">Precio</th><th className="p-3">Estado</th><th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ebe3]">
            {servicios.map((s) => (
              <tr key={s.id} className={s.activo ? "" : "opacity-50"}>
                <td className="p-3 font-medium">{s.nombre}</td>
                <td className="p-3">{s.categoria}</td>
                <td className="p-3">{formatDuracion(s.duracionMin)}</td>
                <td className="p-3">{formatPrecio(s.precio)}</td>
                <td className="p-3">{s.activo ? "Visible" : "Oculto"}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1.5">
                    <Link className="btn-sec" href={`/admin/servicios?editar=${s.id}`}>Editar</Link>
                    <form action={eliminarServicio}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn-sec text-red-700">Eliminar</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {servicios.length === 0 && <p className="p-6 text-center text-sm text-[#8b8279]">Todavía no cargaste tratamientos.</p>}
      </div>
      <p className="mt-3 text-xs text-[#8b8279]">Si un tratamiento ya tiene turnos, al eliminarlo se oculta para conservar el historial.</p>
    </div>
  );
}

function FormServicio({ s, categorias }: { s?: Servicio; categorias: string[] }) {
  return (
    <form action={guardarServicio} className="card mb-6 grid gap-4 p-5 sm:grid-cols-6">
      <input type="hidden" name="id" value={s?.id ?? ""} />
      <h2 className="font-semibold sm:col-span-6">{s ? `Editar: ${s.nombre}` : "Nuevo tratamiento"}</h2>
      <div className="sm:col-span-4">
        <label className="lbl">Nombre</label>
        <input name="nombre" required defaultValue={s?.nombre} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="lbl">Categoría</label>
        <input name="categoria" list="categorias" defaultValue={s?.categoria ?? "Faciales"} className="input" />
        <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div className="sm:col-span-6">
        <label className="lbl">Descripción (se muestra en la web)</label>
        <textarea name="descripcion" rows={3} defaultValue={s?.descripcion} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="lbl">Duración (minutos)</label>
        <input name="duracionMin" type="number" min={5} step={5} required defaultValue={s?.duracionMin ?? 60} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="lbl">Precio ($)</label>
        <input name="precio" type="number" min={0} step={100} required defaultValue={s?.precio} className="input" />
      </div>
      <div className="sm:col-span-1">
        <label className="lbl">Orden</label>
        <input name="orden" type="number" defaultValue={s?.orden ?? 0} className="input" />
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-1">
        <input type="checkbox" name="activo" defaultChecked={s?.activo ?? true} /> Visible
      </label>
      <div className="flex gap-2 sm:col-span-6">
        <button className="btn">Guardar</button>
        <Link href="/admin/servicios" className="btn-sec">Cancelar</Link>
      </div>
    </form>
  );
}
