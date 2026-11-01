import Link from "next/link";
import { crearClientaAccion } from "../../../acciones";

const TIPOS_PIEL = ["Normal", "Seca", "Grasa", "Mixta", "Sensible", "Con acné", "Madura"];

/** Alta de una clienta a mano (sin que tenga que reservar por la web) */
export default async function NuevaClienta({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/clientas" className="text-sm text-[#6b635b] hover:underline">← Clientas</Link>
      <h1 className="mt-2 mb-1 font-serif text-3xl">Nueva clienta</h1>
      <p className="mb-6 text-sm text-[#6b635b]">Sólo el nombre y el WhatsApp son obligatorios. El resto lo podés completar después.</p>
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <form action={crearClientaAccion} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="lbl" htmlFor="nombre">Nombre y apellido *</label><input id="nombre" name="nombre" required minLength={2} autoFocus className="input" /></div>
        <div><label className="lbl" htmlFor="telefono">WhatsApp / Teléfono *</label><input id="telefono" name="telefono" type="tel" required minLength={6} placeholder="Ej: 11 2345 6789" className="input" /></div>
        <div><label className="lbl" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" /></div>
        <div><label className="lbl" htmlFor="fechaNacimiento">Fecha de nacimiento</label><input id="fechaNacimiento" name="fechaNacimiento" type="date" className="input" /></div>
        <div><label className="lbl" htmlFor="direccion">Dirección</label><input id="direccion" name="direccion" className="input" /></div>
        <div>
          <label className="lbl" htmlFor="tipoPiel">Tipo de piel</label>
          <input id="tipoPiel" name="tipoPiel" list="tipos-piel" className="input" />
          <datalist id="tipos-piel">{TIPOS_PIEL.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div><label className="lbl" htmlFor="alergias">Alergias / contraindicaciones</label><input id="alergias" name="alergias" className="input" /></div>
        <div className="sm:col-span-2"><label className="lbl" htmlFor="nota">Primera nota privada (opcional)</label><textarea id="nota" name="nota" rows={3} className="input" /></div>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn">Guardar clienta</button>
          <Link href="/admin/clientas" className="btn-sec">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
