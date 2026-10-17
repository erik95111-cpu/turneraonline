import { getConfig } from "@/lib/config";
import { requireAdmin } from "@/lib/auth";
import { senaPorTransferencia } from "@/lib/sena";
import { enviarMailPrueba, guardarConfiguracion } from "../../acciones";

interface Avisos { ok?: string; mailok?: string; mailerror?: string }

export default async function Configuracion({ searchParams }: { searchParams: Promise<Avisos> }) {
  const [sp, c, yo] = await Promise.all([searchParams, getConfig(), requireAdmin()]);
  const smtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const sena = senaPorTransferencia(c);

  const Campo = (p: { name: keyof typeof c; label: string; type?: string; ayuda?: string; className?: string; placeholder?: string }) => (
    <div className={p.className}>
      <label className="lbl" htmlFor={p.name}>{p.label}</label>
      <input id={p.name} name={p.name} type={p.type ?? "text"} defaultValue={String(c[p.name] ?? "")} placeholder={p.placeholder} className="input" />
      {p.ayuda && <p className="mt-1 text-xs text-[#8b8279]">{p.ayuda}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Estado ok={smtp} titulo="Envío de mails" detalle={smtp ? "Configurado. Probalo abajo con un mail de prueba." : "Faltan las variables SMTP_* en Vercel"} />
        <Estado ok={sena} titulo="Seña por transferencia"
          detalle={sena ? "Activa: las clientas ven el alias/CBU al reservar" : c.senaTipo === "NINGUNA" ? "Sin seña: los turnos se confirman directo" : "Cargá el alias o CBU para pedir la seña"} />
        <Estado ok={Boolean(c.emailProfesional)} titulo="Email de la profesional" detalle={c.emailProfesional || "Completalo abajo para recibir los avisos de turnos"} />
        <Estado ok={Boolean(c.whatsapp)} titulo="WhatsApp" detalle={c.whatsapp || "Completalo: ahí llegan los comprobantes de la seña"} />
      </div>

      {/* Prueba de mails (formulario aparte) */}
      <form id="mails" action={enviarMailPrueba} className="card scroll-mt-20 p-5">
        <h2 className="font-semibold">Probar el envío de mails</h2>
        <p className="mt-1 text-sm text-[#6b635b]">Mandá un mail de prueba para confirmar que las clientas van a recibir la confirmación.</p>
        {sp.mailok && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">✓ {sp.mailok}</p>}
        {sp.mailerror && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">✗ {sp.mailerror}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="para">Email para la prueba</label>
          <input id="para" name="para" type="email" required defaultValue={c.emailProfesional || (yo.maestro ? "" : yo.email)} placeholder="tu@email.com" className="input !w-auto flex-1" />
          <button className="btn">Enviar mail de prueba</button>
        </div>
      </form>

      <form action={guardarConfiguracion} className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl">Configuración</h1>
          <button className="btn">Guardar cambios</button>
        </div>
        {sp.ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Cambios guardados ✓</p>}

        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Datos del negocio</h2>
          <Campo name="nombreNegocio" label="Nombre del negocio" />
          <Campo name="nombreProfesional" label="Nombre de la profesional" />
          <Campo name="emailProfesional" label="Email donde recibís los avisos de turnos" type="email" className="sm:col-span-2" />
          <Campo name="whatsapp" label="WhatsApp (ahí llegan los comprobantes)" ayuda="Con código de país, ej: +54 9 11 2345 6789" />
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
          <div className="sm:col-span-2">
            <h2 className="font-semibold">Seña por transferencia</h2>
            <p className="text-sm text-[#6b635b]">
              Al reservar, la clienta ve estos datos y un botón para mandarte la captura por WhatsApp.
              Cuando la recibís, en la Agenda tocás <strong>“Seña recibida”</strong> y el turno queda confirmado.
            </p>
          </div>
          <div>
            <label className="lbl" htmlFor="senaTipo">Tipo de seña</label>
            <select id="senaTipo" name="senaTipo" defaultValue={c.senaTipo} className="input">
              <option value="NINGUNA">Sin seña (se confirma directo)</option>
              <option value="FIJO">Monto fijo</option>
              <option value="PORCENTAJE">Porcentaje del precio</option>
            </select>
          </div>
          <Campo name="senaValor" label="Valor ($ o %)" type="number" />
          <Campo name="alias" label="Alias" placeholder="mc.healthy.skin" />
          <Campo name="cbu" label="CBU o CVU (22 números)" placeholder="0000003100000000000000" />
          <Campo name="titularCuenta" label="Titular de la cuenta" />
          <Campo name="banco" label="Banco o billetera" placeholder="Ej: Mercado Pago, Galicia…" />
          <Campo name="horasParaSena" label="Horas para mandar la seña" type="number"
            ayuda="El horario queda apartado este tiempo. Si no llega el comprobante, se libera solo." />
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
    </div>
  );
}

function Estado({ ok, titulo, detalle }: { ok: boolean; titulo: string; detalle: string }) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <p className="font-medium">{ok ? "✓" : "!"} {titulo}</p>
      <p className="break-words text-[#6b635b]">{detalle}</p>
    </div>
  );
}
