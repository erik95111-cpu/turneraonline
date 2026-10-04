"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  tema?: "oscuro" | "claro";
}

function fechaTexto(f: string) {
  const d = new Date(`${f}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()].toLowerCase()} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()].toLowerCase()}`;
}

const VACIO = { nombre: "", email: "", telefono: "", notas: "" };

export function Reserva(p: Props) {
  const claro = p.tema === "claro";
  const [servicioId, setServicioId] = useState<string | null>(
    p.servicios.some((s) => s.id === p.servicioInicial) ? p.servicioInicial! : null,
  );
  const [fecha, setFecha] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorHorarios, setErrorHorarios] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [form, setForm] = useState(VACIO);
  const [enviando, startTransition] = useTransition();

  const servicio = p.servicios.find((s) => s.id === servicioId) ?? null;
  const montoSena = servicio && p.sena.activa ? calcularSena(servicio.precio, p.sena.tipo, p.sena.valor) : 0;
  const categorias = useMemo(() => [...new Set(p.servicios.map((s) => s.categoria))], [p.servicios]);

  useEffect(() => {
    setHora(null);
    setHorarios(null);
    setErrorHorarios(false);
    if (!servicioId || !fecha) return;
    const ctrl = new AbortController();
    fetch(`/api/disponibilidad?servicio=${servicioId}&fecha=${fecha}${claro ? "&panel=1" : ""}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ horarios: string[] }>;
      })
      .then((d) => setHorarios(Array.isArray(d.horarios) ? d.horarios : []))
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setErrorHorarios(true);
      });
    return () => ctrl.abort();
  }, [servicioId, fecha, claro, recarga]);

  const campoForm = (k: keyof typeof VACIO) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!servicio || !fecha || !hora) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await p.accion(
        {
          servicioId: servicio.id,
          fecha,
          hora,
          ...form,
        },
        String(fd.get("website") ?? ""),
      );
      if (r.ok) {
        window.location.href = r.url;
      } else {
        setError(r.error);
        // Si el horario se ocupó, recargamos los horarios (los datos cargados se conservan)
        if (/horario/i.test(r.error)) setRecarga((n) => n + 1);
      }
    });
  }

  const card = claro ? "card p-5 sm:p-6" : "rounded-2xl border border-linea bg-carbon p-5 sm:p-7";
  const titulo = claro ? "text-lg font-semibold" : "font-serif text-2xl text-gold-light";
  const sub = claro ? "text-[#6b635b]" : "text-piedra";
  const campo = claro ? "input" : "campo";

  const Paso = ({ n, t }: { n: number; t: string }) => (
    <h2 className={`mb-5 flex items-center gap-3 ${titulo}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${claro ? "border-[#c9a96e]" : "border-gold/60 font-sans text-gold"}`}>{n}</span>
      {t}
    </h2>
  );

  return (
    <div className="space-y-6">
      {/* Paso 1: tratamiento */}
      <section className={card}>
        <Paso n={1} t="Elegí tu tratamiento" />
        {categorias.map((cat) => (
          <div key={cat} className="mb-4 last:mb-0">
            {categorias.length > 1 && <p className={`mb-2 text-xs tracking-[0.2em] uppercase ${sub}`}>{cat}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {p.servicios.filter((s) => s.categoria === cat).map((s) => {
                const sel = s.id === servicioId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setServicioId(s.id); setError(null); }}
                    className={[
                      "rounded-xl border p-4 text-left transition",
                      sel
                        ? claro ? "border-[#c9a96e] bg-[#fbf7ef] ring-1 ring-[#c9a96e]" : "border-gold bg-gold/10"
                        : claro ? "border-[#ebe5db] hover:border-[#c9a96e]" : "border-linea hover:border-gold/50",
                    ].join(" ")}
                  >
                    <p className={claro ? "font-medium" : "font-serif text-xl"}>{s.nombre}</p>
                    <p className={`mt-1 text-sm ${sub}`}>
                      {formatDuracion(s.duracionMin)} · <span className={claro ? "" : "text-gold-light"}>{formatPrecio(s.precio)}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Paso 2: día y horario */}
      {servicio && (
        <section className={card}>
          <Paso n={2} t="Elegí día y horario" />
          <div className="grid gap-8 md:grid-cols-2">
            <Calendario desde={p.desde} hasta={p.hasta} diasAtencion={p.diasAtencion} seleccion={fecha} onElegir={setFecha} tema={p.tema} />
            <div>
              {!fecha && <p className={`text-sm ${sub}`}>Seleccioná un día en el calendario para ver los horarios libres.</p>}
              {fecha && (
                <>
                  <p className={`mb-3 text-sm first-letter:uppercase ${sub}`}>{fechaTexto(fecha)}</p>
                  {errorHorarios && (
                    <p className={`text-sm ${sub}`}>
                      No pudimos cargar los horarios.{" "}
                      <button type="button" className="underline" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button>
                    </p>
                  )}
                  {horarios === null && !errorHorarios && <p className={`text-sm ${sub}`}>Buscando horarios…</p>}
                  {horarios?.length === 0 && (
                    <p className={`text-sm ${sub}`}>No quedan horarios libres este día. Probá con otra fecha.</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {horarios?.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => { setHora(h); setError(null); }}
                        className={[
                          "rounded-lg border py-2 text-sm transition",
                          hora === h
                            ? "border-gold bg-gold font-semibold text-ink"
                            : claro ? "border-[#ebe5db] hover:border-[#c9a96e]" : "border-linea hover:border-gold/60",
                        ].join(" ")}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Paso 3: datos */}
      {servicio && fecha && hora && (
        <form onSubmit={enviar} className={card}>
          <Paso n={3} t="Tus datos" />
          <div className={`mb-6 rounded-xl p-4 text-sm ${claro ? "bg-[#fbf7ef]" : "bg-humo"}`}>
            <p className={claro ? "font-medium" : "font-serif text-xl text-gold-light"}>{servicio.nombre}</p>
            <p className={`mt-1 first-letter:uppercase ${sub}`}>
              {fechaTexto(fecha)} · {hora} hs · {formatDuracion(servicio.duracionMin)}
            </p>
            <p className="mt-2">
              Total {formatPrecio(servicio.precio)}
              {montoSena > 0 && (
                <> · <strong>Seña a abonar ahora: {formatPrecio(montoSena)}</strong></>
              )}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={claro ? "lbl" : `mb-1.5 block text-xs ${sub}`} htmlFor="nombre">Nombre y apellido</label>
              <input id="nombre" name="nombre" required minLength={2} autoComplete="name" className={campo} {...campoForm("nombre")} />
            </div>
            <div>
              <label className={claro ? "lbl" : `mb-1.5 block text-xs ${sub}`} htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className={campo} {...campoForm("email")} />
            </div>
            <div>
              <label className={claro ? "lbl" : `mb-1.5 block text-xs ${sub}`} htmlFor="telefono">WhatsApp / Teléfono</label>
              <input id="telefono" name="telefono" type="tel" required minLength={6} autoComplete="tel" placeholder="Ej: 11 2345 6789" className={campo} {...campoForm("telefono")} />
            </div>
            <div className="sm:col-span-2">
              <label className={claro ? "lbl" : `mb-1.5 block text-xs ${sub}`} htmlFor="notas">Comentarios (opcional)</label>
              <textarea id="notas" name="notas" rows={3} maxLength={500} placeholder="Alergias, consultas, si es tu primera vez…" className={campo} {...campoForm("notas")} />
            </div>
            {/* Campo trampa para bots: queda oculto para las personas */}
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          </div>

          {p.politica && <p className={`mt-5 text-xs leading-relaxed ${sub}`}>{p.politica}</p>}

          <button type="submit" disabled={enviando} className={`mt-6 w-full sm:w-auto ${claro ? "btn" : "btn-oro"}`}>
            {enviando ? "Procesando…" : montoSena > 0 ? `Pagar seña con Mercado Pago` : "Confirmar turno"}
          </button>
        </form>
      )}

      {/* Fuera del formulario: sigue visible aunque haya que elegir otro horario */}
      {error && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
