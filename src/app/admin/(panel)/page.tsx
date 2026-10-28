import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { aFechaUTC, fechaHoraLarga, fechaISO, fechaLarga, horaAR, sumarDias } from "@/lib/tiempo";
import { getConfig } from "@/lib/config";
import { senaPorTransferencia } from "@/lib/sena";
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { EstadoBadge } from "@/components/EstadoBadge";
import { cambiarEstadoTurno } from "../acciones";

export default async function Agenda({ searchParams }: { searchParams: Promise<{ desde?: string; aviso?: string }> }) {
  await requireAdmin(); // cada página revisa la sesión (el layout no se vuelve a ejecutar al navegar)
  const sp = await searchParams;
  const hoy = fechaISO(new Date());
  const desde = sp.desde && /^\d{4}-\d{2}-\d{2}$/.test(sp.desde) ? sp.desde : hoy;
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(desde, i));
  const ahora = new Date();

  const [cfg, cantidadUsuarios] = await Promise.all([getConfig(), prisma.administrador.count()]);
  const pendientes: { ok: boolean; texto: string; link: string }[] = [
    { ok: Boolean(cfg.emailProfesional), texto: "Email de la profesional (donde llegan los avisos)", link: "/admin/configuracion" },
    { ok: Boolean(cfg.whatsapp), texto: "WhatsApp (donde llegan los comprobantes de la seña)", link: "/admin/configuracion" },
    { ok: cfg.senaTipo === "NINGUNA" || senaPorTransferencia(cfg), texto: "Alias o CBU para la seña", link: "/admin/configuracion" },
    { ok: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS), texto: "Mails conectados (Gmail en Vercel)", link: "/admin/configuracion#mails" },
    { ok: cantidadUsuarios > 0, texto: "Usuario propio de la profesional", link: "/admin/usuarios" },
  ];
  const faltan = pendientes.filter((x) => !x.ok).length;

  const turnos = await prisma.turno.findMany({
    where: {
      inicio: { gte: aFechaUTC(desde, "00:00"), lt: aFechaUTC(sumarDias(desde, 7), "00:00") },
      OR: [{ estado: { not: "PENDIENTE_PAGO" } }, { expiraEn: { gt: ahora } }],
    },
    include: { clienta: true, servicio: true },
    orderBy: { inicio: "asc" },
  });

  const activos = turnos.filter((t) => t.estado !== "CANCELADO");
  const deHoy = activos.filter((t) => fechaISO(t.inicio) === hoy).length;
  const total = activos.reduce((a, t) => a + t.precio, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Agenda</h1>
          <p className="text-sm text-[#6b635b]">
            {desde === hoy ? `Hoy ${deHoy} turno${deHoy === 1 ? "" : "s"} · ` : ""}
            {activos.length} en la semana · {formatPrecio(total)} estimado
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-sec" href={`/admin?desde=${sumarDias(desde, -7)}`}>← Anterior</Link>
          {desde !== hoy && <Link className="btn-sec" href="/admin">Hoy</Link>}
          <Link className="btn-sec" href={`/admin?desde=${sumarDias(desde, 7)}`}>Siguiente →</Link>
          <form className="flex gap-2">
            <input type="date" name="desde" defaultValue={desde} className="input !w-auto !py-1.5" />
            <button className="btn-sec">Ir</button>
          </form>
          <Link className="btn" href="/admin/turnos/nuevo">+ Nuevo turno</Link>
        </div>
      </div>

      {faltan > 0 && (
        <section className="card mb-6 p-5">
          <h2 className="font-semibold">Puesta a punto · faltan {faltan} de {pendientes.length}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {pendientes.map((x) => (
              <li key={x.texto} className="flex items-center gap-2">
                <span className={x.ok ? "text-emerald-700" : "text-[#c9a96e]"}>{x.ok ? "✓" : "○"}</span>
                {x.ok ? <span className="text-[#8b8279] line-through">{x.texto}</span> : <Link href={x.link} className="underline">{x.texto}</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sp.aviso && (
        <p role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{sp.aviso}</p>
      )}

      <div className="space-y-6">
        {dias.map((dia) => {
          const delDia = turnos.filter((t) => fechaISO(t.inicio) === dia);
          return (
            <section key={dia}>
              <h2 className={`mb-2 text-sm font-semibold first-letter:uppercase ${dia === hoy ? "text-[#8a6d3b]" : "text-[#6b635b]"}`}>
                {fechaLarga(aFechaUTC(dia, "12:00"))}{dia === hoy && " · hoy"}
              </h2>
              {delDia.length === 0 ? (
                <p className="card px-4 py-3 text-sm text-[#a49d94]">Sin turnos</p>
              ) : (
                <ul className="card divide-y divide-[#f0ebe3]">
                  {delDia.map((t) => (
                    <li key={t.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${t.estado === "CANCELADO" ? "opacity-50" : ""}`}>
                      <span className="w-24 font-mono text-sm font-semibold">{horaAR(t.inicio)}–{horaAR(t.fin)}</span>
                      <div className="min-w-48 flex-1">
                        <Link href={`/admin/clientas/${t.clientaId}`} className="font-medium hover:underline">{t.clienta.nombre}</Link>
                        <p className="text-sm text-[#6b635b]">
                          {t.servicio.nombre} · {formatPrecio(t.precio)}
                          {t.montoSena > 0 && t.estado !== "PENDIENTE_PAGO" && ` · seña ${formatPrecio(t.montoSena)} recibida`}
                        </p>
                        {t.notasClienta && <p className="mt-1 text-xs text-[#8b8279] italic">“{t.notasClienta}”</p>}
                        {t.estado === "PENDIENTE_PAGO" && t.expiraEn && (
                          <p className="mt-1 text-xs text-amber-800 first-letter:uppercase">
                            Seña de {formatPrecio(t.montoSena)} · se libera el {fechaHoraLarga(t.expiraEn)} si no llega
                          </p>
                        )}
                      </div>
                      <EstadoBadge estado={t.estado} />
                      <div className="flex flex-wrap gap-1.5">
                        {t.clienta.telefono && (
                          <a className="btn-sec" target="_blank" rel="noopener" href={linkWhatsapp(t.clienta.telefono)}>WhatsApp</a>
                        )}
                        {t.estado === "PENDIENTE_PAGO" && (
                          <>
                            <EstadoForm id={t.id} desde={desde} estado="SENA_RECIBIDA" label="Seña recibida ✓" destacado />
                            <EstadoForm id={t.id} desde={desde} estado="CANCELADO" label="Cancelar" />
                          </>
                        )}
                        {t.estado === "CONFIRMADO" && (
                          <>
                            <EstadoForm id={t.id} desde={desde} estado="COMPLETADO" label="Realizado" />
                            <EstadoForm id={t.id} desde={desde} estado="AUSENTE" label="No vino" />
                            <EstadoForm id={t.id} desde={desde} estado="CANCELADO" label="Cancelar" />
                          </>
                        )}
                        {(t.estado === "COMPLETADO" || t.estado === "AUSENTE") && (
                          <EstadoForm id={t.id} desde={desde} estado="CONFIRMADO" label="Deshacer" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function EstadoForm({ id, desde, estado, label, destacado }: { id: string; desde: string; estado: string; label: string; destacado?: boolean }) {
  return (
    <form action={cambiarEstadoTurno}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="desde" value={desde} />
      <input type="hidden" name="estado" value={estado} />
      <button className={destacado ? "btn" : "btn-sec"}>{label}</button>
    </form>
  );
}
