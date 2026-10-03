import { prisma } from "@/lib/db";
import { fechaHoraLarga } from "@/lib/tiempo";
import { agregarBloqueo, agregarFranja, eliminarBloqueo, eliminarFranja } from "../../acciones";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

export default async function Horarios() {
  const [franjas, bloqueos] = await Promise.all([
    prisma.horarioAtencion.findMany({ orderBy: { horaInicio: "asc" } }),
    prisma.bloqueo.findMany({ where: { hasta: { gt: new Date() } }, orderBy: { desde: "asc" } }),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h1 className="font-serif text-3xl">Horarios de atención</h1>
        <p className="mb-4 text-sm text-[#6b635b]">Podés cargar varias franjas por día (ej: 9 a 13 y 15 a 19).</p>
        <div className="card divide-y divide-[#f0ebe3]">
          {ORDEN.map((d) => {
            const delDia = franjas.filter((f) => f.diaSemana === d);
            return (
              <div key={d} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="w-24 text-sm font-medium">{DIAS[d]}</span>
                {delDia.length === 0 && <span className="text-sm text-[#a49d94]">Cerrado</span>}
                {delDia.map((f) => (
                  <form key={f.id} action={eliminarFranja} className="flex items-center gap-1 rounded-full bg-[#f6f1e9] py-1 pr-1 pl-3 text-sm">
                    <input type="hidden" name="id" value={f.id} />
                    {f.horaInicio} – {f.horaFin}
                    <button title="Quitar" className="h-6 w-6 rounded-full text-[#8b8279] hover:bg-white hover:text-red-700">×</button>
                  </form>
                ))}
              </div>
            );
          })}
        </div>
        <form action={agregarFranja} className="card mt-4 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="lbl">Día</label>
            <select name="diaSemana" className="input">{ORDEN.map((d) => <option key={d} value={d}>{DIAS[d]}</option>)}</select>
          </div>
          <div><label className="lbl">Desde</label><input type="time" name="horaInicio" required defaultValue="09:00" className="input" /></div>
          <div><label className="lbl">Hasta</label><input type="time" name="horaFin" required defaultValue="13:00" className="input" /></div>
          <button className="btn">Agregar</button>
        </form>
      </section>

      <section>
        <h2 className="font-serif text-3xl">Días bloqueados</h2>
        <p className="mb-4 text-sm text-[#6b635b]">Vacaciones, feriados o momentos en los que no querés recibir turnos.</p>
        <form action={agregarBloqueo} className="card grid gap-3 p-4 sm:grid-cols-2">
          <div><label className="lbl">Desde (día)</label><input type="date" name="desdeFecha" required className="input" /></div>
          <div><label className="lbl">Hora (opcional)</label><input type="time" name="desdeHora" className="input" /></div>
          <div><label className="lbl">Hasta (día)</label><input type="date" name="hastaFecha" className="input" /></div>
          <div><label className="lbl">Hora (opcional)</label><input type="time" name="hastaHora" className="input" /></div>
          <div className="sm:col-span-2"><label className="lbl">Motivo</label><input name="motivo" placeholder="Vacaciones" className="input" /></div>
          <div className="sm:col-span-2"><button className="btn">Bloquear</button></div>
        </form>
        <ul className="card mt-4 divide-y divide-[#f0ebe3]">
          {bloqueos.length === 0 && <li className="p-4 text-sm text-[#a49d94]">No hay bloqueos próximos.</li>}
          {bloqueos.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{b.motivo || "Bloqueado"}</p>
                <p className="text-[#6b635b] first-letter:uppercase">{fechaHoraLarga(b.desde)} → {fechaHoraLarga(b.hasta)}</p>
              </div>
              <form action={eliminarBloqueo}>
                <input type="hidden" name="id" value={b.id} />
                <button className="btn-sec">Quitar</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
