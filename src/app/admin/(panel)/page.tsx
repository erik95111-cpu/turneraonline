import Link from "next/link";
import { prisma } from "@/lib/db";
import { aFechaUTC, fechaHoraLarga, fechaISO, fechaLarga, horaAR, sumarDias } from "@/lib/tiempo";
import { getConfig } from "@/lib/config";
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { EstadoBadge } from "@/components/EstadoBadge";
import { BotonAvisoWhatsapp } from "@/components/BotonAvisoWhatsapp";
import { linkAvisoWhatsapp, linkImagenTurno } from "@/lib/whatsapp";
import { cambiarEstadoTurno, enviarRecordatorioMailAccion, enviarRecordatoriosDelDiaAccion } from "../acciones";
import { turnosDelDia } from "@/lib/recordatorios";

/** Lo que hace falta para armar el mensaje de WhatsApp de un turno */
const datosAviso = { clienta: true, servicio: { include: { incluye: { select: { nombre: true } } } }, giftCard: true } as const;

export default async function Agenda({ searchParams }: { searchParams: Promise<{ desde?: string; aviso?: string; clave?: string; avisar?: string; avisarCancelacion?: string; rec?: string; recOk?: string; recError?: string }> }) {
  const sp = await searchParams;
  const hoy = fechaISO(new Date());
  const desde = sp.desde && /^\d{4}-\d{2}-\d{2}$/.test(sp.desde) ? sp.desde : hoy;
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(desde, i));
  const ahora = new Date();

  const finHoy = aFechaUTC(sumarDias(hoy, 1), "00:00");
  const [cfg, cantidadUsuarios, kTurnosHoy, kEsperando, kProximos, masPedido] = await Promise.all([
    getConfig(),
    prisma.administrador.count(),
    prisma.turno.count({ where: { inicio: { gte: aFechaUTC(hoy, "00:00"), lt: finHoy }, estado: { in: ["CONFIRMADO", "PENDIENTE_PAGO", "COMPLETADO"] } } }),
    prisma.turno.count({ where: { estado: "PENDIENTE_PAGO", expiraEn: { gt: ahora } } }),
    prisma.turno.count({ where: { inicio: { gte: ahora, lt: aFechaUTC(sumarDias(hoy, 8), "00:00") }, OR: [{ estado: "CONFIRMADO" }, { estado: "PENDIENTE_PAGO", expiraEn: { gt: ahora } }] } }),
    prisma.turno.groupBy({
      by: ["servicioId"],
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) }, estado: { not: "CANCELADO" } },
      _count: { _all: true },
      orderBy: { _count: { servicioId: "desc" } },
      take: 1,
    }),
  ]);
  const servicioTop = masPedido[0]
    ? await prisma.servicio.findUnique({ where: { id: masPedido[0].servicioId }, select: { nombre: true } })
    : null;
  const tarjetas: { valor: string; texto: string; link: string; destacar?: boolean }[] = [
    { valor: String(kTurnosHoy), texto: "Turnos hoy", link: "/admin/turnos?ver=hoy" },
    { valor: String(kEsperando), texto: "Esperando seña", link: "/admin/turnos?estado=PENDIENTE_PAGO", destacar: kEsperando > 0 },
    { valor: String(kProximos), texto: "Próximos 7 días", link: "/admin/turnos?ver=7dias" },
    { valor: servicioTop?.nombre ?? "—", texto: "Más pedido (30 días)", link: "/admin/estadisticas" },
  ];
  const pendientes: { ok: boolean; texto: string; link: string }[] = [
    { ok: Boolean(cfg.emailProfesional), texto: "Email de la profesional (donde llegan los avisos)", link: "/admin/configuracion" },
    { ok: Boolean(cfg.whatsapp), texto: "WhatsApp (ahí te escriben para abonar la seña)", link: "/admin/configuracion" },
    { ok: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS), texto: "Mails conectados (Gmail en Vercel)", link: "/admin/configuracion#mails" },
    { ok: cantidadUsuarios > 0, texto: "Usuario propio de la profesional", link: "/admin/usuarios" },
  ];
  const faltan = pendientes.filter((x) => !x.ok).length;

  const turnos = await prisma.turno.findMany({
    where: {
      inicio: { gte: aFechaUTC(desde, "00:00"), lt: aFechaUTC(sumarDias(desde, 7), "00:00") },
      OR: [{ estado: { not: "PENDIENTE_PAGO" } }, { expiraEn: { gt: ahora } }],
    },
    include: datosAviso,
    orderBy: { inicio: "asc" },
  });

  // WhatsApp con un toque: turno recién cargado / confirmado / cancelado, confirmaciones que
  // faltan mandar (por ej. reservas de la web) y recordatorios de mañana
  const manana = sumarDias(hoy, 1);
  // Día de los recordatorios: mañana, salvo que elija otro
  const diaRec = sp.rec && /^\d{4}-\d{2}-\d{2}$/.test(sp.rec) ? sp.rec : manana;
  const [paraAvisar, cancelado, recordatorios, sinConfirmar] = await Promise.all([
    sp.avisar ? prisma.turno.findUnique({ where: { id: sp.avisar }, include: datosAviso }) : null,
    sp.avisarCancelacion ? prisma.turno.findUnique({ where: { id: sp.avisarCancelacion }, include: datosAviso }) : null,
    turnosDelDia(diaRec),
    prisma.turno.findMany({
      where: { estado: "CONFIRMADO", avisarWhatsapp: true, confirmacionWaEn: null, inicio: { gt: ahora }, NOT: { id: sp.avisar ?? "" } },
      include: datosAviso,
      orderBy: { inicio: "asc" },
      take: 20,
    }),
  ]);
  type ConDatos = NonNullable<typeof paraAvisar>;
  const aviso = (t: ConDatos, tipo: "confirmacion" | "recordatorio" | "cancelacion") => linkAvisoWhatsapp(cfg, t, tipo);
  /** Botón de confirmación con la opción de mandar el precio y de bajar la imagen */
  const botonConfirmacion = (t: ConDatos, destacado = false) => (
    <BotonAvisoWhatsapp href={aviso(t, "confirmacion")!} hrefConPrecio={linkAvisoWhatsapp(cfg, t, "confirmacion", { conPrecio: true })!}
      imagen={linkImagenTurno(t, "confirmacion")} turnoId={t.id} tipo="confirmacion" enviadoEn={t.confirmacionWaEn?.toISOString()} destacado={destacado} />
  );

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

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <Link key={t.texto} href={t.link}
            className={`card block p-4 transition hover:border-[#c9a96e] ${t.destacar ? "!border-amber-300 !bg-amber-50 ring-1 ring-amber-300" : ""}`}>
            <p className={`truncate font-serif ${t.valor.length > 3 ? "text-xl leading-8" : "text-3xl"}`}>{t.valor}</p>
            <p className="text-xs text-[#6b635b]">{t.texto}</p>
          </Link>
        ))}
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

      {sp.clave === "nueva" && (
        <p role="status" className="mb-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Listo, tu contraseña nueva quedó guardada.</p>
      )}
      {paraAvisar && paraAvisar.estado === "CONFIRMADO" && aviso(paraAvisar, "confirmacion") && (
        <section role="status" className="card mb-6 flex flex-wrap items-center gap-3 !border-emerald-300 !bg-emerald-50 p-4 text-sm">
          <p className="min-w-56 flex-1">
            Turno de <strong>{paraAvisar.clienta.nombre}</strong> confirmado ({fechaHoraLarga(paraAvisar.inicio)}).
            {paraAvisar.confirmacionWaEn ? " La confirmación por WhatsApp ya salió." : " Mandale la confirmación por WhatsApp:"}
          </p>
          {botonConfirmacion(paraAvisar, true)}
        </section>
      )}
      {cancelado && aviso(cancelado, "cancelacion") && (
        <section role="status" className="card mb-6 flex flex-wrap items-center gap-3 p-4 text-sm">
          <p className="min-w-56 flex-1">Se canceló el turno de <strong>{cancelado.clienta.nombre}</strong>. ¿Le avisás por WhatsApp?</p>
          <BotonAvisoWhatsapp href={aviso(cancelado, "cancelacion")!} turnoId={cancelado.id} tipo="cancelacion" destacado />
        </section>
      )}
      {sinConfirmar.filter((t) => aviso(t, "confirmacion")).length > 0 && (
        <section className="card mb-6 p-4">
          <h2 className="font-semibold">Confirmaciones para mandar por WhatsApp</h2>
          <p className="mb-3 text-sm text-[#6b635b]">Turnos confirmados a los que todavía no les mandaste la confirmación (por ejemplo, reservas de la web).</p>
          <ul className="divide-y divide-[#f0ebe3]">
            {sinConfirmar.filter((t) => aviso(t, "confirmacion")).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-56 flex-1 first-letter:uppercase">{fechaHoraLarga(t.inicio)} · <strong>{t.clienta.nombre}</strong> · {t.servicio.nombre}</span>
                {botonConfirmacion(t)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section id="recordatorios" className="card mb-6 scroll-mt-6 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Recordatorios</h2>
            <p className="text-sm text-[#6b635b]">Mandá el recordatorio a cada clienta por WhatsApp o por mail. Se puede reenviar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[[hoy, "Hoy"], [manana, "Mañana"], [sumarDias(hoy, 2), "Pasado mañana"]].map(([f, t]) => (
              <Link key={f} href={`/admin?rec=${f}#recordatorios`} className={diaRec === f ? "btn" : "btn-sec"}>{t}</Link>
            ))}
            <form className="flex gap-1.5">
              <input type="date" name="rec" defaultValue={diaRec} className="input !w-auto !py-1.5" aria-label="Otro día" />
              <button className="btn-sec">Ver</button>
            </form>
          </div>
        </div>

        <p className="mt-3 text-xs text-[#6b635b]">
          {cfg.recordatoriosAutoEn
            ? <>Recordatorio automático por mail: corrió el <span className="first-letter:uppercase">{fechaHoraLarga(cfg.recordatoriosAutoEn)}</span> · {cfg.recordatoriosAutoResultado}</>
            : <span className="text-amber-800">El recordatorio automático por mail todavía no registró ninguna ejecución. Mientras tanto, mandalos desde acá.</span>}
        </p>
        {sp.recOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.recOk}</p>}
        {sp.recError && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{sp.recError}</p>}

        <h3 className="mt-4 mb-1 text-sm font-semibold first-letter:uppercase">{fechaLarga(aFechaUTC(diaRec, "12:00"))}{diaRec === manana ? " · mañana" : diaRec === hoy ? " · hoy" : ""}</h3>
        {recordatorios.length === 0 ? (
          <p className="py-3 text-sm text-[#a49d94]">No hay turnos ese día.</p>
        ) : (
          <>
            <ul className="divide-y divide-[#f0ebe3]">
              {recordatorios.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
                  <span className="w-14 font-mono font-semibold">{horaAR(t.inicio)}</span>
                  <span className="min-w-48 flex-1">
                    <strong>{t.clienta.nombre}</strong> · {t.servicio.nombre}
                    {t.estado === "PENDIENTE_PAGO" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Esperando seña</span>}
                  </span>
                  {aviso(t, "recordatorio") && (
                    <BotonAvisoWhatsapp href={aviso(t, "recordatorio")!} imagen={linkImagenTurno(t, "recordatorio")} turnoId={t.id} tipo="recordatorio" enviadoEn={t.recordatorioWaEn?.toISOString()} />
                  )}
                  {t.clienta.email ? (
                    <form action={enviarRecordatorioMailAccion}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="rec" value={diaRec} />
                      <button className={t.recordatorioEnviado ? "btn-sec !text-emerald-800" : "btn-sec"} title={t.recordatorioEnviado ? "Tocá para volver a mandarlo" : undefined}>
                        {t.recordatorioEnviado ? "✓ Mail enviado" : "Enviar recordatorio por mail"}
                      </button>
                    </form>
                  ) : <span className="text-xs text-[#a49d94]">Sin mail</span>}
                </li>
              ))}
            </ul>
            {recordatorios.some((t) => t.clienta.email && !t.recordatorioEnviado) && (
              <form action={enviarRecordatoriosDelDiaAccion} className="mt-3">
                <input type="hidden" name="rec" value={diaRec} />
                <button className="btn">Enviar todos los mails que faltan</button>
              </form>
            )}
          </>
        )}
      </section>
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
                          {t.montoGiftCard > 0 && ` · gift card ${formatPrecio(t.montoGiftCard)}`}
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
                        {t.estado === "CONFIRMADO" && t.avisarWhatsapp && t.inicio > ahora && aviso(t, "confirmacion") ? (
                          botonConfirmacion(t)
                        ) : t.clienta.telefono ? (
                          <a className="btn-sec" target="_blank" rel="noopener" href={linkWhatsapp(t.clienta.telefono)}>WhatsApp</a>
                        ) : null}
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
