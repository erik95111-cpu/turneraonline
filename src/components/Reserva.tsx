"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { TipoSena } from "@prisma/client";
import { Calendario } from "./Calendario";
import { formatDuracion, formatPrecio } from "@/lib/formato";
import { calcularSena } from "@/lib/sena";
import { DIAS, MESES } from "@/lib/dias";
import type { ResultadoReserva } from "@/app/actions/reservas";

export interface ServicioReserva {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  duracionMin: number;
  precio: number;
}

interface Props {
  servicios: ServicioReserva[];
  servicioInicial?: string;
  diasAtencion: number[];
  desde: string;
  hasta: string;
  sena: { tipo: TipoSena; valor: number; activa: boolean };
  politica: string;
  accion: (datos: unknown, honeypot?: string) => Promise<ResultadoReserva>;
  /** "claro" = panel de administración (sin límites de fecha, colores claros) */
  tema?: "oscuro" | "claro";
}

type NumeroPaso = 1 | 2 | 3 | 4;
const PASOS: { n: NumeroPaso; titulo: string }[] = [
  { n: 1, titulo: "Tratamiento" },
  { n: 2, titulo: "Día y horario" },
  { n: 3, titulo: "Tus datos" },
  { n: 4, titulo: "Confirmar" },
];

const VACIO = { nombre: "", email: "", telefono: "", notas: "" };

function fechaTexto(f: string, corta = false) {
  const d = new Date(`${f}T12:00:00Z`);
  const dia = DIAS[d.getUTCDay()].toLowerCase();
  return corta
    ? `${dia.slice(0, 3)} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`
    : `${dia} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()].toLowerCase()}`;
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function Reserva(p: Props) {
  const panel = p.tema === "claro";
  const [paso, setPaso] = useState<NumeroPaso>(1);
  const [servicioId, setServicioId] = useState<string | null>(
    p.servicios.some((s) => s.id === p.servicioInicial) ? p.servicioInicial! : null,
  );
  const [mes, setMes] = useState(() => {
    const [y, m] = p.desde.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [disponibilidad, setDisponibilidad] = useState<Record<string, number> | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [form, setForm] = useState(VACIO);
  const [trampa, setTrampa] = useState("");
  const [enviando, startTransition] = useTransition();
  const saltoMes = useRef(false);
  const tarjetaRef = useRef<HTMLDivElement>(null);

  const servicio = p.servicios.find((s) => s.id === servicioId) ?? null;
  const montoSena = servicio && p.sena.activa ? calcularSena(servicio.precio, p.sena.tipo, p.sena.valor) : 0;
  const categorias = useMemo(() => [...new Set(p.servicios.map((s) => s.categoria))], [p.servicios]);
  const extra = panel ? "&panel=1" : "";
  const mesTexto = `${mes.y}-${String(mes.m + 1).padStart(2, "0")}`;

  // Si entran con un tratamiento elegido desde la web, arrancan en el paso 2
  useEffect(() => {
    if (servicioId) setPaso(2);
  }, []); // sólo al montar

  // Disponibilidad del mes (colores del calendario)
  useEffect(() => {
    setDisponibilidad(null);
    if (!servicioId) return;
    const ctrl = new AbortController();
    fetch(`/api/disponibilidad/mes?servicio=${servicioId}&mes=${mesTexto}${extra}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ dias: Record<string, number> }>;
      })
      .then((d) => {
        const dias = d.dias ?? {};
        setDisponibilidad(dias);
        // Si en el mes actual ya no queda nada, saltamos una vez al siguiente
        const hayLugar = Object.values(dias).some((n) => n > 0);
        if (!hayLugar && !saltoMes.current && mesTexto < p.hasta.slice(0, 7)) {
          saltoMes.current = true;
          setMes(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
        }
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setErrorCarga(true);
      });
    return () => ctrl.abort();
  }, [servicioId, mesTexto, extra, recarga, p.hasta]);

  // Horarios del día elegido
  useEffect(() => {
    setHora(null);
    setHorarios(null);
    if (!servicioId || !fecha) return;
    const ctrl = new AbortController();
    fetch(`/api/disponibilidad?servicio=${servicioId}&fecha=${fecha}${extra}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ horarios: string[] }>;
      })
      .then((d) => setHorarios(Array.isArray(d.horarios) ? d.horarios : []))
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setErrorCarga(true);
      });
    return () => ctrl.abort();
  }, [servicioId, fecha, extra, recarga]);

  function irA(n: NumeroPaso) {
    setPaso(n);
    setError(null);
    // En el celular, llevar la vista al principio de la tarjeta
    requestAnimationFrame(() => {
      const el = tarjetaRef.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function elegirServicio(id: string) {
    if (id !== servicioId) {
      setServicioId(id);
      setFecha(null);
      saltoMes.current = false;
    }
    setTimeout(() => irA(2), 150);
  }

  function enviar() {
    if (!servicio || !fecha || !hora) return;
    setError(null);
    startTransition(async () => {
      const r = await p.accion({ servicioId: servicio.id, fecha, hora, ...form }, trampa);
      if (r.ok) {
        window.location.href = r.url;
        return;
      }
      setError(r.error);
      // Si el horario se ocupó, volvemos a elegir horario (los datos cargados se conservan)
      if (/horario/i.test(r.error)) {
        setRecarga((n) => n + 1);
        setHora(null);
        irA(2);
      }
    });
  }

  const resumen: Record<NumeroPaso, string> = {
    1: servicio?.nombre ?? "",
    2: fecha && hora ? `${mayuscula(fechaTexto(fecha, true))} · ${hora} hs` : "",
    3: paso > 3 ? form.nombre : "",
    4: "",
  };
  const completo = (n: NumeroPaso) => n < paso && Boolean(resumen[n]);

  const campoForm = (k: keyof typeof VACIO) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  const maniana = horarios?.filter((h) => h < "13:00") ?? [];
  const tarde = horarios?.filter((h) => h >= "13:00") ?? [];

  return (
    <div className={`grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:gap-12 ${panel ? "tema-claro" : ""}`}>
      {/* ── Columna izquierda: título y pasos ── */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        {!panel && (
          <>
            <p className="eyebrow flex items-center gap-3"><span className="h-px w-8 bg-gold" />Turnos online</p>
            <h1 className="mt-4 font-serif text-4xl leading-tight text-cream sm:text-5xl">
              Reservá tu turno <em className="texto-oro">sin llamar</em>.
            </h1>
            <p className="mt-3 max-w-sm text-sm text-piedra">Elegí el tratamiento, el sábado y el horario. Te llega la confirmación por mail.</p>
          </>
        )}

        {/* Progreso compacto (celular) */}
        <div className="mt-6 lg:hidden" aria-hidden="true">
          <div className="flex gap-1.5">
            {PASOS.map((x) => (
              <span key={x.n} className={`h-1 flex-1 rounded-full transition-colors ${x.n <= paso ? "bg-gold" : "bg-linea"}`} />
            ))}
          </div>
          <p className="mt-2 text-xs tracking-widest text-piedra uppercase">Paso {paso} de 4 · {PASOS[paso - 1].titulo}</p>
        </div>

        {/* Lista de pasos (escritorio) */}
        <ol className="mt-10 hidden border-t border-linea lg:block">
          {PASOS.map((x) => {
            const actual = x.n === paso;
            const hecho = completo(x.n);
            return (
              <li key={x.n} className="border-b border-linea">
                <button
                  type="button"
                  disabled={!hecho}
                  onClick={() => irA(x.n)}
                  className="flex w-full items-center gap-4 py-4 text-left disabled:cursor-default"
                  aria-current={actual ? "step" : undefined}
                >
                  <span className={`w-6 font-serif text-lg tabular-nums ${actual ? "text-gold-light" : hecho ? "text-gold" : "text-piedra/60"}`}>
                    {hecho ? "✓" : `0${x.n}`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${actual ? "font-semibold text-cream" : hecho ? "text-cream" : "text-piedra/70"}`}>{x.titulo}</span>
                    {hecho && <span className="block truncate text-xs text-piedra">{resumen[x.n]}</span>}
                  </span>
                  {hecho && <span className="text-xs text-piedra underline underline-offset-2">Cambiar</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* ── Columna derecha: un paso por vez ── */}
      <div ref={tarjetaRef} className="scroll-mt-20 rounded-3xl border border-linea bg-carbon p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] sm:p-8">
        <div key={paso} className="paso-entra">
          <p className="text-xs tracking-[0.25em] text-piedra uppercase">Paso {paso} de 4</p>
          <h2 className="mt-1 mb-6 font-serif text-3xl text-gold-light">{PASOS[paso - 1].titulo}</h2>

          {/* Paso 1: tratamiento */}
          {paso === 1 && (
            <div className="space-y-5">
              {categorias.map((cat) => (
                <div key={cat}>
                  {categorias.length > 1 && <p className="mb-2 text-xs tracking-[0.2em] text-piedra uppercase">{cat}</p>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {p.servicios.filter((s) => s.categoria === cat).map((s) => {
                      const sel = s.id === servicioId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => elegirServicio(s.id)}
                          aria-pressed={sel}
                          className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${sel ? "border-gold bg-gold/10" : "border-linea hover:border-gold/60"}`}
                        >
                          <p className="font-serif text-lg leading-snug text-cream">{s.nombre}</p>
                          <p className="mt-1 text-sm text-piedra">
                            {formatDuracion(s.duracionMin)} · <span className="text-gold-light">{formatPrecio(s.precio)}</span>
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paso 2: día y horario */}
          {paso === 2 && servicio && (
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Calendario
                mes={mes}
                onCambiarMes={(nuevo) => { setMes(nuevo); setFecha(null); }}
                mesMin={p.desde.slice(0, 7)}
                mesMax={p.hasta.slice(0, 7)}
                disponibilidad={disponibilidad}
                seleccion={fecha}
                onElegir={setFecha}
              />
              <div>
                {errorCarga && (
                  <p className="mb-3 text-sm text-piedra">
                    No pudimos cargar los horarios.{" "}
                    <button type="button" className="underline" onClick={() => { setErrorCarga(false); setRecarga((n) => n + 1); }}>Reintentar</button>
                  </p>
                )}
                {!fecha && <p className="text-sm text-piedra">Elegí un día marcado en el calendario para ver los horarios libres.</p>}
                {fecha && (
                  <>
                    <p className="mb-3 text-sm text-cream">{mayuscula(fechaTexto(fecha))}</p>
                    {horarios === null && <p className="text-sm text-piedra">Buscando horarios…</p>}
                    {horarios?.length === 0 && <p className="text-sm text-piedra">No quedan horarios libres este día. Probá con otro.</p>}
                    {[["Mañana", maniana], ["Tarde", tarde]].map(([titulo, lista]) =>
                      (lista as string[]).length ? (
                        <div key={titulo as string} className="mb-4">
                          <p className="mb-2 text-[0.65rem] tracking-[0.2em] text-piedra uppercase">{titulo as string}</p>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {(lista as string[]).map((h) => (
                              <button
                                key={h}
                                type="button"
                                onClick={() => { setHora(h); setError(null); }}
                                aria-pressed={hora === h}
                                className={`rounded-xl border py-2 text-sm tabular-nums transition ${hora === h ? "border-gold bg-gold font-semibold text-[#0b0a0c]" : "border-linea text-cream hover:border-gold/60"}`}
                              >
                                {h}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null,
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Paso 3: datos */}
          {paso === 3 && (
            <form
              onSubmit={(e) => { e.preventDefault(); irA(4); }}
              className="grid gap-4 sm:grid-cols-2"
              id="form-datos"
            >
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-piedra" htmlFor="nombre">Nombre y apellido</label>
                <input id="nombre" name="nombre" required minLength={2} autoComplete="name" className="campo" {...campoForm("nombre")} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-piedra" htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required autoComplete="email" className="campo" {...campoForm("email")} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-piedra" htmlFor="telefono">WhatsApp / Teléfono</label>
                <input id="telefono" name="telefono" type="tel" required minLength={6} autoComplete="tel" placeholder="Ej: 11 2345 6789" className="campo" {...campoForm("telefono")} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-piedra" htmlFor="notas">Comentarios (opcional)</label>
                <textarea id="notas" name="notas" rows={3} maxLength={500} placeholder="Alergias, consultas, si es tu primera vez…" className="campo" {...campoForm("notas")} />
              </div>
              {/* Campo trampa para bots: queda oculto para las personas */}
              <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" value={trampa} onChange={(e) => setTrampa(e.target.value)} />
            </form>
          )}

          {/* Paso 4: confirmar */}
          {paso === 4 && servicio && fecha && hora && (
            <div>
              <dl className="divide-y divide-linea rounded-2xl border border-linea">
                {[
                  ["Tratamiento", servicio.nombre],
                  ["Día", `${mayuscula(fechaTexto(fecha))}, ${hora} hs`],
                  ["Duración", formatDuracion(servicio.duracionMin)],
                  ["Precio", formatPrecio(servicio.precio)],
                  ["A nombre de", `${form.nombre} · ${form.email}`],
                  ...(montoSena > 0 ? [["Seña para reservar", `${formatPrecio(montoSena)} (se abona por WhatsApp)`]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-piedra">{k}</dt>
                    <dd className="text-right text-cream">{v}</dd>
                  </div>
                ))}
              </dl>
              {p.politica && <p className="mt-4 text-xs leading-relaxed text-piedra">{p.politica}</p>}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>
          )}

          {/* Navegación (el paso 1 avanza solo al elegir) */}
          <div className={`mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-5 ${paso === 1 ? "hidden" : ""}`}>
            {paso > 1 ? (
              <button type="button" onClick={() => irA((paso - 1) as NumeroPaso)} className="text-sm text-piedra hover:text-cream">
                ← Atrás
              </button>
            ) : <span />}
            {paso === 2 && (
              <button type="button" disabled={!hora} onClick={() => irA(3)} className="btn-oro">Continuar →</button>
            )}
            {paso === 3 && (
              <button type="submit" form="form-datos" className="btn-oro">Continuar →</button>
            )}
            {paso === 4 && (
              <button type="button" disabled={enviando} onClick={enviar} className="btn-oro">
                {enviando ? "Reservando…" : montoSena > 0 ? "Reservar y abonar la seña por WhatsApp" : "Confirmar turno"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
