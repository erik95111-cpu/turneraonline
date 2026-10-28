import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fechaHoraLarga } from "@/lib/tiempo";
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { EstadoBadge } from "@/components/EstadoBadge";
import { guardarFicha } from "../../../acciones";

export default async function FichaClienta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.clienta.findUnique({
    where: { id },
    include: { turnos: { include: { servicio: true }, orderBy: { inicio: "desc" } } },
  });
  if (!c) notFound();
  const realizados = c.turnos.filter((t) => t.estado === "COMPLETADO");

  return (
    <div>
      <Link href="/admin/clientas" className="text-sm text-[#6b635b] hover:underline">← Clientas</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">{c.nombre}</h1>
        <div className="flex gap-2">
          {c.telefono && <a className="btn-sec" href={linkWhatsapp(c.telefono)} target="_blank" rel="noopener">WhatsApp</a>}
          <a className="btn-sec" href={`mailto:${c.email}`}>Email</a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <form action={guardarFicha} className="card grid gap-4 p-5">
          <input type="hidden" name="id" value={c.id} />
          <h2 className="font-semibold">Ficha</h2>
          <div><label className="lbl">Nombre</label><input name="nombre" defaultValue={c.nombre} className="input" /></div>
          <div><label className="lbl">Email</label><input value={c.email} disabled className="input bg-[#f6f1e9]" /></div>
          <div><label className="lbl">Teléfono</label><input name="telefono" defaultValue={c.telefono} className="input" /></div>
          <div>
            <label className="lbl">Tipo de piel</label>
            <input name="tipoPiel" list="tipos-piel" defaultValue={c.tipoPiel} className="input" />
            <datalist id="tipos-piel">
              {["Normal", "Seca", "Grasa", "Mixta", "Sensible", "Con acné", "Madura"].map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div><label className="lbl">Alergias / contraindicaciones</label><textarea name="alergias" rows={2} defaultValue={c.alergias} className="input" /></div>
          <div><label className="lbl">Notas privadas</label><textarea name="notas" rows={5} defaultValue={c.notas} placeholder="Productos usados, evolución, recomendaciones…" className="input" /></div>
          <button className="btn justify-self-start">Guardar ficha</button>
        </form>

        <section>
          <h2 className="mb-3 font-semibold">Historial · {realizados.length} sesiones realizadas · {formatPrecio(realizados.reduce((a, t) => a + t.precio, 0))}</h2>
          <ul className="card divide-y divide-[#f0ebe3]">
            {c.turnos.length === 0 && <li className="p-4 text-sm text-[#a49d94]">Sin turnos.</li>}
            {c.turnos.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{t.servicio.nombre}</p>
                  <p className="text-[#6b635b] first-letter:uppercase">{fechaHoraLarga(t.inicio)} · {formatPrecio(t.precio)}</p>
                  {t.notasClienta && <p className="mt-1 text-xs text-[#8b8279] italic">“{t.notasClienta}”</p>}
                </div>
                <EstadoBadge estado={t.estado} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
