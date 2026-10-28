"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDuracion, formatPrecio } from "@/lib/formato";

interface Tratamiento { id: string; nombre: string; categoria: string; precio: number; duracionMin: number }

interface Props {
  accion: (fd: FormData) => Promise<void>;
  tratamientos: Tratamiento[];
  combo?: { id: string; nombre: string; descripcion: string; precio: number; duracionMin: number; orden: number; activo: boolean; incluye: string[] };
  error?: string;
}

/** Alta / edición de un combo: elige tratamientos y precio, y ve en vivo cuánto ahorra la clienta */
export function FormCombo({ accion, tratamientos, combo, error }: Props) {
  const [elegidos, setElegidos] = useState<string[]>(combo?.incluye ?? []);
  const [precio, setPrecio] = useState(combo ? String(combo.precio) : "");
  const sel = tratamientos.filter((t) => elegidos.includes(t.id));
  const separado = sel.reduce((a, t) => a + t.precio, 0);
  const duracionSumada = sel.reduce((a, t) => a + t.duracionMin, 0);
  const ahorro = separado - (Number(precio) || 0);
  const categorias = [...new Set(tratamientos.map((t) => t.categoria))];
  // Si al editar la duración guardada era la suma, el campo queda vacío (se sigue sumando sola)
  const sumaOriginal = tratamientos.filter((t) => combo?.incluye.includes(t.id)).reduce((a, t) => a + t.duracionMin, 0);
  const duracionInicial = combo && combo.duracionMin !== sumaOriginal ? String(combo.duracionMin) : "";

  const alternar = (id: string) => setElegidos((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  return (
    <form action={accion} className="card mb-6 grid gap-4 p-5 sm:grid-cols-6">
      <input type="hidden" name="id" value={combo?.id ?? ""} />
      <div className="sm:col-span-6">
        <h2 className="font-semibold">{combo ? `Editar combo: ${combo.nombre}` : "Nuevo combo / pack"}</h2>
        <p className="text-sm text-[#6b635b]">Elegí los tratamientos que incluye y el precio del combo. En la web se reserva como un solo turno.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-6">{error}</p>}

      <div className="sm:col-span-6">
        <label className="lbl" htmlFor="combo-nombre">Nombre del combo</label>
        <input id="combo-nombre" name="nombre" required defaultValue={combo?.nombre} placeholder="Ej: Pack Glow (limpieza + hidratación)" className="input" />
      </div>
      <div className="sm:col-span-6">
        <label className="lbl" htmlFor="combo-descripcion">Descripción (se muestra en la web, opcional)</label>
        <textarea id="combo-descripcion" name="descripcion" rows={2} defaultValue={combo?.descripcion} className="input" />
      </div>

      <fieldset className="sm:col-span-6">
        <legend className="lbl">Tratamientos que incluye (al menos 2)</legend>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {categorias.map((c) => (
            <div key={c} className="mt-2">
              <p className="mb-1 text-xs font-semibold tracking-wider text-[#8b8279] uppercase">{c}</p>
              {tratamientos.filter((t) => t.categoria === c).map((t) => (
                <label key={t.id} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-[#f7f2ea]">
                  <input type="checkbox" name="incluye" value={t.id} checked={elegidos.includes(t.id)} onChange={() => alternar(t.id)} className="mt-0.5" />
                  <span className="flex-1">{t.nombre}</span>
                  <span className="shrink-0 text-[#8b8279]">{formatDuracion(t.duracionMin)} · {formatPrecio(t.precio)}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="rounded-lg bg-[#f7f2ea] p-3 text-sm sm:col-span-6" aria-live="polite">
        {sel.length < 2 ? (
          <span className="text-[#6b635b]">Elegí al menos 2 tratamientos.</span>
        ) : (
          <>
            Por separado: <strong>{formatPrecio(separado)}</strong> · Duración sumada: <strong>{formatDuracion(duracionSumada)}</strong>
            {Number(precio) > 0 && (ahorro > 0
              ? <> · La clienta ahorra <strong className="text-emerald-700">{formatPrecio(ahorro)}</strong></>
              : <> · <span className="text-amber-800">El combo no sale más barato que por separado</span></>)}
          </>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="lbl" htmlFor="combo-precio">Precio del combo ($)</label>
        <input id="combo-precio" name="precio" type="number" min={1} step="any" inputMode="numeric" required value={precio} onChange={(e) => setPrecio(e.target.value)} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="lbl" htmlFor="combo-duracion">Duración (minutos)</label>
        <input id="combo-duracion" name="duracionMin" type="number" min={0} step={5} defaultValue={duracionInicial}
          placeholder={duracionSumada ? `${duracionSumada} (se suma sola)` : "Se suma sola"} className="input" />
      </div>
      <div className="sm:col-span-1">
        <label className="lbl" htmlFor="combo-orden">Orden</label>
        <input id="combo-orden" name="orden" type="number" defaultValue={combo?.orden ?? 0} className="input" />
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-1">
        <input type="checkbox" name="activo" defaultChecked={combo?.activo ?? true} /> Visible
      </label>
      <div className="flex gap-2 sm:col-span-6">
        <button className="btn">Guardar combo</button>
        <Link href="/admin/servicios" className="btn-sec">Cancelar</Link>
      </div>
    </form>
  );
}
