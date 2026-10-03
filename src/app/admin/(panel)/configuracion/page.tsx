import { getConfig } from "@/lib/config";
import { mpHabilitado } from "@/lib/mercadopago";
import { guardarConfiguracion } from "../../acciones";

export default async function Configuracion({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const c = await getConfig();
  const smtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const mp = mpHabilitado();

  const Campo = (p: { name: keyof typeof c; label: string; type?: string; ayuda?: string; className?: string }) => (
    <div className={p.className}>
      <label className="lbl" htmlFor={p.name}>{p.label}</label>
      <input id={p.name} name={p.name} type={p.type ?? "text"} defaultValue={String(c[p.name] ?? "")} className="input" />
      {p.ayuda && <p className="mt-1 text-xs text-[#8b8279]">{p.ayuda}</p>}
    </div>
  );

  return (
    <form action={guardarConfiguracion} className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">Configuración</h1>
        <button className="btn">Guardar cambios</button>
      </div>
      {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Cambios guardados ✓</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Estado ok={smtp} titulo="Envío de mails" detalle={smtp ? "Configurado" : "Falta configurar SMTP_* (ver README)"} />
        <Estado ok={mp} titulo="Mercado Pago" detalle={mp ? "Conectado" : "Falta MP_ACCESS_TOKEN: los turnos se confirman sin seña"} />
      </div>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Datos del negocio</h2>
        <Campo name="nombreNegocio" label="Nombre del negocio" />
        <Campo name="nombreProfesional" label="Nombre de la profesional" />
        <Campo name="emailProfesional" label="Email donde recibís los avisos de turnos" type="email" className="sm:col-span-2" />
        <Campo name="whatsapp" label="WhatsApp" ayuda="Con código de país, ej: +54 9 11 2345 6789" />
        <Campo name="instagram" label="Instagram" ayuda="Ej: @healthyskin" />
        <Campo name="direccion" label="Dirección" className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <label className="lbl" htmlFor="sobreMi">Sobre mí (se muestra en la web)</label>
          <textarea id="sobreMi" name="sobreMi" rows={4} defaultValue={c.sobreMi} className="input" />
        </div>
        <Campo name="videoUrl" label="Video de presentación" className="sm:col-span-2"
          ayuda="Link de YouTube, Vimeo o de un archivo .mp4. Aparece al final de la página de inicio." />
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Seña con Mercado Pago</h2>
        <div>
          <label className="lbl" htmlFor="senaTipo">Tipo de seña</label>
          <select id="senaTipo" name="senaTipo" defaultValue={c.senaTipo} className="input">
            <option value="NINGUNA">Sin seña</option>
            <option value="PORCENTAJE">Porcentaje del precio</option>
            <option value="FIJO">Monto fijo</option>
          </select>
        </div>
        <Campo name="senaValor" label="Valor (% o $)" type="number" />
        <Campo name="minutosParaPagar" label="Minutos para pagar la seña" type="number"
          ayuda="Si no paga en este tiempo, el horario se libera." />
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Reglas de reserva</h2>
        <Campo name="intervaloMin" label="Ofrecer horarios cada (minutos)" type="number" />
        <Campo name="anticipacionMinHoras" label="Anticipación mínima (horas)" type="number" />
        <Campo name="diasMaxReserva" label="Se puede reservar hasta (días adelante)" type="number" />
        <Campo name="horasParaCancelar" label="Cancelación online hasta (horas antes)" type="number" />
        <div className="sm:col-span-2">
          <label className="lbl" htmlFor="politicaCancelacion">Política de cancelación (se muestra al reservar y en el mail)</label>
          <textarea id="politicaCancelacion" name="politicaCancelacion" rows={2} defaultValue={c.politicaCancelacion} className="input" />
        </div>
      </section>

      <button className="btn">Guardar cambios</button>
    </form>
  );
}

function Estado({ ok, titulo, detalle }: { ok: boolean; titulo: string; detalle: string }) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <p className="font-medium">{ok ? "✓" : "!"} {titulo}</p>
      <p className="text-[#6b635b]">{detalle}</p>
    </div>
  );
}
