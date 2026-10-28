"use client";

import { useState, useTransition } from "react";
import { formatPrecio } from "@/lib/formato";
import type { ResultadoGiftCard } from "@/app/actions/giftcards";
import { TarjetaRegalo } from "./TarjetaRegalo";

interface Props {
  monto: number;
  meses: number;
  servicios: { id: string; nombre: string; precio: number; categoria: string }[];
  accion: (datos: unknown, honeypot?: string) => Promise<ResultadoGiftCard>;
}

const VACIO = { para: "", de: "", mensaje: "", email: "", telefono: "" };

export function PedirGiftCard(p: Props) {
  const [tipo, setTipo] = useState<"monto" | "servicio">("monto");
  const [servicioId, setServicioId] = useState("");
  const [form, setForm] = useState(VACIO);
  const [trampa, setTrampa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  const servicio = p.servicios.find((s) => s.id === servicioId);
  const precio = tipo === "monto" ? p.monto : servicio?.precio ?? 0;
  const campo = (k: keyof typeof VACIO) => ({
    id: `gift-${k}`,
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });
  const categorias = [...new Set(p.servicios.map((s) => s.categoria))];

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (tipo === "servicio" && !servicio) return setError("Elegí el tratamiento que querés regalar");
    setError(null);
    startTransition(async () => {
      const r = await p.accion({ ...form, servicioId: tipo === "servicio" ? servicioId : "" }, trampa);
      if (r.ok) window.location.href = r.url;
      else setError(r.error);
    });
  }

  const opcion = (activa: boolean) =>
    `rounded-2xl border p-4 text-left transition ${activa ? "border-gold bg-gold/10" : "border-linea hover:border-gold/60"}`;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
      {/* Vista previa: se actualiza mientras escriben */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <TarjetaRegalo
          titulo={tipo === "servicio" && servicio ? servicio.nombre : "Bienestar"}
          monto={tipo === "monto" ? formatPrecio(p.monto) : undefined}
          para={form.para}
          de={form.de}
        />
        {form.mensaje && <p className="mt-5 text-center font-serif text-xl text-cream italic">“{form.mensaje}”</p>}
        <p className="mt-5 text-center text-xs text-piedra">
          Vale por {p.meses} {p.meses === 1 ? "mes" : "meses"} desde que se activa. El código llega por mail cuando se confirma el pago.
        </p>
      </div>

      <form onSubmit={enviar} className="rounded-3xl border border-linea bg-carbon p-5 sm:p-8">
        <fieldset>
          <legend className="mb-3 text-xs tracking-[0.2em] text-piedra uppercase">Qué querés regalar</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" aria-pressed={tipo === "monto"} onClick={() => setTipo("monto")} className={opcion(tipo === "monto")}>
              <p className="font-serif text-xl text-cream">{formatPrecio(p.monto)}</p>
              <p className="mt-1 text-sm text-piedra">Para usar en el tratamiento que elija. Si sobra, le queda saldo.</p>
            </button>
            <button type="button" aria-pressed={tipo === "servicio"} onClick={() => setTipo("servicio")} className={opcion(tipo === "servicio")}>
              <p className="font-serif text-xl text-cream">Un tratamiento</p>
              <p className="mt-1 text-sm text-piedra">Elegís vos la sesión que le regalás.</p>
            </button>
          </div>
          {tipo === "servicio" && (
            <div className="mt-3">
              <label htmlFor="gift-servicio" className="mb-1.5 block text-xs text-piedra">Tratamiento</label>
              <select id="gift-servicio" className="campo" value={servicioId} onChange={(e) => setServicioId(e.target.value)} required>
                <option value="">Elegí un tratamiento…</option>
                {categorias.map((c) => (
                  <optgroup key={c} label={c}>
                    {p.servicios.filter((s) => s.categoria === c).map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre} · {formatPrecio(s.precio)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
        </fieldset>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="gift-para" className="mb-1.5 block text-xs text-piedra">Para</label>
            <input required minLength={2} maxLength={60} placeholder="Nombre de quien la recibe" className="campo" {...campo("para")} />
          </div>
          <div>
            <label htmlFor="gift-de" className="mb-1.5 block text-xs text-piedra">De</label>
            <input required minLength={2} maxLength={60} placeholder="Tu nombre" className="campo" {...campo("de")} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="gift-mensaje" className="mb-1.5 block text-xs text-piedra">Mensaje (opcional)</label>
            <textarea rows={2} maxLength={200} placeholder="¡Feliz cumple! Un mimo para tu piel." className="campo" {...campo("mensaje")} />
          </div>
          <div>
            <label htmlFor="gift-email" className="mb-1.5 block text-xs text-piedra">Tu email</label>
            <input type="email" required autoComplete="email" className="campo" {...campo("email")} />
          </div>
          <div>
            <label htmlFor="gift-telefono" className="mb-1.5 block text-xs text-piedra">Tu WhatsApp</label>
            <input type="tel" required minLength={6} autoComplete="tel" placeholder="Ej: 11 2345 6789" className="campo" {...campo("telefono")} />
          </div>
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" value={trampa} onChange={(e) => setTrampa(e.target.value)} />
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-linea pt-5">
          <p className="text-sm text-piedra">
            Total: <span className="font-serif text-2xl text-gold-light">{precio ? formatPrecio(precio) : "—"}</span>
          </p>
          <button type="submit" disabled={enviando} className="btn-oro">{enviando ? "Enviando…" : "Pedir y pagar por WhatsApp"}</button>
        </div>
      </form>
    </div>
  );
}
