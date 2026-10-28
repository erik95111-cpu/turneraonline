import Link from "next/link";
import type { Servicio } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDuracion, formatPrecio } from "@/lib/formato";
import { ahorroCombo, conIncluye, textoIncluye } from "@/lib/combos";
import { FormCombo } from "@/components/FormCombo";
import { eliminarServicio, guardarComboAccion, guardarServicio } from "../../acciones";

export default async function Servicios({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string; error?: string }> }) {
  const { editar, ok, error } = await searchParams;
  const todos = await prisma.servicio.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }], include: conIncluye });
  const servicios = todos.filter((s) => !s.esCombo);
  const combos = todos.filter((s) => s.esCombo);
  const enEdicion = servicios.find((s) => s.id === editar);
  const comboEnEdicion = combos.find((s) => s.id === editar);
  const categorias = [...new Set(servicios.map((s) => s.categoria))];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Tratamientos</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/servicios?editar=nuevo-combo" className="btn-sec">+ Nuevo combo</Link>
          <Link href="/admin/servicios?editar=nuevo" className="btn">+ Nuevo tratamiento</Link>
        </div>
      </div>

      {ok && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</p>}
      {(editar === "nuevo" || enEdicion) && <FormServicio s={enEdicion ?? undefined} categorias={categorias} />}
      {(editar === "nuevo-combo" || comboEnEdicion) && (
        <FormCombo
          accion={guardarComboAccion}
          error={error}
          tratamientos={servicios.map(({ id, nombre, categoria, precio, duracionMin }) => ({ id, nombre, categoria, precio, duracionMin }))}
          combo={comboEnEdicion && { ...comboEnEdicion, incluye: comboEnEdicion.incluye.map((x) => x.id) }}
        />
      )}

      <div className="mb-8">
        <h2 className="mb-2 font-serif text-2xl">Combos / Packs</h2>
        {combos.length === 0 ? (
          <div className="card p-5 text-sm text-[#6b635b]">
            Todavía no hay combos. Con <Link href="/admin/servicios?editar=nuevo-combo" className="underline">+ Nuevo combo</Link> elegís
            varios tratamientos y les ponés un precio especial. En la web aparecen primero, en “Combos”.
          </div>
        ) : (
          <ul className="card divide-y divide-[#f0ebe3]">
            {combos.map((c) => {
              const { separado, ahorro } = ahorroCombo(c);
              return (
                <li key={c.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm ${c.activo ? "" : "opacity-50"}`}>
                  <div className="min-w-56 flex-1">
                    <p className="font-medium">{c.nombre} {!c.activo && <span className="ml-1 rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">Oculto</span>}</p>
                    <p className="text-[#6b635b]">Incluye: {textoIncluye(c) || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPrecio(c.precio)} · {formatDuracion(c.duracionMin)}</p>
                    <p className="text-xs text-[#8b8279]">Por separado {formatPrecio(separado)}{ahorro > 0 ? ` · ahorra ${formatPrecio(ahorro)}` : ""}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Link className="btn-sec" href={`/admin/servicios?editar=${c.id}`}>Editar</Link>
                    <form action={eliminarServicio}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn-sec text-red-700">Eliminar</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <h2 className="mb-2 font-serif text-2xl">Tratamientos</h2>

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
      <p className="mt-3 text-xs text-[#8b8279]">Si un tratamiento ya tiene turnos o forma parte de un combo, al eliminarlo se oculta para conservar el historial.</p>
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
