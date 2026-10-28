import Link from "next/link";
import { nombreTratamientos } from "@/lib/tratamientos";
import { prisma } from "@/lib/db";
import { aFechaUTC, fechaHoraLarga, fechaISO, fechaLarga, horaAR, sumarDias } from "@/lib/tiempo";
import { getConfig } from "@/lib/config";
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { EstadoBadge } from "@/components/EstadoBadge";
import { cambiarEstadoTurno } from "../acciones";

export default async function Agenda({ searchParams }: { searchParams: Promise<{ desde?: string; aviso?: string; clave?: string }> }) {
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
    prisma.turnoTratamiento.groupBy({
      by: ["servicioId"],
      where: { turno: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) }, estado: { not: "CANCELADO" } } },
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
    include: { clienta: true, servicio: true, tratamientos: { orderBy: { orden: "asc" as const } } },
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
                          {nombreTratamientos(t)} · {formatPrecio(t.precio)}
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
