# Capítulo 5b · Los componentes (`src/components/`)

Un **componente** es una pieza de pantalla que se arma una vez y se usa donde haga falta. Por ejemplo, el mismo formulario `Reserva` sirve en la web pública y en el panel ("Nuevo turno").

Casi todos estos componentes llevan `"use client"` arriba: **corren en el navegador**, porque reaccionan a toques y clics.

**Palabras de React que aparecen acá:**

| Palabra | Qué hace |
|---|---|
| `useState(valorInicial)` | Crea un dato que **cambia** mientras la persona usa la página (ej: qué día eligió). Devuelve `[valor, funciónParaCambiarlo]`. Cuando cambia, la pantalla se redibuja sola |
| `useEffect(() => {…}, [a, b])` | "Cada vez que cambie `a` o `b`, hacé esto" (ej: cuando elige otro día, pedir los horarios) |
| `useMemo(() => …, [a])` | Calcula algo y lo recuerda; solo lo recalcula si cambia `a` |
| `useTransition()` | Para acciones que tardan: da un "¿está procesando?" (para poner el botón en "Procesando…") |
| `props` / `p` | Los datos que le pasa quien usa el componente (como los parámetros de una función) |
| `onClick={…}` | Qué hacer al tocar |
| `onChange={…}` | Qué hacer cuando se escribe en una casilla |

---

## `src/components/Reserva.tsx` — el formulario de reserva en 3 pasos

El componente más grande. Paso 1: tratamiento. Paso 2: día y horario. Paso 3: datos.
Sirve en dos "temas": **oscuro** (web pública) y **claro** (panel).

```tsx
"use client";                                            // Corre en el navegador

import { useEffect, useMemo, useState, useTransition } from "react";
                                                         // Herramientas de React (ver tabla de arriba)
import type { TipoSena } from "@prisma/client";          // Solo el TIPO de seña (type = no trae código de la base, solo el nombre)
import { Calendario } from "./Calendario";               // El calendario (más abajo)
import { formatDuracion, formatPrecio } from "@/lib/formato";
                                                         // Formatos (estas funciones no tienen nada secreto: pueden ir al navegador)
import { calcularSena } from "@/lib/sena";               // Cálculo de la seña
import { DIAS, MESES } from "@/lib/dias";                // Nombres de días y meses
import type { ResultadoReserva } from "@/app/actions/reservas";
                                                         // Solo el TIPO de la respuesta del servidor
import { logError } from "@/lib/log";                    // Registro con etiqueta (sale en la consola del navegador)

export interface ServicioReserva {                       // Qué datos de cada tratamiento recibe el formulario:
  id: string;                                            //
  nombre: string;                                        //
  descripcion: string;                                   //
  categoria: string;                                     //
  duracionMin: number;                                   //
  precio: number;                                        //
}                                                        //

interface Props {                                        // Todo lo que recibe el formulario:
  servicios: ServicioReserva[];                          //   la lista de tratamientos
  servicioInicial?: string;                              //   el que viene ya elegido (opcional)
  diasAtencion: number[];                                //   los días que se atiende
  desde: string;                                         //   primera fecha que se puede elegir
  hasta: string;                                         //   última fecha que se puede elegir
  sena: { tipo: TipoSena; valor: number; activa: boolean };
                                                         //   datos de la seña
  politica: string;                                      //   política de cancelación
  accion: (datos: unknown, honeypot?: string) => Promise<ResultadoReserva>;
                                                         //   la función del servidor a la que llamar al confirmar
  tema?: "oscuro" | "claro";                             //   el tema visual (opcional)
}                                                        //

function fechaTexto(f: string) {                         // "2026-10-03" → "sábado 3 de octubre"
  const d = new Date(`${f}T12:00:00Z`);                  // Arma la fecha al mediodía (así no se corre de día por la zona horaria)
  return `${DIAS[d.getUTCDay()].toLowerCase()} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()].toLowerCase()}`;
                                                         // día de la semana + número + mes, en minúsculas
}                                                        //

const VACIO = { nombre: "", email: "", telefono: "", notas: "" };
                                                         // Los datos de la clienta al empezar: todo vacío

export function Reserva(p: Props) {                      // EL COMPONENTE. "p" = los datos que recibe
  const claro = p.tema === "claro";                      // ¿Tema claro (panel)?
  const [servicioId, setServicioId] = useState<string | null>(
                                                         // DATO QUE CAMBIA: el tratamiento elegido…
    p.servicios.some((s) => s.id === p.servicioInicial) ? p.servicioInicial! : null,
                                                         // … empieza con el que vino elegido (si existe), o con ninguno
  );                                                     //
  const [fecha, setFecha] = useState<string | null>(null);
                                                         // el día elegido (al principio, ninguno)
  const [horarios, setHorarios] = useState<string[] | null>(null);
                                                         // los horarios libres de ese día (null = todavía buscando)
  const [hora, setHora] = useState<string | null>(null); // la hora elegida
  const [error, setError] = useState<string | null>(null);
                                                         // el mensaje de error a mostrar (null = ninguno)
  const [errorHorarios, setErrorHorarios] = useState(false);
                                                         // ¿falló la carga de horarios?
  const [recarga, setRecarga] = useState(0);             // un contador: al sumarle 1, se vuelven a pedir los horarios
  const [form, setForm] = useState(VACIO);               // lo que escribió la clienta (nombre, email…)
  const [enviando, startTransition] = useTransition();   // "enviando" = true mientras se procesa la reserva

  const servicio = p.servicios.find((s) => s.id === servicioId) ?? null;
                                                         // Los datos completos del tratamiento elegido
  const montoSena = servicio && p.sena.activa ? calcularSena(servicio.precio, p.sena.tipo, p.sena.valor) : 0;
                                                         // Cuánto es la seña de ese tratamiento
  const categorias = useMemo(() => [...new Set(p.servicios.map((s) => s.categoria))], [p.servicios]);
                                                         // Las categorías sin repetir (se calcula una vez)

  useEffect(() => {                                      // CADA VEZ QUE CAMBIA el tratamiento, el día o "recarga":
    setHora(null);                                       //   se borra la hora elegida
    setHorarios(null);                                   //   se borran los horarios (muestra "Buscando horarios…")
    setErrorHorarios(false);                             //   se borra el error
    if (!servicioId || !fecha) return;                   //   si falta tratamiento o día, no hay nada que buscar
    const ctrl = new AbortController();                  //   un "control remoto" para poder cancelar el pedido
    fetch(`/api/disponibilidad?servicio=${servicioId}&fecha=${fecha}${claro ? "&panel=1" : ""}`, { signal: ctrl.signal })
                                                         //   le pide al servidor los horarios libres (en el panel, agrega &panel=1)
      .then((r) => {                                     //   cuando responde…
        if (!r.ok) throw new Error(String(r.status));    //     si respondió con error (ej: 503), lo convierte en error
        return r.json() as Promise<{ horarios: string[] }>;
                                                         //     si no, lee la respuesta
      })                                                 //
      .then((d) => setHorarios(Array.isArray(d.horarios) ? d.horarios : []))
                                                         //   guarda los horarios (si vino algo raro, lista vacía)
      .catch((e: unknown) => {                           //   si algo falló:
        if ((e as Error).name === "AbortError") return;  //     si fue porque se canceló (cambió de día), no es un error
        logError("horarios (navegador)", e);             //     si no, se anota
        setErrorHorarios(true);                          //     y se muestra "No pudimos cargar los horarios · Reintentar"
      });                                                //
    return () => ctrl.abort();                           //   LIMPIEZA: si cambia de día antes de que responda, cancela el pedido viejo (si no, podría mostrar horarios del día anterior)
  }, [servicioId, fecha, claro, recarga]);               // ← los datos que, al cambiar, disparan todo esto

  const campoForm = (k: keyof typeof VACIO) => ({        // Atajo para conectar una casilla con "form":
    value: form[k],                                      //   lo que muestra la casilla = lo guardado
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
                                                         //   al escribir, guarda lo nuevo (copiando el resto igual)
  });                                                    //

  function enviar(e: React.FormEvent<HTMLFormElement>) { // AL TOCAR "Confirmar":
    e.preventDefault();                                  //   evita que el navegador recargue la página (lo manejamos nosotros)
    if (!servicio || !fecha || !hora) return;            //   si falta algo, no hace nada
    const fd = new FormData(e.currentTarget);            //   lee el formulario (para el campo trampa)
    setError(null);                                      //   borra errores anteriores
    startTransition(async () => {                        //   empieza a procesar (el botón pasa a "Procesando…")
      let r: ResultadoReserva;                           //   acá va la respuesta
      try {                                              //   intenta…
        r = await p.accion(                              //   … llamar al servidor con:
          {                                              //
            servicioId: servicio.id,                     //     tratamiento
            fecha,                                       //     día
            hora,                                        //     hora
            ...form,                                     //     nombre, email, teléfono, notas
          },                                             //
          String(fd.get("website") ?? ""),               //     y el campo trampa
        );                                               //
      } catch (err) {                                    //   PLAN B si no se pudo ni hablar con el servidor:
        const origen = logError("reserva (navegador)", err);
                                                         //     anota y averigua el origen
        setError(                                        //     mensaje:
          origen === "LIB:red"                           //     ¿fue internet?
            ? "Parece que se cortó la conexión. Revisá tu internet y tocá el botón de nuevo."
            : "No pudimos completar la reserva. Probá de nuevo en unos segundos o escribinos por WhatsApp.",
        );                                               //
        return;                                          //     corta (los datos escritos NO se pierden)
      }                                                  //
      if (r.ok) {                                        //   si salió bien…
        window.location.href = r.url;                    //     va a la página de su turno
      } else {                                           //   si el servidor dijo que no…
        setError(r.error);                               //     muestra el motivo
        if (/horario/i.test(r.error)) setRecarga((n) => n + 1);
                                                         //     si el problema fue el horario, vuelve a pedir los horarios libres
      }                                                  //
    });                                                  //
  }                                                      //

  const card = claro ? "card p-5 sm:p-6" : "rounded-2xl border border-linea bg-carbon p-5 sm:p-7";
                                                         // Estilo de las tarjetas según el tema
  const titulo = claro ? "text-lg font-semibold" : "font-serif text-2xl text-gold-light";
                                                         // Estilo de los títulos según el tema
  const sub = claro ? "text-[#6b635b]" : "text-piedra";  // Estilo del texto secundario
  const campo = claro ? "input" : "campo";               // Estilo de las casillas

  const Paso = ({ n, t }: { n: number; t: string }) => ( // Mini componente: el título de cada paso con su número en un círculo
    <h2 className={`mb-5 flex items-center gap-3 ${titulo}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${claro ? "border-[#c9a96e]" : "border-gold/60 font-sans text-gold"}`}>{n}</span>
                                                         //   el círculo con el número
      {t}                                                //   el texto
    </h2>                                                //
  );                                                     //
```

Lo que sigue es lo que se dibuja, paso por paso:

```tsx
  return (                                               //
    <div className="space-y-6">                          // Todo el formulario, con espacio entre pasos
      <section className={card}>                         // PASO 1: TRATAMIENTO
        <Paso n={1} t="Elegí tu tratamiento" />          //   título "1 Elegí tu tratamiento"
        {categorias.map((cat) => (                       //   por cada categoría…
          <div key={cat} className="mb-4 last:mb-0">     //
            {categorias.length > 1 && <p className={`mb-2 text-xs tracking-[0.2em] uppercase ${sub}`}>{cat}</p>}
                                                         //     su nombre (si hay más de una)
            <div className="grid gap-2 sm:grid-cols-2"> //     grilla de botones
              {p.servicios.filter((s) => s.categoria === cat).map((s) => {
                                                         //     por cada tratamiento de la categoría:
                const sel = s.id === servicioId;         //       ¿es el elegido?
                return (                                 //
                  <button                                //       un botón:
                    key={s.id}                           //
                    type="button"                        //         type="button" = no envía el formulario
                    onClick={() => { setServicioId(s.id); setError(null); }}
                                                         //         al tocarlo: queda elegido y se borra el error
                    className={[                         //         estilo:
                      "rounded-xl border p-4 text-left transition",
                      sel                                //           si está elegido → resaltado dorado
                        ? claro ? "border-[#c9a96e] bg-[#fbf7ef] ring-1 ring-[#c9a96e]" : "border-gold bg-gold/10"
                        : claro ? "border-[#ebe5db] hover:border-[#c9a96e]" : "border-linea hover:border-gold/50",
                                                         //           si no → borde normal, dorado al pasar el mouse
                    ].join(" ")}                         //           (une todas las clases con espacios)
                  >                                      //
                    <p className={claro ? "font-medium" : "font-serif text-xl"}>{s.nombre}</p>
                                                         //         nombre
                    <p className={`mt-1 text-sm ${sub}`}>
                      {formatDuracion(s.duracionMin)} · <span className={claro ? "" : "text-gold-light"}>{formatPrecio(s.precio)}</span>
                                                         //         duración · precio
                    </p>                                 //
                  </button>                              //
                );                                       //
              })}                                        //
            </div>                                       //
          </div>                                         //
        ))}                                              //
      </section>                                         //

      {servicio && (                                     // PASO 2: DÍA Y HORARIO (aparece solo cuando ya eligió tratamiento)
        <section className={card}>                       //
          <Paso n={2} t="Elegí día y horario" />         //
          <div className="grid gap-8 md:grid-cols-2">    //   dos columnas en compu: calendario | horarios
            <Calendario desde={p.desde} hasta={p.hasta} diasAtencion={p.diasAtencion} seleccion={fecha} onElegir={setFecha} tema={p.tema} />
                                                         //   el calendario. Al tocar un día, llama a setFecha (y eso dispara el useEffect que busca horarios)
            <div>                                        //   columna de horarios:
              {!fecha && <p className={`text-sm ${sub}`}>Seleccioná un día en el calendario para ver los horarios libres.</p>}
                                                         //     si no eligió día, la indicación
              {fecha && (                                //     si eligió día:
                <>                                       //
                  <p className={`mb-3 text-sm first-letter:uppercase ${sub}`}>{fechaTexto(fecha)}</p>
                                                         //       "Sábado 3 de octubre"
                  {errorHorarios && (                    //       si falló la carga: mensaje + botón Reintentar
                    <p className={`text-sm ${sub}`}>     //
                      No pudimos cargar los horarios.{" "}
                      <button type="button" className="underline" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button>
                                                         //       Reintentar = sumar 1 a "recarga" → se vuelven a pedir
                    </p>                                 //
                  )}                                     //
                  {horarios === null && !errorHorarios && <p className={`text-sm ${sub}`}>Buscando horarios…</p>}
                                                         //       mientras busca
                  {horarios?.length === 0 && (           //       si no hay ninguno libre
                    <p className={`text-sm ${sub}`}>No quedan horarios libres este día. Probá con otra fecha.</p>
                  )}                                     //
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                                         //       grilla de horarios (3 o 4 por fila)
                    {horarios?.map((h) => (              //       por cada horario libre, un botón:
                      <button                            //
                        key={h}                          //
                        type="button"                    //
                        onClick={() => { setHora(h); setError(null); }}
                                                         //         al tocarlo, queda elegido
                        className={[                     //
                          "rounded-lg border py-2 text-sm transition",
                          hora === h                     //         elegido → fondo dorado
                            ? "border-gold bg-gold font-semibold text-ink"
                            : claro ? "border-[#ebe5db] hover:border-[#c9a96e]" : "border-linea hover:border-gold/60",
                        ].join(" ")}                     //
                      >                                  //
                        {h}                              //         "10:30"
                      </button>                          //
                    ))}                                  //
                  </div>                                 //
                </>                                      //
              )}                                         //
            </div>                                       //
          </div>                                         //
        </section>                                       //
      )}                                                 //

      {servicio && fecha && hora && (                    // PASO 3: DATOS (aparece solo cuando ya eligió todo)
        <form onSubmit={enviar} className={card}>        //   el formulario. Al enviarlo, corre "enviar"
          <Paso n={3} t="Tus datos" />                   //
          <div className={`mb-6 rounded-xl p-4 text-sm ${claro ? "bg-[#fbf7ef]" : "bg-humo"}`}>
                                                         //   RESUMEN de lo elegido:
            <p className={claro ? "font-medium" : "font-serif text-xl text-gold-light"}>{servicio.nombre}</p>
            <p className={`mt-1 first-letter:uppercase ${sub}`}>
              {fechaTexto(fecha)} · {hora} hs · {formatDuracion(servicio.duracionMin)}
            </p>                                         //
            <p className="mt-2">                         //
              Total {formatPrecio(servicio.precio)}      //     precio
              {montoSena > 0 && (                        //     y la seña, si hay
                <> · <strong>Seña para reservar: {formatPrecio(montoSena)}</strong> (por transferencia)</>
              )}                                         //
            </p>                                         //
          </div>                                         //

          <div className="grid gap-4 sm:grid-cols-2">    //   LAS CASILLAS:
            <div className="sm:col-span-2">              //     (ocupa las dos columnas)
              <label className={claro ? "lbl" : `mb-1.5 block text-xs ${sub}`} htmlFor="nombre">Nombre y apellido</label>
              <input id="nombre" name="nombre" required minLength={2} autoComplete="name" className={campo} {...campoForm("nombre")} />
                                                         //     nombre: obligatorio, mínimo 2 letras, el celular lo puede autocompletar
            </div>                                       //
            <div>                                        //
              <label className={claro ? "lbl" : `mb-1.5 block text-xs ${sub}`} htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className={campo} {...campoForm("email")} />
                                                         //     email: type="email" = el navegador revisa el formato y el celular muestra el teclado con @
            </div>                                       //
            <div>                                        //
              <label className={claro ? "lbl" : `mb-1.5 block text-xs ${sub}`} htmlFor="telefono">WhatsApp / Teléfono</label>
              <input id="telefono" name="telefono" type="tel" required minLength={6} autoComplete="tel" placeholder="Ej: 11 2345 6789" className={campo} {...campoForm("telefono")} />
                                                         //     teléfono: type="tel" = teclado numérico
            </div>                                       //
            <div className="sm:col-span-2">              //
              <label className={claro ? "lbl" : `mb-1.5 block text-xs ${sub}`} htmlFor="notas">Comentarios (opcional)</label>
              <textarea id="notas" name="notas" rows={3} maxLength={500} placeholder="Alergias, consultas, si es tu primera vez…" className={campo} {...campoForm("notas")} />
                                                         //     comentarios: caja de texto de 3 renglones, máximo 500 letras
            </div>                                       //
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                                                         //     CAMPO TRAMPA: invisible para las personas (hidden). Los robots lo completan y así se los detecta
          </div>                                         //

          {p.politica && <p className={`mt-5 text-xs leading-relaxed ${sub}`}>{p.politica}</p>}
                                                         //   la política de cancelación, en letra chica

          <button type="submit" disabled={enviando} className={`mt-6 w-full sm:w-auto ${claro ? "btn" : "btn-oro"}`}>
                                                         //   EL BOTÓN DE CONFIRMAR. Desactivado mientras procesa (así no se reserva dos veces)
            {enviando ? "Procesando…" : montoSena > 0 ? "Reservar y ver datos para la seña" : "Confirmar turno"}
                                                         //   el texto cambia según el momento y si hay seña
          </button>                                      //
        </form>                                          //
      )}                                                 //

      {error && (                                        // EL MENSAJE DE ERROR, fuera del formulario (así sigue visible si tiene que elegir otro horario)
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>
      )}                                                 //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/components/Calendario.tsx` — el calendario del mes

```tsx
"use client";                                            // Corre en el navegador

import { useState } from "react";                        // Para el mes que se está mirando

import { DIAS_CORTO, MESES, ORDEN_SEMANA } from "@/lib/dias";
                                                         // Nombres de días y meses

const DIAS = ORDEN_SEMANA.map((d) => DIAS_CORTO[d]);     // Encabezado empezando el lunes: ["Lu", "Ma", …, "Do"]

const iso = (y: number, m: number, d: number) =>         // Arma "2026-10-03" a partir de año, mes (0 = enero) y día
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                                                         // (al mes se le suma 1 porque JavaScript cuenta los meses desde 0)

export function Calendario(props: {                      // El componente recibe:
  desde: string;                                         //   primer día que se puede elegir
  hasta: string;                                         //   último día que se puede elegir
  diasAtencion: number[];                                //   días de la semana que se atiende
  seleccion: string | null;                              //   el día elegido
  onElegir: (fecha: string) => void;                     //   qué hacer al tocar un día
  tema?: "oscuro" | "claro";                             //   el tema
}) {                                                     //
  const [y0, m0] = props.desde.split("-").map(Number);   // Año y mes del primer día disponible
  const [mes, setMes] = useState({ y: y0, m: m0 - 1 });  // DATO QUE CAMBIA: el mes que se está mirando (empieza en el actual)
  const claro = props.tema === "claro";                  // ¿Tema claro?

  const primero = new Date(Date.UTC(mes.y, mes.m, 1));   // El día 1 de ese mes
  const offset = (primero.getUTCDay() + 6) % 7;          // Cuántos casilleros vacíos van antes del 1 (si el 1 cae miércoles, 2: lunes y martes)
  const diasMes = new Date(Date.UTC(mes.y, mes.m + 1, 0)).getUTCDate();
                                                         // Cuántos días tiene el mes (truco: el "día 0" del mes siguiente es el último de este)

  const mover = (delta: number) => {                     // Cambiar de mes (delta = -1 atrás, +1 adelante)
    const d = new Date(Date.UTC(mes.y, mes.m + delta, 1));
                                                         // Calcula el nuevo mes (JavaScript ajusta solo si pasa de diciembre a enero)
    setMes({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
                                                         // Lo guarda (y el calendario se redibuja)
  };                                                     //
  const puedeAtras = iso(mes.y, mes.m, 1) > props.desde.slice(0, 8) + "01";
                                                         // ¿Se puede ir al mes anterior? Solo si no es el mes del primer día disponible
  const puedeAdelante = iso(mes.y, mes.m + 1, 1) <= props.hasta;
                                                         // ¿Se puede ir al siguiente? Solo si el mes siguiente tiene días disponibles

  return (                                               //
    <div className={claro ? "text-[#1a1714]" : ""}>      //
      <div className="mb-4 flex items-center justify-between">
                                                         // Fila de arriba: ‹  Octubre 2026  ›
        <button type="button" onClick={() => mover(-1)} disabled={!puedeAtras} aria-label="Mes anterior"
          className="h-9 w-9 rounded-full border border-current/20 disabled:opacity-20">‹</button>
                                                         //   botón al mes anterior (aria-label = lo que dice el lector de pantalla)
        <p className={`font-serif text-xl ${claro ? "" : "text-gold-light"}`}>{MESES[mes.m]} {mes.y}</p>
                                                         //   "Octubre 2026"
        <button type="button" onClick={() => mover(1)} disabled={!puedeAdelante} aria-label="Mes siguiente"
          className="h-9 w-9 rounded-full border border-current/20 disabled:opacity-20">›</button>
                                                         //   botón al mes siguiente
      </div>                                             //
      <div className="grid grid-cols-7 gap-1 text-center">
                                                         // La grilla: 7 columnas (una por día de la semana)
        {DIAS.map((d) => (                               //   el encabezado: Lu Ma Mi Ju Vi Sá Do
          <span key={d} className={`pb-2 text-[0.65rem] tracking-widest uppercase ${claro ? "text-[#8b8279]" : "text-piedra"}`}>{d}</span>
        ))}                                              //
        {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
                                                         //   los casilleros vacíos antes del día 1
        {Array.from({ length: diasMes }, (_, i) => {     //   un casillero por cada día del mes:
          const fecha = iso(mes.y, mes.m, i + 1);        //     su fecha
          const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay();
                                                         //     qué día de la semana es
          const habil = fecha >= props.desde && fecha <= props.hasta && props.diasAtencion.includes(dow);
                                                         //     ¿se puede elegir? Dentro del rango Y es un día de atención
          const sel = props.seleccion === fecha;         //     ¿es el elegido?
          return (                                       //
            <button                                      //     un botón por día:
              key={fecha}                                //
              type="button"                              //
              disabled={!habil}                          //       desactivado si no se puede elegir
              onClick={() => props.onElegir(fecha)}      //       al tocarlo, avisa qué día se eligió
              className={[                               //
                "aspect-square rounded-full text-sm transition",
                                                         //       redondo y cuadrado
                sel                                      //       elegido → fondo dorado
                  ? "bg-gold text-ink font-semibold"     //
                  : habil                                //       se puede elegir → resalta al pasar el mouse
                    ? claro ? "hover:bg-[#f1ece4] font-medium" : "hover:bg-gold/15 text-cream"
                    : "opacity-25 cursor-not-allowed",   //       no se puede → apagado
              ].join(" ")}                               //
            >                                            //
              {i + 1}                                    //       el número del día
            </button>                                    //
          );                                             //
        })}                                              //
      </div>                                             //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/components/Intro.tsx` — la portada animada

```tsx
"use client";                                            // Corre en el navegador

import Image from "next/image";                          // Imágenes
import Link from "next/link";                            // Links
import { useEffect, useState } from "react";             // Herramientas de React

const CLAVE = "hs_intro_vista";                          // Nombre con el que se anota "ya la vio"

export function Intro() {                                // El componente
  const [activa, setActiva] = useState(true);            // ¿Se muestra? Al principio, sí

  useEffect(() => {                                      // Apenas aparece en el navegador:
    let vista = false;                                   //
    try {                                                //   (try: en modo incógnito, sessionStorage puede fallar)
      vista = sessionStorage.getItem(CLAVE) === "1" || window.location.hash !== "";
                                                         //   ¿ya la vio en esta visita? (sessionStorage = memoria que dura mientras la pestaña está abierta) ¿o vino a una sección (#tratamientos)?
      sessionStorage.setItem(CLAVE, "1");                //   anota que ya la vio
    } catch {}                                           //   si falla, no pasa nada
    if (vista) setActiva(false);                         //   si ya la vio, la oculta
  }, []);                                                // [] vacío = solo una vez, al aparecer

  if (!activa) return null;                              // Si no está activa, no dibuja nada

  return (                                               //
    <>                                                   //
      <script                                            // Un mini código que corre ANTES de que se dibuje la página…
        dangerouslySetInnerHTML={{                       //
          __html: `try{if(sessionStorage.getItem("${CLAVE}")==="1"||location.hash)document.documentElement.dataset.intro="no"}catch(e){}`,
                                                         // … si ya la vio, marca la página (data-intro="no") y el CSS la oculta al instante (sin parpadeo)
        }}                                               //
      />                                                 //
      <div className="intro" role="dialog" aria-label="Bienvenida a MC Healthy Skin">
                                                         // La capa negra que cubre la pantalla (role="dialog" = para lectores de pantalla)
        <div className="intro-flota">                    //   la caja que flota
          <div className="intro-logo">                   //     el área del logo
            <svg className="intro-aro" viewBox="0 0 200 200" aria-hidden="true">
                                                         //       un dibujo (SVG) con…
              <circle cx="100" cy="100" r="96" />        //       … un círculo: el anillo dorado que se dibuja
            </svg>                                       //
            <span className="intro-orbita" aria-hidden="true"><span /></span>
                                                         //       la lucecita que gira
            <div className="intro-img">                  //       el logo:
              <Image src="/logo.png" alt="MC Healthy Skin, Dermatocosmiatría" width={320} height={320} priority />
              <span className="intro-brillo" />          //       el reflejo de luz
            </div>                                       //
          </div>                                         //
        </div>                                           //
        <Link href="/reservar" className="btn-oro intro-boton">Reservá tu turno</Link>
                                                         //   botón principal: va directo a reservar
        <Link href="/?intro=0" className="intro-ver" onClick={() => setActiva(false)}>
                                                         //   link secundario: cierra la portada (y ?intro=0 hace que no vuelva a salir)
          Ver la página                                  //
        </Link>                                          //
      </div>                                             //
    </>                                                  //
  );                                                     //
}                                                        // Fin
```

> Los dos botones son **links**. Así funcionan aunque el navegador tenga JavaScript apagado.

---

## `src/components/Copiar.tsx` — dato con botón "Copiar"

```tsx
"use client";                                            // Corre en el navegador

import { useState } from "react";                        // Para el "¡Copiado!"

export function Copiar({ etiqueta, valor }: { etiqueta: string; valor: string }) {
                                                         // Recibe el título ("Alias") y el dato ("mc.healthy.skin")
  const [copiado, setCopiado] = useState(false);         // ¿Se acaba de copiar?
  async function copiar() {                              // Al tocar "Copiar":
    try {                                                //   intenta…
      await navigator.clipboard.writeText(valor);        //   … copiar al portapapeles
    } catch {                                            //   PLAN B (navegadores viejos o sin permiso):
      const r = document.createRange();                  //     crea una "selección"…
      const el = document.getElementById(`dato-${etiqueta}`);
                                                         //     … busca el texto en pantalla…
      if (el) {                                          //     … y lo deja SELECCIONADO (pintado), así la clienta lo copia a mano:
        r.selectNodeContents(el);                        //
        const sel = window.getSelection();               //
        sel?.removeAllRanges();                          //
        sel?.addRange(r);                                //
      }                                                  //
    }                                                    //
    setCopiado(true);                                    //   muestra "¡Copiado!"…
    setTimeout(() => setCopiado(false), 2000);           //   … y a los 2 segundos vuelve a "Copiar"
  }                                                      //
  return (                                               //
    <div className="flex items-center justify-between gap-3 rounded-xl bg-humo px-4 py-3 text-left">
                                                         // Cuadro gris: dato a la izquierda, botón a la derecha
      <div className="min-w-0">                          //
        <p className="text-xs tracking-widest text-piedra uppercase">{etiqueta}</p>
                                                         //   "ALIAS"
        <p id={`dato-${etiqueta}`} className="font-mono text-base break-all text-cream select-all">{valor}</p>
                                                         //   el dato, con letra de máquina de escribir. select-all = con un toque se selecciona entero
      </div>                                             //
      <button type="button" onClick={copiar} className="btn-linea shrink-0 !px-3 !py-1.5 !text-[0.65rem]">
        {copiado ? "¡Copiado!" : "Copiar"}               //   el texto del botón
      </button>                                          //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/components/VideoPresentacion.tsx` — el video

No tiene `"use client"`: se arma en el servidor.

```tsx
export function urlEmbed(url: string): { tipo: "iframe" | "video"; src: string } | null {
                                                         // Convierte el link que pegó la profesional en uno que se puede mostrar dentro de la página
  const u = url.trim();                                  // Sin espacios
  if (!u) return null;                                   // Vacío → nada
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
                                                         // ¿Es de YouTube? Busca el código del video (11 caracteres) en cualquiera de sus formatos de link
  if (yt) return { tipo: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
                                                         // Si es YouTube: la versión "sin cookies" (más privada). rel=0 = al terminar, no sugerir videos de otros canales
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
                                                         // ¿Es de Vimeo? Busca el número del video
  if (vimeo) return { tipo: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
                                                         // Si es Vimeo: su reproductor
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(u)) return { tipo: "video", src: u };
                                                         // ¿Es un archivo de video directo (.mp4)? Se muestra con el reproductor del navegador
  return null;                                           // Si no es ninguno, nada
}                                                        // Fin

export function VideoPresentacion({ url, vertical = false }: { url: string; vertical?: boolean }) {
                                                         // El componente
  const e = urlEmbed(url);                               // Convierte el link
  if (!e) return null;                                   // Si no sirve, no muestra nada
  const esShort = /shorts\//.test(url);                  // ¿Es un "Short" de YouTube (video vertical)?
  const aspecto = vertical || esShort ? "aspect-[9/16] max-w-sm" : "aspect-video max-w-4xl";
                                                         // Forma: vertical 9:16 (como el celular) o horizontal 16:9
  return (                                               //
    <div className={`relative mx-auto w-full ${aspecto} overflow-hidden rounded-2xl border border-gold/30 shadow-[0_0_80px_-20px_rgba(201,169,110,0.35)]`}>
                                                         // Marco con puntas redondeadas, borde dorado y resplandor
      {e.tipo === "iframe" ? (                           // Si es YouTube o Vimeo:
        <iframe                                          //   un "iframe" = una página dentro de la página
          src={e.src}                                    //
          title="Video de presentación"                  //   título (accesibilidad)
          className="absolute inset-0 h-full w-full"     //   ocupa todo el marco
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                         //   permisos que necesita el reproductor
          allowFullScreen                                //   permite pantalla completa
          loading="lazy"                                 //   se carga recién cuando la clienta baja hasta acá (la página abre más rápido)
        />                                               //
      ) : (                                              // Si es un archivo .mp4:
        <video src={e.src} controls playsInline preload="metadata" poster="/og.jpg" className="absolute inset-0 h-full w-full object-cover" />
                                                         //   reproductor con controles; playsInline = en iPhone no salta a pantalla completa; poster = imagen antes de reproducir
      )}                                                 //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/components/BotonCancelar.tsx` — el botón de cancelar turno

```tsx
"use client";                                            // Corre en el navegador

import { useState, useTransition } from "react";         // Herramientas de React
import { cancelarPorClienta } from "@/app/actions/reservas";
                                                         // La acción del servidor que cancela (guía de seguridad)
import { logError } from "@/lib/log";                    // Registro con etiqueta

export function BotonCancelar({ turnoId, token }: { turnoId: string; token: string }) {
                                                         // Recibe el id del turno y su token secreto
  const [confirmar, setConfirmar] = useState(false);     // ¿Está en el paso de "¿Seguro?"?
  const [error, setError] = useState<string | null>(null);
                                                         // Mensaje de error
  const [pendiente, start] = useTransition();            // "pendiente" = true mientras cancela

  if (!confirmar) {                                      // PRIMER PASO: solo un link "Cancelar turno"
    return (                                             //
      <button type="button" onClick={() => setConfirmar(true)} className="text-sm text-piedra underline underline-offset-4 hover:text-cream">
        Cancelar turno                                   //   al tocarlo, pasa al paso de confirmación (así nadie cancela sin querer)
      </button>                                          //
    );                                                   //
  }                                                      //
  return (                                               // SEGUNDO PASO: "¿Seguro?"
    <div className="rounded-xl border border-linea p-4 text-sm">
      <p>¿Seguro que querés cancelar este turno?</p>     //
      <div className="mt-3 flex flex-wrap gap-3">        //
        <button                                          //   botón "Sí, cancelar":
          type="button"                                  //
          disabled={pendiente}                           //     desactivado mientras procesa
          onClick={() => start(async () => {             //     al tocarlo:
            try {                                        //       intenta…
              const r = await cancelarPorClienta(turnoId, token);
                                                         //       … cancelar en el servidor
              if (r.error) setError(r.error);            //       … si el servidor dice que no, muestra el motivo
            } catch (err) {                              //       PLAN B (sin conexión):
              logError("cancelar turno (navegador)", err);
                                                         //         anota
              setError("No pudimos cancelar el turno. Revisá tu conexión y probá de nuevo, o escribinos por WhatsApp.");
                                                         //         y avisa (el turno NO se canceló)
            }                                            //
          })}                                            //
          className="rounded-full bg-red-500/80 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50"
                                                         //     rojo
        >                                                //
          {pendiente ? "Cancelando…" : "Sí, cancelar"}   //     el texto cambia mientras procesa
        </button>                                        //
        <button type="button" onClick={() => setConfirmar(false)} className="rounded-full border border-linea px-4 py-2">
          No, mantener                                   //   botón "No, mantener": vuelve al primer paso
        </button>                                        //
      </div>                                             //
      {error && <p className="mt-3 text-red-400">{error}</p>}
                                                         // El error, si hay
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

> Si la cancelación sale bien, no hace falta hacer nada más acá: el servidor llama a `revalidatePath` y la página se redibuja sola mostrando "Turno cancelado".

---

## `src/components/EstadoBadge.tsx` — la etiqueta de color del estado (la usa el panel)

```tsx
import type { EstadoTurno } from "@prisma/client";       // El tipo de estado de turno

const ESTILOS: Record<EstadoTurno, [string, string]> = { // Tabla: estado → [texto, colores]. Record obliga a que estén TODOS los estados
  PENDIENTE_PAGO: ["Esperando seña", "bg-amber-100 text-amber-800"],
                                                         // amarillo
  CONFIRMADO: ["Confirmado", "bg-emerald-100 text-emerald-800"],
                                                         // verde
  COMPLETADO: ["Realizado", "bg-sky-100 text-sky-800"],  // celeste
  AUSENTE: ["No vino", "bg-orange-100 text-orange-800"], // naranja
  CANCELADO: ["Cancelado", "bg-stone-200 text-stone-600"],
                                                         // gris
};                                                       //

export function EstadoBadge({ estado }: { estado: EstadoTurno }) {
                                                         // El componente recibe un estado…
  const [txt, cls] = ESTILOS[estado];                    // … busca su texto y colores…
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{txt}</span>;
                                                         // … y dibuja una "pastillita" de color con el texto
}                                                        // Fin
```
