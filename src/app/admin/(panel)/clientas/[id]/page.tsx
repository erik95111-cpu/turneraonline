import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fechaHoraLarga } from "@/lib/tiempo";
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { COLOR_ETIQUETA, ETIQUETAS_SUGERIDAS, diasParaCumple, edad, esNueva, eventosDelTurno } from "@/lib/clientas";
import { EstadoBadge } from "@/components/EstadoBadge";
import { BotonCopiar } from "@/components/BotonCopiar";
import { BotonBorrar } from "@/components/BotonBorrar";
import { IconoLapiz } from "@/components/Iconos";
import { agregarNotaAccion, borrarClientaAccion, borrarNotaAccion, editarClientaAccion, editarNotaAccion, etiquetaClientaAccion } from "../../../acciones";

const TIPOS_PIEL = ["Normal", "Seca", "Grasa", "Mixta", "Sensible", "Con acné", "Madura"];

/** "1984-09-11" → "11/09/1984" */
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");
const iniciales = (nombre: string) => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const cuandoCorto = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string; editarNota?: string; ok?: string; error?: string; aviso?: string }>;
}

export default async function FichaClienta({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await prisma.clienta.findUnique({
    where: { id },
    include: {
      turnos: { include: { servicio: true }, orderBy: { inicio: "desc" } },
      registroNotas: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();

  const realizados = c.turnos.filter((t) => t.estado === "COMPLETADO");
  const ausencias = c.turnos.filter((t) => t.estado === "AUSENTE").length;
  const cumple = diasParaCumple(c.fechaNacimiento);
  const anios = edad(c.fechaNacimiento);
  const nueva = esNueva(c.turnos);
  const editando = sp.editar === "1";
  const propias = c.etiquetas.filter((e) => !(ETIQUETAS_SUGERIDAS as readonly string[]).includes(e));

  return (
    <div>
      <Link href="/admin/clientas" className="text-sm text-[#6b635b] hover:underline">← Clientas</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b0a0c] font-serif text-xl text-[#e6cf9f]">{iniciales(c.nombre)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-3xl leading-tight">{c.nombre}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {nueva && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">✦ Nueva</span>}
            {c.etiquetas.map((e) => (
              <span key={e} className="flex items-center gap-1.5 rounded-full border border-[#e8e1d6] bg-white px-2 py-0.5 text-xs">
                <i className={`h-2 w-2 rounded-full ${COLOR_ETIQUETA[e] ?? "bg-[#c9a96e]"}`} />{e}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Link href={`/admin/clientas/${c.id}?editar=1`} className="btn-sec gap-1.5" title="Editar datos"><IconoLapiz /> Editar</Link>
          <BotonBorrar accion={borrarClientaAccion} campos={{ id: c.id }} etiqueta={`Borrar a ${c.nombre}`} conTexto
            pregunta={`¿Borrar a ${c.nombre}? Se borran también sus notas. No se puede deshacer.`} />
        </div>
      </div>

      {sp.ok && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.ok}</p>}
      {sp.aviso && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{sp.aviso} Te traje a su ficha.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* ── Contacto ── */}
          <section className="card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wider text-[#8b8279] uppercase">Perfil</p>
                <h2 className="font-semibold">Información de contacto</h2>
              </div>
              {!editando && <Link href={`/admin/clientas/${c.id}?editar=1`} className="btn-sec !px-2.5" aria-label="Editar contacto" title="Editar"><IconoLapiz /></Link>}
            </div>

            {editando ? (
              <form action={editarClientaAccion} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={c.id} />
                {sp.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">{sp.error}</p>}
                <div className="sm:col-span-2"><label className="lbl" htmlFor="nombre">Nombre y apellido</label><input id="nombre" name="nombre" required defaultValue={c.nombre} className="input" /></div>
                <div><label className="lbl" htmlFor="telefono">WhatsApp / Teléfono</label><input id="telefono" name="telefono" required defaultValue={c.telefono} className="input" /></div>
                <div><label className="lbl" htmlFor="email">Email (opcional)</label><input id="email" name="email" type="email" defaultValue={c.email ?? ""} className="input" /></div>
                <div><label className="lbl" htmlFor="fechaNacimiento">Fecha de nacimiento</label><input id="fechaNacimiento" name="fechaNacimiento" type="date" defaultValue={c.fechaNacimiento} className="input" /></div>
                <div><label className="lbl" htmlFor="direccion">Dirección</label><input id="direccion" name="direccion" defaultValue={c.direccion} className="input" /></div>
                <div>
                  <label className="lbl" htmlFor="tipoPiel">Tipo de piel</label>
                  <input id="tipoPiel" name="tipoPiel" list="tipos-piel" defaultValue={c.tipoPiel} className="input" />
                  <datalist id="tipos-piel">{TIPOS_PIEL.map((t) => <option key={t} value={t} />)}</datalist>
                </div>
                <div className="sm:col-span-2"><label className="lbl" htmlFor="alergias">Alergias / contraindicaciones</label><textarea id="alergias" name="alergias" rows={2} defaultValue={c.alergias} className="input" /></div>
                <div className="flex gap-2 sm:col-span-2">
                  <button className="btn">Guardar</button>
                  <Link href={`/admin/clientas/${c.id}`} className="btn-sec">Cancelar</Link>
                </div>
              </form>
            ) : (
              <ul className="divide-y divide-[#f0ebe3] text-sm">
                <li className="flex items-center gap-3 py-2.5">
                  <span aria-hidden="true">📞</span>
                  <span className="flex-1">{c.telefono || <em className="text-[#a49d94]">Sin teléfono</em>}</span>
                  {c.telefono && <BotonCopiar texto={c.telefono} etiqueta="teléfono" />}
                </li>
                <li className="flex items-center gap-3 py-2.5">
                  <span aria-hidden="true">✉️</span>
                  <span className="flex-1 break-all">{c.email || <em className="text-[#a49d94]">Sin mail (avisos por WhatsApp)</em>}</span>
                  {c.email && <BotonCopiar texto={c.email} etiqueta="mail" />}
                </li>
                <li className="flex items-center gap-3 py-2.5">
                  <span aria-hidden="true">🎂</span>
                  {c.fechaNacimiento ? (
                    <span className="flex-1">
                      {fechaCorta(c.fechaNacimiento)}{anios !== null && ` · ${anios} años`}
                      <span className="block text-xs font-semibold tracking-wider text-[#8a6d3b] uppercase">
                        {cumple === 0 ? "¡Hoy es su cumple! 🎉" : `Faltan ${cumple} día${cumple === 1 ? "" : "s"}`}
                      </span>
                    </span>
                  ) : <em className="flex-1 text-[#a49d94]">Sin fecha de nacimiento</em>}
                </li>
                <li className="flex items-center gap-3 py-2.5">
                  <span aria-hidden="true">📍</span>
                  <span className="flex-1">{c.direccion || <em className="text-[#a49d94]">Sin dirección registrada</em>}</span>
                </li>
              </ul>
            )}

            <p className="mt-5 mb-2 text-xs font-semibold tracking-wider text-[#8b8279] uppercase">Acciones rápidas</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/turnos/nuevo?clienta=${c.id}`} className="btn">📅 Ingresar reserva</Link>
              {c.telefono && <a className="btn-sec" href={linkWhatsapp(c.telefono, `Hola ${c.nombre.split(" ")[0]}! `)} target="_blank" rel="noopener">💬 Contactar por WhatsApp</a>}
            </div>
          </section>

          {/* ── Ficha ── */}
          <section className="card p-5">
            <p className="text-xs font-semibold tracking-wider text-[#8b8279] uppercase">Perfil</p>
            <h2 className="font-semibold">Datos de la ficha</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-[#8b8279]">Tipo de piel</dt><dd>{c.tipoPiel || "—"}</dd></div>
              <div><dt className="text-xs text-[#8b8279]">Sesiones realizadas</dt><dd>{realizados.length} · {formatPrecio(realizados.reduce((a, t) => a + t.precio, 0))}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-[#8b8279]">Alergias / contraindicaciones</dt><dd className="whitespace-pre-line">{c.alergias || "—"}</dd></div>
              {ausencias > 0 && <div><dt className="text-xs text-[#8b8279]">Ausencias</dt><dd>{ausencias}</dd></div>}
            </dl>
            {!editando && <Link href={`/admin/clientas/${c.id}?editar=1`} className="mt-3 inline-block text-xs text-[#8a6d3b] underline">Editar ficha</Link>}
          </section>
        </div>

        <div className="space-y-6">
          {/* ── Etiquetas ── */}
          <section className="card p-5">
            <p className="text-xs font-semibold tracking-wider text-[#8b8279] uppercase">Clasificación</p>
            <h2 className="font-semibold">Etiquetas</h2>
            <p className="mt-1 text-sm text-[#6b635b]">Tocá una para ponérsela o sacársela. “Nueva” se pone sola hasta su primera sesión realizada.</p>
            <form action={etiquetaClientaAccion} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="etiqueta" maxLength={30} placeholder="Ej: Recomienda, Prefiere mañana…" className="input" aria-label="Nueva etiqueta" />
              <button className="btn-sec shrink-0">+ Agregar</button>
            </form>
            <p className="mt-4 mb-2 text-xs font-semibold tracking-wider text-[#8b8279] uppercase">Sugeridas</p>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS_SUGERIDAS.map((e) => {
                const puesta = c.etiquetas.includes(e);
                return (
                  <form key={e} action={etiquetaClientaAccion}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="etiqueta" value={e} />
                    <button aria-pressed={puesta}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${puesta ? "border-[#0b0a0c] bg-[#0b0a0c] text-[#e6cf9f]" : "border-[#e8e1d6] hover:border-[#c9a96e]"}`}>
                      <i className={`h-2 w-2 rounded-full ${COLOR_ETIQUETA[e]}`} />{e}{puesta && " ✓"}
                    </button>
                  </form>
                );
              })}
            </div>
            <p className="mt-4 mb-2 text-xs font-semibold tracking-wider text-[#8b8279] uppercase">Tuyas</p>
            {propias.length === 0 ? (
              <p className="text-sm text-[#a49d94] italic">Todavía no creaste etiquetas para esta clienta.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {propias.map((e) => (
                  <form key={e} action={etiquetaClientaAccion}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="etiqueta" value={e} />
                    <button className="flex items-center gap-1.5 rounded-full border border-[#0b0a0c] bg-[#0b0a0c] px-3 py-1 text-sm text-[#e6cf9f]" aria-label={`Sacar la etiqueta ${e}`}>
                      {e} <span aria-hidden="true">×</span>
                    </button>
                  </form>
                ))}
              </div>
            )}
          </section>

          {/* ── Notas privadas ── */}
          <section id="notas" className="card scroll-mt-6 p-5">
            <p className="text-xs font-semibold tracking-wider text-[#8b8279] uppercase">Perfil interno</p>
            <h2 className="font-semibold">Notas privadas</h2>
            <p className="mt-1 text-sm text-[#6b635b]">Preferencias, productos usados, evolución… Sólo las ve el equipo, la clienta no.</p>
{!sp.editarNota && (
                        <form action={agregarNotaAccion} className="mt-3 grid gap-2">
              <input type="hidden" name="id" value={c.id} />
              <textarea name="texto" rows={3} required maxLength={2000} placeholder="Ej: Usamos peeling suave, buena tolerancia. Volver en 30 días." className="input" aria-label="Nueva nota" />
              <button className="btn justify-self-start">Agregar nota</button>
            </form>
            )}
            {c.registroNotas.length === 0 ? (
              <p className="mt-4 text-sm text-[#a49d94] italic">Todavía no registraste notas para esta clienta.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {c.registroNotas.map((n) => (
                  <li key={n.id} className="rounded-xl bg-[#f7f2ea] p-3 text-sm">
                    {sp.editarNota === n.id ? (
                      <form action={editarNotaAccion} className="grid gap-2">
                        <input type="hidden" name="notaId" value={n.id} />
                        <textarea name="texto" rows={3} required maxLength={2000} defaultValue={n.texto} className="input" aria-label="Editar nota" autoFocus />
                        <div className="flex gap-2">
                          <button className="btn">Guardar</button>
                          <Link href={`/admin/clientas/${c.id}#notas`} className="btn-sec">Cancelar</Link>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="whitespace-pre-line">{n.texto}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#8b8279]">
                          <span className="first-letter:uppercase">{cuandoCorto(n.createdAt)}{n.autor && ` · ${n.autor}`}</span>
                          <div className="flex gap-1">
                            <Link href={`/admin/clientas/${c.id}?editarNota=${n.id}#notas`} className="btn-sec !px-2 !py-1" aria-label="Editar nota" title="Editar"><IconoLapiz className="h-3.5 w-3.5" /></Link>
                            <BotonBorrar accion={borrarNotaAccion} campos={{ notaId: n.id }} etiqueta="Borrar nota" pregunta="¿Borrar esta nota?" />
                          </div>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* ── Historial ── */}
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Historial de turnos · {c.turnos.length}</h2>
        {c.turnos.length === 0 ? (
          <p className="card p-4 text-sm text-[#a49d94]">Todavía no tiene turnos. Con “Ingresar reserva” le cargás el primero.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-[#e8e1d6] pl-6">
            {c.turnos.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute top-5 -left-[31px] h-3 w-3 rounded-full border-2 border-[#c9a96e] bg-white" aria-hidden="true" />
                <div className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">Reservó {t.servicio.nombre}</p>
                      <p className="text-sm first-letter:uppercase">📅 {fechaHoraLarga(t.inicio)} · {formatPrecio(t.precio)}</p>
                    </div>
                    <EstadoBadge estado={t.estado} />
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {eventosDelTurno(t).reverse().map((e, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-2">
                        <i className={`h-1.5 w-1.5 rounded-full ${e.tipo === "sena" ? "bg-emerald-600" : "bg-[#c9a96e]"}`} aria-hidden="true" />
                        <span>{e.texto}{e.tipo === "sena" && t.montoSena ? ` · ${formatPrecio(t.montoSena)}` : ""}</span>
                        {e.canal && (
                          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider uppercase ${e.canal === "WhatsApp" ? "bg-emerald-100 text-emerald-800" : "bg-violet-100 text-violet-800"}`}>{e.canal}</span>
                        )}
                        {e.cuando && <span className="text-xs text-[#8b8279]">{cuandoCorto(e.cuando)}</span>}
                      </li>
                    ))}
                  </ul>
                  {t.notasClienta && <p className="mt-2 text-xs text-[#8b8279] italic">Comentario al reservar: “{t.notasClienta}”</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
