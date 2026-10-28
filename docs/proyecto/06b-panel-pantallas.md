# Capítulo 6b · Las pantallas del panel

Todas las pantallas del panel siguen la misma receta:
1. `await requireAdmin()`: exige sesión.
2. Leen lo que necesitan de la base (con `prisma`).
3. Dibujan la pantalla con formularios cuyos botones llaman a las acciones del [capítulo 6](06-panel.md).

Los colores del panel son claros (`.admin`, `.card`, `.btn`, `.btn-sec`, `.input`, `.lbl`), y están definidos en `globals.css` (capítulo 5).
Los colores tipo `text-[#6b635b]` son grises cálidos escritos directo.

---

## `src/app/admin/(panel)/page.tsx` — la Agenda (`/admin`)

Muestra una semana de turnos, día por día. También avisa qué falta configurar.

```tsx
import Link from "next/link";                            // Links
import { prisma } from "@/lib/db";                       // La base
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { aFechaUTC, fechaHoraLarga, fechaISO, fechaLarga, horaAR, sumarDias } from "@/lib/tiempo";
                                                         // Herramientas de fechas (capítulo 3)
import { getConfig } from "@/lib/config";                // Configuración
import { senaPorTransferencia } from "@/lib/sena";       // ¿Hay seña?
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
                                                         // Formatos
import { EstadoBadge } from "@/components/EstadoBadge";  // La etiqueta de color del estado
import { cambiarEstadoTurno } from "../acciones";        // La acción de los botones de estado

export default async function Agenda({ searchParams }: { searchParams: Promise<{ desde?: string; aviso?: string }> }) {
                                                         // Puede venir ?desde=2026-10-05 (qué semana mirar) y ?aviso=… (un mensaje)
  await requireAdmin(); // cada página revisa la sesión (el layout no se vuelve a ejecutar al navegar)
  const sp = await searchParams;                         // Lee los parámetros
  const hoy = fechaISO(new Date());                      // Hoy
  const desde = sp.desde && /^\d{4}-\d{2}-\d{2}$/.test(sp.desde) ? sp.desde : hoy;
                                                         // Desde qué día mostrar: el que vino (si tiene formato válido) o hoy
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(desde, i));
                                                         // Los 7 días a mostrar: desde, desde+1, … desde+6
  const ahora = new Date();                              // Ahora

  const [cfg, cantidadUsuarios] = await Promise.all([getConfig(), prisma.administrador.count()]);
                                                         // Lee la configuración y cuántos usuarios hay
  const pendientes: { ok: boolean; texto: string; link: string }[] = [
                                                         // LISTA DE PUESTA A PUNTO: [¿está hecho?, qué es, dónde se arregla]
    { ok: Boolean(cfg.emailProfesional), texto: "Email de la profesional (donde llegan los avisos)", link: "/admin/configuracion" },
    { ok: Boolean(cfg.whatsapp), texto: "WhatsApp (donde llegan los comprobantes de la seña)", link: "/admin/configuracion" },
    { ok: cfg.senaTipo === "NINGUNA" || senaPorTransferencia(cfg), texto: "Alias o CBU para la seña", link: "/admin/configuracion" },
                                                         //   (si no cobra seña, no hace falta el alias)
    { ok: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS), texto: "Mails conectados (Gmail en Vercel)", link: "/admin/configuracion#mails" },
                                                         //   (solo se revisa SI EXISTEN las variables; su valor nunca sale del servidor)
    { ok: cantidadUsuarios > 0, texto: "Usuario propio de la profesional", link: "/admin/usuarios" },
  ];                                                     //
  const faltan = pendientes.filter((x) => !x.ok).length; // Cuántas cosas faltan

  const turnos = await prisma.turno.findMany({           // Los turnos de la semana:
    where: {                                             //
      inicio: { gte: aFechaUTC(desde, "00:00"), lt: aFechaUTC(sumarDias(desde, 7), "00:00") },
                                                         //   que empiecen dentro de esos 7 días
      OR: [{ estado: { not: "PENDIENTE_PAGO" } }, { expiraEn: { gt: ahora } }],
                                                         //   y que no sean reservas vencidas (esperaban seña y se pasó el plazo)
    },                                                   //
    include: { clienta: true, servicio: true },          //   con clienta y tratamiento
    orderBy: { inicio: "asc" },                          //   por hora
  });                                                    //

  const activos = turnos.filter((t) => t.estado !== "CANCELADO");
                                                         // Los que no están cancelados
  const deHoy = activos.filter((t) => fechaISO(t.inicio) === hoy).length;
                                                         // Cuántos son de hoy
  const total = activos.reduce((a, t) => a + t.precio, 0);
                                                         // Suma de precios de la semana. reduce = recorre la lista acumulando (a = acumulado, empieza en 0)

  return (                                               //
    <div>                                                //
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                                                         // ENCABEZADO: título y resumen a la izquierda, navegación a la derecha
        <div>                                            //
          <h1 className="font-serif text-3xl">Agenda</h1>
          <p className="text-sm text-[#6b635b]">         //
            {desde === hoy ? `Hoy ${deHoy} turno${deHoy === 1 ? "" : "s"} · ` : ""}
                                                         //   "Hoy 3 turnos · " (solo si se está mirando desde hoy; "turno" o "turnos" según la cantidad)
            {activos.length} en la semana · {formatPrecio(total)} estimado
          </p>                                           //
        </div>                                           //
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-sec" href={`/admin?desde=${sumarDias(desde, -7)}`}>← Anterior</Link>
                                                         //   semana anterior (desde − 7 días)
          {desde !== hoy && <Link className="btn-sec" href="/admin">Hoy</Link>}
                                                         //   volver a hoy (si no está ya ahí)
          <Link className="btn-sec" href={`/admin?desde=${sumarDias(desde, 7)}`}>Siguiente →</Link>
                                                         //   semana siguiente
          <form className="flex gap-2">                  //   ir a una fecha (formulario SIN action: el navegador va a /admin?desde=<fecha>)
            <input type="date" name="desde" defaultValue={desde} className="input !w-auto !py-1.5" />
                                                         //     selector de fecha
            <button className="btn-sec">Ir</button>      //
          </form>                                        //
          <Link className="btn" href="/admin/turnos/nuevo">+ Nuevo turno</Link>
        </div>                                           //
      </div>                                             //

      {faltan > 0 && (                                   // PUESTA A PUNTO (solo si falta algo)
        <section className="card mb-6 p-5">              //
          <h2 className="font-semibold">Puesta a punto · faltan {faltan} de {pendientes.length}</h2>
          <ul className="mt-3 space-y-2 text-sm">        //
            {pendientes.map((x) => (                     //   por cada punto:
              <li key={x.texto} className="flex items-center gap-2">
                <span className={x.ok ? "text-emerald-700" : "text-[#c9a96e]"}>{x.ok ? "✓" : "○"}</span>
                                                         //     ✓ verde si está hecho, ○ dorado si falta
                {x.ok ? <span className="text-[#8b8279] line-through">{x.texto}</span> : <Link href={x.link} className="underline">{x.texto}</Link>}
                                                         //     hecho: tachado. Falta: link a donde se arregla
              </li>                                      //
            ))}                                          //
          </ul>                                          //
        </section>                                       //
      )}                                                 //

      {sp.aviso && (                                     // EL AVISO (ej: "no se puede confirmar: el horario ya está ocupado")
        <p role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{sp.aviso}</p>
      )}                                                 //

      <div className="space-y-6">                        // LOS 7 DÍAS
        {dias.map((dia) => {                             //   por cada día:
          const delDia = turnos.filter((t) => fechaISO(t.inicio) === dia);
                                                         //     sus turnos
          return (                                       //
            <section key={dia}>                          //
              <h2 className={`mb-2 text-sm font-semibold first-letter:uppercase ${dia === hoy ? "text-[#8a6d3b]" : "text-[#6b635b]"}`}>
                                                         //     el título del día (dorado si es hoy)
                {fechaLarga(aFechaUTC(dia, "12:00"))}{dia === hoy && " · hoy"}
                                                         //     "Sábado 3 de octubre · hoy"
              </h2>                                      //
              {delDia.length === 0 ? (                   //     sin turnos:
                <p className="card px-4 py-3 text-sm text-[#a49d94]">Sin turnos</p>
              ) : (                                      //     con turnos, una lista:
                <ul className="card divide-y divide-[#f0ebe3]">
                                                         //       (divide-y = una línea entre cada turno)
                  {delDia.map((t) => (                   //       por cada turno, un renglón:
                    <li key={t.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${t.estado === "CANCELADO" ? "opacity-50" : ""}`}>
                                                         //         (cancelado → medio transparente)
                      <span className="w-24 font-mono text-sm font-semibold">{horaAR(t.inicio)}–{horaAR(t.fin)}</span>
                                                         //         "10:00–11:00"
                      <div className="min-w-48 flex-1">  //
                        <Link href={`/admin/clientas/${t.clientaId}`} className="font-medium hover:underline">{t.clienta.nombre}</Link>
                                                         //         nombre de la clienta → lleva a su ficha
                        <p className="text-sm text-[#6b635b]">
                          {t.servicio.nombre} · {formatPrecio(t.precio)}
                                                         //         tratamiento · precio
                          {t.montoSena > 0 && t.estado !== "PENDIENTE_PAGO" && ` · seña ${formatPrecio(t.montoSena)} recibida`}
                                                         //         " · seña $10.000 recibida" (si ya la pagó)
                        </p>                             //
                        {t.notasClienta && <p className="mt-1 text-xs text-[#8b8279] italic">“{t.notasClienta}”</p>}
                                                         //         el comentario de la clienta, en cursiva
                        {t.estado === "PENDIENTE_PAGO" && t.expiraEn && (
                                                         //         si espera la seña, el plazo:
                          <p className="mt-1 text-xs text-amber-800 first-letter:uppercase">
                            Seña de {formatPrecio(t.montoSena)} · se libera el {fechaHoraLarga(t.expiraEn)} si no llega
                          </p>                           //
                        )}                               //
                      </div>                             //
                      <EstadoBadge estado={t.estado} />  //         la etiqueta de color
                      <div className="flex flex-wrap gap-1.5">
                                                         //         LOS BOTONES, según el estado:
                        {t.clienta.telefono && (         //           WhatsApp (si tiene teléfono)
                          <a className="btn-sec" target="_blank" rel="noopener" href={linkWhatsapp(t.clienta.telefono)}>WhatsApp</a>
                        )}                               //
                        {t.estado === "PENDIENTE_PAGO" && (
                                                         //           esperando seña → "Seña recibida ✓" (destacado) y "Cancelar"
                          <>                             //
                            <EstadoForm id={t.id} desde={desde} estado="SENA_RECIBIDA" label="Seña recibida ✓" destacado />
                            <EstadoForm id={t.id} desde={desde} estado="CANCELADO" label="Cancelar" />
                          </>                            //
                        )}                               //
                        {t.estado === "CONFIRMADO" && (  //           confirmado → "Realizado", "No vino", "Cancelar"
                          <>                             //
                            <EstadoForm id={t.id} desde={desde} estado="COMPLETADO" label="Realizado" />
                            <EstadoForm id={t.id} desde={desde} estado="AUSENTE" label="No vino" />
                            <EstadoForm id={t.id} desde={desde} estado="CANCELADO" label="Cancelar" />
                          </>                            //
                        )}                               //
                        {(t.estado === "COMPLETADO" || t.estado === "AUSENTE") && (
                                                         //           realizado o no vino → "Deshacer" (vuelve a confirmado, por si se tocó mal)
                          <EstadoForm id={t.id} desde={desde} estado="CONFIRMADO" label="Deshacer" />
                        )}                               //
                      </div>                             //
                    </li>                                //
                  ))}                                    //
                </ul>                                    //
              )}                                         //
            </section>                                   //
          );                                             //
        })}                                              //
      </div>                                             //
    </div>                                               //
  );                                                     //
}                                                        //

function EstadoForm({ id, desde, estado, label, destacado }: { id: string; desde: string; estado: string; label: string; destacado?: boolean }) {
                                                         // MINI COMPONENTE: un botón que cambia el estado de un turno
  return (                                               //
    <form action={cambiarEstadoTurno}>                   //   al tocarlo, corre cambiarEstadoTurno en el servidor, con:
      <input type="hidden" name="id" value={id} />       //     qué turno
      <input type="hidden" name="desde" value={desde} /> //     qué semana se estaba mirando
      <input type="hidden" name="estado" value={estado} />
                                                         //     a qué estado
      <button className={destacado ? "btn" : "btn-sec"}>{label}</button>
                                                         //   el botón (negro si es destacado, blanco si no)
    </form>                                              //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/turnos/page.tsx` — la lista de todos los turnos

Con filtros (próximos, pasados, todos), búsqueda y páginas de 50.

```tsx
import Link from "next/link";                            // Links
import type { EstadoTurno, Prisma } from "@prisma/client";
                                                         // Tipos
import { prisma } from "@/lib/db";                       // La base
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { fechaHoraLarga } from "@/lib/tiempo";           // Fechas
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { EstadoBadge } from "@/components/EstadoBadge";  // Etiqueta de estado
import { cambiarEstadoTurno } from "../../acciones";     // Acción de estado

const POR_PAGINA = 50;                                   // Turnos por página
const ESTADOS: [EstadoTurno | "", string][] = [          // Opciones del filtro de estado: [valor, texto]
  ["", "Todos los estados"],                             //
  ["CONFIRMADO", "Confirmados"],                         //
  ["PENDIENTE_PAGO", "Esperando seña"],                  //
  ["COMPLETADO", "Realizados"],                          //
  ["AUSENTE", "No vinieron"],                            //
  ["CANCELADO", "Cancelados"],                           //
];                                                       //

interface Filtros { ver?: string; estado?: string; q?: string; pagina?: string }
                                                         // Los filtros que pueden venir en la dirección (?ver=…&estado=…&q=…&pagina=…)

export default async function Turnos({ searchParams }: { searchParams: Promise<Filtros> }) {
  await requireAdmin(); // cada página revisa la sesión (el layout no se vuelve a ejecutar al navegar)
  const sp = await searchParams;                         // Lee los filtros
  const ver = sp.ver === "pasados" || sp.ver === "todos" ? sp.ver : "proximos";
                                                         // Qué mirar: pasados, todos o (por defecto) próximos
  const estado = ESTADOS.some(([e]) => e && e === sp.estado) ? (sp.estado as EstadoTurno) : undefined;
                                                         // El estado elegido, solo si es uno válido de la lista
  const q = (sp.q ?? "").trim();                         // El texto de búsqueda
  const pagina = Math.max(1, Number(sp.pagina) || 1);    // La página (mínimo 1)
  const ahora = new Date();                              // Ahora

  const where: Prisma.TurnoWhereInput = {                // ARMA EL FILTRO para la base, sumando partes:
    ...(ver === "proximos" ? { inicio: { gte: ahora } } : ver === "pasados" ? { inicio: { lt: ahora } } : {}),
                                                         //   próximos: desde ahora · pasados: antes de ahora · todos: sin filtro de fecha
    ...(estado ? { estado } : {}),                       //   si eligió un estado, solo ese
    ...(q                                                //   si escribió algo para buscar:
      ? {                                                //
          OR: [                                          //     que coincida en alguno de estos campos:
            { clienta: { nombre: { contains: q, mode: "insensitive" } } },
                                                         //       nombre de la clienta (contains = que contenga; insensitive = sin importar mayúsculas)
            { clienta: { email: { contains: q, mode: "insensitive" } } },
                                                         //       su email
            { clienta: { telefono: { contains: q } } },  //       su teléfono
            { servicio: { nombre: { contains: q, mode: "insensitive" } } },
                                                         //       el nombre del tratamiento
          ],                                             //
        }                                                //
      : {}),                                             //
  };                                                     //

  const [total, turnos] = await Promise.all([            // Pide a la vez:
    prisma.turno.count({ where }),                       //   cuántos turnos hay en total con ese filtro
    prisma.turno.findMany({                              //   y los de esta página:
      where,                                             //
      include: { clienta: true, servicio: true },        //
      orderBy: { inicio: ver === "proximos" ? "asc" : "desc" },
                                                         //     próximos: el más cercano primero · pasados: el más reciente primero
      skip: (pagina - 1) * POR_PAGINA,                   //     saltea los de las páginas anteriores
      take: POR_PAGINA,                                  //     y trae 50
    }),                                                  //
  ]);                                                    //
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
                                                         // Cuántas páginas hay (Math.ceil = redondear para arriba)
  const link = (cambios: Partial<Filtros>) => {          // Arma un link que mantiene los filtros actuales y cambia solo lo indicado
    const p = new URLSearchParams();                     //
    const todo = { ver, estado: estado ?? "", q, pagina: "1", ...cambios };
                                                         //   los filtros actuales + los cambios (al cambiar un filtro, vuelve a la página 1)
    for (const [k, v] of Object.entries(todo)) if (v && !(k === "pagina" && v === "1")) p.set(k, String(v));
                                                         //   agrega solo los que tienen valor (y la página solo si no es la 1)
    return `/admin/turnos?${p}`;                         //
  };                                                     //

  return (                                               //
    <div>                                                //
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>                                            //
          <h1 className="font-serif text-3xl">Turnos</h1>
          <p className="text-sm text-[#6b635b]">{total} turno{total === 1 ? "" : "s"}</p>
                                                         //   "37 turnos"
        </div>                                           //
        <Link className="btn" href="/admin/turnos/nuevo">+ Nuevo turno</Link>
      </div>                                             //

      <div className="mb-3 flex flex-wrap gap-1.5">      // PESTAÑAS: Próximos | Pasados | Todos
        {([["proximos", "Próximos"], ["pasados", "Pasados"], ["todos", "Todos"]] as const).map(([v, t]) => (
          <Link key={v} href={link({ ver: v })} className={ver === v ? "btn" : "btn-sec"}>{t}</Link>
                                                         //   la elegida en negro, las otras en blanco
        ))}                                              //
      </div>                                             //

      <form className="card mb-5 flex flex-wrap items-end gap-3 p-3">
                                                         // BÚSQUEDA Y FILTRO (sin action: el navegador arma la dirección con los campos)
        <input type="hidden" name="ver" value={ver} />   //   mantiene la pestaña elegida
        <div className="min-w-48 flex-1">                //
          <label className="lbl" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={q} placeholder="Clienta, email, teléfono o tratamiento" className="input" />
        </div>                                           //
        <div>                                            //
          <label className="lbl" htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={estado ?? ""} className="input">
                                                         //   lista desplegable
            {ESTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                                                         //   una opción por estado
          </select>                                      //
        </div>                                           //
        <button className="btn-sec">Filtrar</button>     //
      </form>                                            //

      <ul className="card divide-y divide-[#f0ebe3]">    // LA LISTA
        {turnos.length === 0 && <li className="p-6 text-center text-sm text-[#8b8279]">No hay turnos con estos filtros.</li>}
        {turnos.map((t) => (                             //   un renglón por turno:
          <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="w-56 text-sm font-medium first-letter:uppercase">{fechaHoraLarga(t.inicio)}</div>
                                                         //     fecha y hora
            <div className="min-w-48 flex-1">            //
              <Link href={`/admin/clientas/${t.clientaId}`} className="font-medium hover:underline">{t.clienta.nombre}</Link>
              <p className="text-sm text-[#6b635b]">     //
                {t.servicio.nombre} · {formatPrecio(t.precio)}
                {t.montoSena > 0 && t.estado !== "PENDIENTE_PAGO" && t.estado !== "CANCELADO" && ` · seña ${formatPrecio(t.montoSena)} recibida`}
              </p>                                       //
            </div>                                       //
            <EstadoBadge estado={t.estado} />            //     etiqueta de estado
            {t.estado === "PENDIENTE_PAGO" && (          //     si espera seña, botón para confirmarla
              <form action={cambiarEstadoTurno}>         //
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="estado" value="SENA_RECIBIDA" />
                <button className="btn">Seña recibida ✓</button>
              </form>                                    //
            )}                                           //
            {t.clienta.telefono && (                     //     WhatsApp
              <a className="btn-sec" target="_blank" rel="noopener" href={linkWhatsapp(t.clienta.telefono)}>WhatsApp</a>
            )}                                           //
          </li>                                          //
        ))}                                              //
      </ul>                                              //

      {paginas > 1 && (                                  // PAGINACIÓN (solo si hay más de una página)
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {pagina > 1 && <Link className="btn-sec" href={link({ pagina: String(pagina - 1) })}>← Anterior</Link>}
          <span className="text-[#6b635b]">Página {pagina} de {paginas}</span>
          {pagina < paginas && <Link className="btn-sec" href={link({ pagina: String(pagina + 1) })}>Siguiente →</Link>}
        </div>                                           //
      )}                                                 //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/turnos/nuevo/page.tsx` — cargar un turno a mano

Reusa el mismo formulario `Reserva` de la web, pero en tema claro y sin seña.

```tsx
import { prisma } from "@/lib/db";                       // La base
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { fechaISO, sumarDias } from "@/lib/tiempo";      // Fechas
import { Reserva } from "@/components/Reserva";          // El formulario de reserva (capítulo 5b)
import { reservarDesdePanel } from "../../../acciones";  // La acción del panel (capítulo 6)

export default async function NuevoTurno() {             //
  await requireAdmin(); // cada página revisa la sesión (el layout no se vuelve a ejecutar al navegar)
  const [servicios, franjas] = await Promise.all([       // Lee tratamientos activos y días de atención (igual que /reservar)
    prisma.servicio.findMany({                           //
      where: { activo: true },                           //
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],    //
      select: { id: true, nombre: true, descripcion: true, categoria: true, duracionMin: true, precio: true },
    }),                                                  //
    prisma.horarioAtencion.findMany({ select: { diaSemana: true } }),
  ]);                                                    //
  const hoy = fechaISO(new Date());                      //
  return (                                               //
    <div className="mx-auto max-w-4xl">                  //
      <h1 className="font-serif text-3xl">Nuevo turno</h1>
      <p className="mb-6 text-sm text-[#6b635b]">        //
        Para turnos que te piden por WhatsApp o teléfono. Se confirma sin seña y la clienta recibe el mail de confirmación.
      </p>                                               //
      <Reserva                                           // El formulario con:
        tema="claro"                                     //   tema claro (y pide los horarios con &panel=1)
        servicios={servicios}                            //
        diasAtencion={[...new Set(franjas.map((f) => f.diaSemana))]}
        desde={hoy}                                      //
        hasta={sumarDias(hoy, 365)}                      //   hasta un año adelante
        sena={{ tipo: "NINGUNA", valor: 0, activa: false }}
                                                         //   sin seña
        politica=""                                      //   sin política
        accion={reservarDesdePanel}                      //   llama a la acción del panel (no a la de la web)
      />                                                 //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/servicios/page.tsx` — Tratamientos

Lista de tratamientos, con un formulario para crear o editar.

```tsx
import Link from "next/link";                            // Links
import type { Servicio } from "@prisma/client";          // Tipo de un tratamiento
import { prisma } from "@/lib/db";                       // La base
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { formatDuracion, formatPrecio } from "@/lib/formato";
import { eliminarServicio, guardarServicio } from "../../acciones";
                                                         // Acciones de guardar y eliminar

export default async function Servicios({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
                                                         // ?editar=nuevo (crear) o ?editar=<id> (editar ese)
  await requireAdmin(); // cada página revisa la sesión (el layout no se vuelve a ejecutar al navegar)
  const { editar } = await searchParams;                 //
  const servicios = await prisma.servicio.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
                                                         // TODOS los tratamientos (también los ocultos)
  const enEdicion = editar === "nuevo" ? null : servicios.find((s) => s.id === editar);
                                                         // El que se está editando (si hay)
  const categorias = [...new Set(servicios.map((s) => s.categoria))];
                                                         // Categorías existentes (para sugerirlas al escribir)

  return (                                               //
    <div>                                                //
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Tratamientos</h1>
        <Link href="/admin/servicios?editar=nuevo" className="btn">+ Nuevo tratamiento</Link>
      </div>                                             //

      {(editar === "nuevo" || enEdicion) && <FormServicio s={enEdicion ?? undefined} categorias={categorias} />}
                                                         // El formulario, solo si se está creando o editando

      <div className="card overflow-x-auto">             // LA TABLA (en el celular se desliza de costado)
        <table className="w-full text-sm">               //
          <thead className="text-left text-xs text-[#6b635b] uppercase">
                                                         //   encabezado de la tabla
            <tr className="border-b border-[#f0ebe3]">   //
              <th className="p-3">Tratamiento</th><th className="p-3">Categoría</th><th className="p-3">Duración</th>
              <th className="p-3">Precio</th><th className="p-3">Estado</th><th className="p-3" />
                                                         //   (la última columna, sin título, es para los botones)
            </tr>                                        //
          </thead>                                       //
          <tbody className="divide-y divide-[#f0ebe3]">  //   cuerpo de la tabla
            {servicios.map((s) => (                      //   una fila por tratamiento:
              <tr key={s.id} className={s.activo ? "" : "opacity-50"}>
                                                         //     (oculto → medio transparente)
                <td className="p-3 font-medium">{s.nombre}</td>
                <td className="p-3">{s.categoria}</td>   //
                <td className="p-3">{formatDuracion(s.duracionMin)}</td>
                <td className="p-3">{formatPrecio(s.precio)}</td>
                <td className="p-3">{s.activo ? "Visible" : "Oculto"}</td>
                <td className="p-3">                     //
                  <div className="flex justify-end gap-1.5">
                    <Link className="btn-sec" href={`/admin/servicios?editar=${s.id}`}>Editar</Link>
                                                         //     "Editar" → abre el formulario con este tratamiento
                    <form action={eliminarServicio}>     //     "Eliminar" (si tiene turnos, solo lo oculta)
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn-sec text-red-700">Eliminar</button>
                    </form>                              //
                  </div>                                 //
                </td>                                    //
              </tr>                                      //
            ))}                                          //
          </tbody>                                       //
        </table>                                         //
        {servicios.length === 0 && <p className="p-6 text-center text-sm text-[#8b8279]">Todavía no cargaste tratamientos.</p>}
      </div>                                             //
      <p className="mt-3 text-xs text-[#8b8279]">Si un tratamiento ya tiene turnos, al eliminarlo se oculta para conservar el historial.</p>
    </div>                                               //
  );                                                     //
}                                                        //

function FormServicio({ s, categorias }: { s?: Servicio; categorias: string[] }) {
                                                         // EL FORMULARIO. "s" = el tratamiento a editar (si no viene, es uno nuevo)
  return (                                               //
    <form action={guardarServicio} className="card mb-6 grid gap-4 p-5 sm:grid-cols-6">
                                                         //   al guardar, corre guardarServicio. Grilla de 6 columnas para acomodar las casillas
      <input type="hidden" name="id" value={s?.id ?? ""} />
                                                         //   el id (vacío si es nuevo)
      <h2 className="font-semibold sm:col-span-6">{s ? `Editar: ${s.nombre}` : "Nuevo tratamiento"}</h2>
      <div className="sm:col-span-4">                    //   NOMBRE (4 de 6 columnas)
        <label className="lbl">Nombre</label>            //
        <input name="nombre" required defaultValue={s?.nombre} className="input" />
                                                         //     defaultValue = viene completo con el valor actual
      </div>                                             //
      <div className="sm:col-span-2">                    //   CATEGORÍA
        <label className="lbl">Categoría</label>         //
        <input name="categoria" list="categorias" defaultValue={s?.categoria ?? "Faciales"} className="input" />
                                                         //     list="categorias" = al escribir, sugiere las categorías existentes
        <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
                                                         //     la lista de sugerencias
      </div>                                             //
      <div className="sm:col-span-6">                    //   DESCRIPCIÓN
        <label className="lbl">Descripción (se muestra en la web)</label>
        <textarea name="descripcion" rows={3} defaultValue={s?.descripcion} className="input" />
      </div>                                             //
      <div className="sm:col-span-2">                    //   DURACIÓN
        <label className="lbl">Duración (minutos)</label>
        <input name="duracionMin" type="number" min={5} step={5} required defaultValue={s?.duracionMin ?? 60} className="input" />
                                                         //     número, mínimo 5, de a 5 minutos, 60 por defecto
      </div>                                             //
      <div className="sm:col-span-2">                    //   PRECIO
        <label className="lbl">Precio ($)</label>        //
        <input name="precio" type="number" min={0} step={100} required defaultValue={s?.precio} className="input" />
                                                         //     de a $100
      </div>                                             //
      <div className="sm:col-span-1">                    //   ORDEN
        <label className="lbl">Orden</label>             //
        <input name="orden" type="number" defaultValue={s?.orden ?? 0} className="input" />
      </div>                                             //
      <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-1">
        <input type="checkbox" name="activo" defaultChecked={s?.activo ?? true} /> Visible
                                                         //   casilla "Visible" (tildada por defecto)
      </label>                                           //
      <div className="flex gap-2 sm:col-span-6">         //
        <button className="btn">Guardar</button>         //
        <Link href="/admin/servicios" className="btn-sec">Cancelar</Link>
                                                         //   "Cancelar" = volver sin ?editar (se cierra el formulario)
      </div>                                             //
    </form>                                              //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/horarios/page.tsx` — Horarios y días bloqueados

```tsx
import { prisma } from "@/lib/db";                       // La base
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { fechaHoraLarga } from "@/lib/tiempo";           // Fechas
import { DIAS, ORDEN_SEMANA as ORDEN } from "@/lib/dias";
                                                         // Nombres de días; ORDEN_SEMANA se usa con el apodo "ORDEN"
import { agregarBloqueo, agregarFranja, eliminarBloqueo, eliminarFranja } from "../../acciones";
                                                         // Las 4 acciones de esta pantalla

export default async function Horarios() {               //
  await requireAdmin(); // cada página revisa la sesión (el layout no se vuelve a ejecutar al navegar)
  const [franjas, bloqueos] = await Promise.all([        // Lee a la vez:
    prisma.horarioAtencion.findMany({ orderBy: { horaInicio: "asc" } }),
                                                         //   las franjas, ordenadas por hora
    prisma.bloqueo.findMany({ where: { hasta: { gt: new Date() } }, orderBy: { desde: "asc" } }),
                                                         //   los bloqueos que todavía no terminaron
  ]);                                                    //

  return (                                               //
    <div className="grid gap-8 lg:grid-cols-2">          // Dos columnas en compu: horarios | bloqueos
      <section>                                          // COLUMNA 1: HORARIOS DE ATENCIÓN
        <h1 className="font-serif text-3xl">Horarios de atención</h1>
        <p className="mb-4 text-sm text-[#6b635b]">Podés cargar varias franjas por día (ej: 9 a 13 y 15 a 19).</p>
        <div className="card divide-y divide-[#f0ebe3]"> //   un renglón por día de la semana:
          {ORDEN.map((d) => {                            //   (de lunes a domingo)
            const delDia = franjas.filter((f) => f.diaSemana === d);
                                                         //     las franjas de ese día
            return (                                     //
              <div key={d} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="w-24 text-sm font-medium">{DIAS[d]}</span>
                                                         //     el nombre del día
                {delDia.length === 0 && <span className="text-sm text-[#a49d94]">Cerrado</span>}
                                                         //     si no tiene franjas: "Cerrado"
                {delDia.map((f) => (                     //     cada franja es una "pastilla" con su botón ×:
                  <form key={f.id} action={eliminarFranja} className="flex items-center gap-1 rounded-full bg-[#f6f1e9] py-1 pr-1 pl-3 text-sm">
                    <input type="hidden" name="id" value={f.id} />
                    {f.horaInicio} – {f.horaFin}         //       "09:00 – 13:00"
                    <button title="Quitar" className="h-6 w-6 rounded-full text-[#8b8279] hover:bg-white hover:text-red-700">×</button>
                                                         //       × = borrar esta franja
                  </form>                                //
                ))}                                      //
              </div>                                     //
            );                                           //
          })}                                            //
        </div>                                           //
        <form action={agregarFranja} className="card mt-4 flex flex-wrap items-end gap-3 p-4">
                                                         //   FORMULARIO PARA AGREGAR UNA FRANJA:
          <div>                                          //
            <label className="lbl">Día</label>           //
            <select name="diaSemana" className="input">{ORDEN.map((d) => <option key={d} value={d}>{DIAS[d]}</option>)}</select>
                                                         //     lista de días
          </div>                                         //
          <div><label className="lbl">Desde</label><input type="time" name="horaInicio" required defaultValue="09:00" className="input" /></div>
                                                         //     selector de hora de inicio
          <div><label className="lbl">Hasta</label><input type="time" name="horaFin" required defaultValue="13:00" className="input" /></div>
                                                         //     selector de hora de fin
          <button className="btn">Agregar</button>       //
        </form>                                          //
      </section>                                         //

      <section>                                          // COLUMNA 2: DÍAS BLOQUEADOS
        <h2 className="font-serif text-3xl">Días bloqueados</h2>
        <p className="mb-4 text-sm text-[#6b635b]">Vacaciones, feriados o momentos en los que no querés recibir turnos.</p>
        <form action={agregarBloqueo} className="card grid gap-3 p-4 sm:grid-cols-2">
                                                         //   FORMULARIO PARA BLOQUEAR:
          <div><label className="lbl">Desde (día)</label><input type="date" name="desdeFecha" required className="input" /></div>
          <div><label className="lbl">Hora (opcional)</label><input type="time" name="desdeHora" className="input" /></div>
          <div><label className="lbl">Hasta (día)</label><input type="date" name="hastaFecha" className="input" /></div>
          <div><label className="lbl">Hora (opcional)</label><input type="time" name="hastaHora" className="input" /></div>
                                                         //     desde/hasta, con hora opcional (sin hora = el día entero)
          <div className="sm:col-span-2"><label className="lbl">Motivo</label><input name="motivo" placeholder="Vacaciones" className="input" /></div>
          <div className="sm:col-span-2"><button className="btn">Bloquear</button></div>
        </form>                                          //
        <ul className="card mt-4 divide-y divide-[#f0ebe3]">
                                                         //   LISTA DE BLOQUEOS:
          {bloqueos.length === 0 && <li className="p-4 text-sm text-[#a49d94]">No hay bloqueos próximos.</li>}
          {bloqueos.map((b) => (                         //   por cada bloqueo:
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>                                      //
                <p className="font-medium">{b.motivo || "Bloqueado"}</p>
                                                         //     el motivo (o "Bloqueado")
                <p className="text-[#6b635b] first-letter:uppercase">{fechaHoraLarga(b.desde)} → {fechaHoraLarga(b.hasta)}</p>
                                                         //     desde → hasta
              </div>                                     //
              <form action={eliminarBloqueo}>            //     botón "Quitar"
                <input type="hidden" name="id" value={b.id} />
                <button className="btn-sec">Quitar</button>
              </form>                                    //
            </li>                                        //
          ))}                                            //
        </ul>                                            //
      </section>                                         //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/clientas/page.tsx` — lista de Clientas

```tsx
import Link from "next/link";                            // Links
import { prisma } from "@/lib/db";                       // La base
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { fechaLarga } from "@/lib/tiempo";               // Fechas

export default async function Clientas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
                                                         // Puede venir ?q=… (búsqueda)
  await requireAdmin(); // cada página revisa la sesión (el layout no se vuelve a ejecutar al navegar)
  const { q = "" } = await searchParams;                 // El texto buscado (vacío si no hay)
  const clientas = await prisma.clienta.findMany({       // Las clientas:
    where: q                                             //   si buscó algo…
      ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { telefono: { contains: q } }] }
                                                         //     … que coincida en nombre, email o teléfono
      : {},                                              //   si no, todas
    include: {                                           //   y además, de cada una:
      _count: { select: { turnos: { where: { estado: { in: ["CONFIRMADO", "COMPLETADO"] } } } } },
                                                         //     cuántos turnos confirmados o realizados tiene
      turnos: { orderBy: { inicio: "desc" }, take: 1, select: { inicio: true } },
                                                         //     y la fecha de su último turno
    },                                                   //
    orderBy: { updatedAt: "desc" },                      //   las modificadas más recientemente primero
    take: 200,                                           //   como máximo 200
  });                                                    //

  return (                                               //
    <div>                                                //
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Clientas</h1>
        <form className="flex gap-2">                    //   buscador (va a /admin/clientas?q=…)
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, email o teléfono" className="input sm:!w-80" />
          <button className="btn-sec">Buscar</button>    //
        </form>                                          //
      </div>                                             //
      <div className="card overflow-x-auto">             //   LA TABLA
        <table className="w-full text-sm">               //
          <thead className="text-left text-xs text-[#6b635b] uppercase">
            <tr className="border-b border-[#f0ebe3]"><th className="p-3">Nombre</th><th className="p-3">Contacto</th><th className="p-3">Turnos</th><th className="p-3">Último turno</th></tr>
          </thead>                                       //
          <tbody className="divide-y divide-[#f0ebe3]">  //
            {clientas.map((c) => (                       //   una fila por clienta:
              <tr key={c.id}>                            //
                <td className="p-3"><Link href={`/admin/clientas/${c.id}`} className="font-medium hover:underline">{c.nombre}</Link></td>
                                                         //     nombre → su ficha
                <td className="p-3 text-[#6b635b]">{c.email}<br />{c.telefono}</td>
                                                         //     email y teléfono (<br /> = salto de línea)
                <td className="p-3">{c._count.turnos}</td>
                                                         //     cantidad de turnos
                <td className="p-3 first-letter:uppercase">{c.turnos[0] ? fechaLarga(c.turnos[0].inicio) : "-"}</td>
                                                         //     fecha del último turno (o "-")
              </tr>                                      //
            ))}                                          //
          </tbody>                                       //
        </table>                                         //
        {clientas.length === 0 && <p className="p-6 text-center text-sm text-[#8b8279]">No se encontraron clientas.</p>}
      </div>                                             //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/clientas/[id]/page.tsx` — Ficha de una clienta

```tsx
import Link from "next/link";                            // Links
import { notFound } from "next/navigation";              // "No encontrada"
import { prisma } from "@/lib/db";                       // La base
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { fechaHoraLarga } from "@/lib/tiempo";           // Fechas
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { EstadoBadge } from "@/components/EstadoBadge";  // Etiqueta de estado
import { guardarFicha } from "../../../acciones";        // Acción de guardar la ficha

export default async function FichaClienta({ params }: { params: Promise<{ id: string }> }) {
                                                         // El [id] de la dirección = qué clienta
  await requireAdmin(); // cada página revisa la sesión (el layout no se vuelve a ejecutar al navegar)
  const { id } = await params;                           //
  const c = await prisma.clienta.findUnique({            // Busca la clienta…
    where: { id },                                       //
    include: { turnos: { include: { servicio: true }, orderBy: { inicio: "desc" } } },
                                                         // … con TODOS sus turnos (y el tratamiento de cada uno), del más nuevo al más viejo
  });                                                    //
  if (!c) notFound();                                    // Si no existe → "Página no encontrada"
  const realizados = c.turnos.filter((t) => t.estado === "COMPLETADO");
                                                         // Los turnos que efectivamente se hicieron

  return (                                               //
    <div>                                                //
      <Link href="/admin/clientas" className="text-sm text-[#6b635b] hover:underline">← Clientas</Link>
                                                         // Volver a la lista
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">{c.nombre}</h1>
        <div className="flex gap-2">                     //   botones de contacto:
          {c.telefono && <a className="btn-sec" href={linkWhatsapp(c.telefono)} target="_blank" rel="noopener">WhatsApp</a>}
          <a className="btn-sec" href={`mailto:${c.email}`}>Email</a>
                                                         //   mailto: = abre el programa de mail con su dirección
        </div>                                           //
      </div>                                             //

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                                                         // Dos columnas en compu: ficha | historial
        <form action={guardarFicha} className="card grid gap-4 p-5">
                                                         //   LA FICHA (formulario):
          <input type="hidden" name="id" value={c.id} /> //
          <h2 className="font-semibold">Ficha</h2>       //
          <div><label className="lbl">Nombre</label><input name="nombre" defaultValue={c.nombre} className="input" /></div>
          <div><label className="lbl">Email</label><input value={c.email} disabled className="input bg-[#f6f1e9]" /></div>
                                                         //     email: se muestra pero NO se puede editar (disabled)
          <div><label className="lbl">Teléfono</label><input name="telefono" defaultValue={c.telefono} className="input" /></div>
          <div>                                          //
            <label className="lbl">Tipo de piel</label>  //
            <input name="tipoPiel" list="tipos-piel" defaultValue={c.tipoPiel} className="input" />
                                                         //     con sugerencias…
            <datalist id="tipos-piel">                   //     … de esta lista:
              {["Normal", "Seca", "Grasa", "Mixta", "Sensible", "Con acné", "Madura"].map((t) => <option key={t} value={t} />)}
            </datalist>                                  //
          </div>                                         //
          <div><label className="lbl">Alergias / contraindicaciones</label><textarea name="alergias" rows={2} defaultValue={c.alergias} className="input" /></div>
          <div><label className="lbl">Notas privadas</label><textarea name="notas" rows={5} defaultValue={c.notas} placeholder="Productos usados, evolución, recomendaciones…" className="input" /></div>
                                                         //     notas privadas (la clienta nunca las ve)
          <button className="btn justify-self-start">Guardar ficha</button>
        </form>                                          //

        <section>                                        //   HISTORIAL:
          <h2 className="mb-3 font-semibold">Historial · {realizados.length} sesiones realizadas · {formatPrecio(realizados.reduce((a, t) => a + t.precio, 0))}</h2>
                                                         //     "Historial · 5 sesiones realizadas · $225.000"
          <ul className="card divide-y divide-[#f0ebe3]">
            {c.turnos.length === 0 && <li className="p-4 text-sm text-[#a49d94]">Sin turnos.</li>}
            {c.turnos.map((t) => (                       //     un renglón por turno:
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>                                    //
                  <p className="font-medium">{t.servicio.nombre}</p>
                  <p className="text-[#6b635b] first-letter:uppercase">{fechaHoraLarga(t.inicio)} · {formatPrecio(t.precio)}</p>
                  {t.notasClienta && <p className="mt-1 text-xs text-[#8b8279] italic">“{t.notasClienta}”</p>}
                </div>                                   //
                <EstadoBadge estado={t.estado} />        //       su estado
              </li>                                      //
            ))}                                          //
          </ul>                                          //
        </section>                                       //
      </div>                                             //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/estadisticas/page.tsx` — Estadísticas del mes

```tsx
import Link from "next/link";                            // Links
import { prisma } from "@/lib/db";                       // La base
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { aFechaUTC, fechaISO } from "@/lib/tiempo";      // Fechas
import { formatPrecio } from "@/lib/formato";            // Precios
import { MESES } from "@/lib/dias";                      // Nombres de meses

export default async function Estadisticas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
                                                         // Puede venir ?mes=2026-09
  await requireAdmin(); // cada página revisa la sesión (el layout no se vuelve a ejecutar al navegar)
  const sp = await searchParams;                         //
  const actual = fechaISO(new Date()).slice(0, 7);       // El mes actual: "2026-10" (los primeros 7 caracteres de la fecha)
  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : actual;
                                                         // El mes a mostrar (el que vino, si es válido; si no, el actual)
  const [y, m] = mes.split("-").map(Number);             // Año y número de mes
  const sig = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
                                                         // Mes siguiente (diciembre → enero del año siguiente)
  const ant = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
                                                         // Mes anterior (enero → diciembre del año anterior)
  const rango = { gte: aFechaUTC(`${mes}-01`, "00:00"), lt: aFechaUTC(`${sig}-01`, "00:00") };
                                                         // Desde el día 1 de este mes hasta el día 1 del siguiente

  const [turnos, nuevas, servicios] = await Promise.all([
                                                         // Pide a la vez:
    prisma.turno.findMany({ where: { inicio: rango, estado: { not: "PENDIENTE_PAGO" } }, select: { estado: true, precio: true, servicioId: true, clientaId: true } }),
                                                         //   los turnos del mes (sin los que esperan seña), solo los datos necesarios
    prisma.clienta.count({ where: { createdAt: rango, turnos: { some: { estado: { in: ["CONFIRMADO", "COMPLETADO"] } } } } }),
                                                         //   cuántas clientas NUEVAS hubo este mes (con al menos un turno real)
    prisma.servicio.findMany({ select: { id: true, nombre: true } }),
                                                         //   los tratamientos (para los nombres)
  ]);                                                    //

  const cuenta = (e: string) => turnos.filter((t) => t.estado === e).length;
                                                         // Atajo: cuántos turnos hay en tal estado
  const realizados = turnos.filter((t) => t.estado === "COMPLETADO");
  const agendados = turnos.filter((t) => t.estado === "CONFIRMADO");
  const ausentes = cuenta("AUSENTE");                    //
  const asistibles = realizados.length + ausentes;       // Turnos a los que "debían venir" (para el % de ausencias)

  const porServicio = servicios                          // RANKING DE TRATAMIENTOS:
    .map((s) => {                                        //   por cada tratamiento…
      const ts = turnos.filter((t) => t.servicioId === s.id && ["CONFIRMADO", "COMPLETADO"].includes(t.estado));
                                                         //   … sus turnos confirmados o realizados
      return { nombre: s.nombre, cantidad: ts.length, monto: ts.reduce((a, t) => a + t.precio, 0) };
                                                         //   … nombre, cantidad y monto total
    })                                                   //
    .filter((s) => s.cantidad > 0)                       //   solo los que tuvieron turnos
    .sort((a, b) => b.cantidad - a.cantidad);            //   de mayor a menor cantidad

  const filas: [string, string][] = [                    // LAS FILAS DEL RESUMEN [título, valor]:
    ["Ingresos por turnos realizados", formatPrecio(realizados.reduce((a, t) => a + t.precio, 0))],
    ["Ingresos por turnos agendados (a realizar)", formatPrecio(agendados.reduce((a, t) => a + t.precio, 0))],
    ["Turnos realizados", String(realizados.length)],    //
    ["Turnos agendados", String(agendados.length)],      //
    ["Cancelados", String(cuenta("CANCELADO"))],         //
    ["No asistieron", `${ausentes}${asistibles ? ` (${Math.round((ausentes / asistibles) * 100)}%)` : ""}`],
                                                         //   "2 (10%)": porcentaje de ausencias
    ["Clientas distintas", String(new Set(turnos.filter((t) => t.estado !== "CANCELADO").map((t) => t.clientaId)).size)],
                                                         //   cuántas clientas diferentes vinieron (Set no repite)
    ["Clientas nuevas", String(nuevas)],                 //
  ];                                                     //

  return (                                               //
    <div className="mx-auto max-w-3xl">                  //
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Estadísticas · {MESES[m - 1]} {y}</h1>
                                                         //   "Estadísticas · Octubre 2026"
        <div className="flex gap-2">                     //
          <Link className="btn-sec" href={`/admin/estadisticas?mes=${ant}`}>← {MESES[(m + 10) % 12]}</Link>
                                                         //   botón al mes anterior, con su nombre ((m + 10) % 12 = posición del mes anterior en la lista)
          {mes !== actual && <Link className="btn-sec" href={`/admin/estadisticas?mes=${sig}`}>{MESES[m % 12]} →</Link>}
                                                         //   al siguiente (solo si no es el mes actual: no hay futuro que mostrar)
        </div>                                           //
      </div>                                             //

      <div className="card divide-y divide-[#f0ebe3]">   // EL RESUMEN
        {filas.map(([k, v]) => (                         //
          <div key={k} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-[#6b635b]">{k}</span> //
            <span className="font-semibold tabular-nums">{v}</span>
                                                         //   tabular-nums = todos los números del mismo ancho (quedan alineados)
          </div>                                         //
        ))}                                              //
      </div>                                             //

      <h2 className="mt-8 mb-3 font-semibold">Tratamientos más pedidos</h2>
      <div className="card overflow-x-auto">             // LA TABLA DEL RANKING
        <table className="w-full text-sm">               //
          <thead className="text-left text-xs text-[#6b635b] uppercase">
            <tr className="border-b border-[#f0ebe3]"><th className="p-3">Tratamiento</th><th className="p-3 text-right">Turnos</th><th className="p-3 text-right">Monto</th></tr>
          </thead>                                       //
          <tbody className="divide-y divide-[#f0ebe3]">  //
            {porServicio.map((s) => (                    //
              <tr key={s.nombre}>                        //
                <td className="p-3">{s.nombre}</td>      //
                <td className="p-3 text-right tabular-nums">{s.cantidad}</td>
                <td className="p-3 text-right tabular-nums">{formatPrecio(s.monto)}</td>
              </tr>                                      //
            ))}                                          //
          </tbody>                                       //
        </table>                                         //
        {porServicio.length === 0 && <p className="p-6 text-center text-sm text-[#8b8279]">Sin turnos este mes.</p>}
      </div>                                             //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/configuracion/page.tsx` — Configuración

```tsx
import { getConfig } from "@/lib/config";                // Configuración
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { senaPorTransferencia } from "@/lib/sena";       // ¿Hay seña?
import { enviarMailPrueba, guardarConfiguracion } from "../../acciones";
                                                         // Las dos acciones de esta pantalla

interface Avisos { ok?: string; mailok?: string; mailerror?: string }
                                                         // Mensajes que pueden venir en la dirección

export default async function Configuracion({ searchParams }: { searchParams: Promise<Avisos> }) {
  const [sp, c, yo] = await Promise.all([searchParams, getConfig(), requireAdmin()]);
                                                         // A la vez: los mensajes, la configuración y exigir sesión (yo = quién soy)
  const smtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
                                                         // ¿Están las variables de mail? (solo sí/no, el valor nunca sale del servidor)
  const sena = senaPorTransferencia(c);                  // ¿Se cobra seña?

  const Campo = (p: { name: keyof typeof c; label: string; type?: string; ayuda?: string; className?: string; placeholder?: string }) => (
                                                         // MINI COMPONENTE: una casilla con su etiqueta y ayuda. "name" tiene que ser un campo real de la configuración
    <div className={p.className}>                        //
      <label className="lbl" htmlFor={p.name}>{p.label}</label>
      <input id={p.name} name={p.name} type={p.type ?? "text"} defaultValue={String(c[p.name] ?? "")} placeholder={p.placeholder} className="input" />
                                                         //   la casilla, con el valor actual de la configuración
      {p.ayuda && <p className="mt-1 text-xs text-[#8b8279]">{p.ayuda}</p>}
                                                         //   texto de ayuda, si hay
    </div>                                               //
  );                                                     //

  return (                                               //
    <div className="mx-auto max-w-3xl space-y-6">        //
      <div className="grid gap-3 sm:grid-cols-2">        // CUATRO CUADROS DE ESTADO (verde si está bien, amarillo si falta algo)
        <Estado ok={smtp} titulo="Envío de mails" detalle={smtp ? "Configurado. Probalo abajo con un mail de prueba." : "Faltan las variables SMTP_* en Vercel"} />
        <Estado ok={sena} titulo="Seña por transferencia"
          detalle={sena ? "Activa: las clientas ven el alias/CBU al reservar" : c.senaTipo === "NINGUNA" ? "Sin seña: los turnos se confirman directo" : "Cargá el alias o CBU para pedir la seña"} />
        <Estado ok={Boolean(c.emailProfesional)} titulo="Email de la profesional" detalle={c.emailProfesional || "Completalo abajo para recibir los avisos de turnos"} />
        <Estado ok={Boolean(c.whatsapp)} titulo="WhatsApp" detalle={c.whatsapp || "Completalo: ahí llegan los comprobantes de la seña"} />
      </div>                                             //

      <form id="mails" action={enviarMailPrueba} className="card scroll-mt-20 p-5">
                                                         // PRUEBA DE MAILS (formulario aparte)
        <h2 className="font-semibold">Probar el envío de mails</h2>
        <p className="mt-1 text-sm text-[#6b635b]">Mandá un mail de prueba para confirmar que las clientas van a recibir la confirmación.</p>
        {sp.mailok && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">✓ {sp.mailok}</p>}
                                                         //   resultado bueno, en verde
        {sp.mailerror && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">✗ {sp.mailerror}</p>}
                                                         //   resultado malo, en rojo, con la explicación
        <div className="mt-3 flex flex-wrap gap-2">      //
          <label className="sr-only" htmlFor="para">Email para la prueba</label>
          <input id="para" name="para" type="email" required defaultValue={c.emailProfesional || (yo.maestro ? "" : yo.email)} placeholder="tu@email.com" className="input !w-auto flex-1" />
                                                         //   viene completo con el email de la profesional, o el de quien entró
          <button className="btn">Enviar mail de prueba</button>
        </div>                                           //
      </form>                                            //

      <form action={guardarConfiguracion} className="space-y-6">
                                                         // EL FORMULARIO PRINCIPAL
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl">Configuración</h1>
          <button className="btn">Guardar cambios</button>
                                                         //   botón arriba (y otro abajo de todo)
        </div>                                           //
        {sp.ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Cambios guardados ✓</p>}

        <section className="card grid gap-4 p-5 sm:grid-cols-2">
                                                         //   SECCIÓN: DATOS DEL NEGOCIO
          <h2 className="font-semibold sm:col-span-2">Datos del negocio</h2>
          <Campo name="nombreNegocio" label="Nombre del negocio" />
          <Campo name="nombreProfesional" label="Nombre de la profesional" />
          <Campo name="emailProfesional" label="Email donde recibís los avisos de turnos" type="email" className="sm:col-span-2" />
          <Campo name="whatsapp" label="WhatsApp (ahí llegan los comprobantes)" ayuda="Con código de país, ej: +54 9 11 2345 6789" />
          <Campo name="instagram" label="Instagram" ayuda="Ej: @healthyskin" />
          <Campo name="direccion" label="Dirección" className="sm:col-span-2" />
          <div className="sm:col-span-2">                //
            <label className="lbl" htmlFor="sobreMi">Sobre mí (se muestra en la web)</label>
            <textarea id="sobreMi" name="sobreMi" rows={4} defaultValue={c.sobreMi} className="input" />
          </div>                                         //
          <Campo name="videoUrl" label="Video de presentación" className="sm:col-span-2"
            ayuda="Link de YouTube, Vimeo o de un archivo .mp4. Aparece al final de la página de inicio." />
        </section>                                       //

        <section className="card grid gap-4 p-5 sm:grid-cols-2">
                                                         //   SECCIÓN: SEÑA
          <div className="sm:col-span-2">                //
            <h2 className="font-semibold">Seña por transferencia</h2>
            <p className="text-sm text-[#6b635b]">       //
              Al reservar, la clienta ve estos datos y un botón para mandarte la captura por WhatsApp.
              Cuando la recibís, en la Agenda tocás <strong>“Seña recibida”</strong> y el turno queda confirmado.
            </p>                                         //
          </div>                                         //
          <div>                                          //
            <label className="lbl" htmlFor="senaTipo">Tipo de seña</label>
            <select id="senaTipo" name="senaTipo" defaultValue={c.senaTipo} className="input">
              <option value="NINGUNA">Sin seña (se confirma directo)</option>
              <option value="FIJO">Monto fijo</option>   //
              <option value="PORCENTAJE">Porcentaje del precio</option>
            </select>                                    //
          </div>                                         //
          <Campo name="senaValor" label="Valor ($ o %)" type="number" />
          <Campo name="alias" label="Alias" placeholder="mc.healthy.skin" />
          <Campo name="cbu" label="CBU o CVU (22 números)" placeholder="0000003100000000000000" />
          <Campo name="titularCuenta" label="Titular de la cuenta" />
          <Campo name="banco" label="Banco o billetera" placeholder="Ej: Mercado Pago, Galicia…" />
          <Campo name="horasParaSena" label="Horas para mandar la seña" type="number"
            ayuda="El horario queda apartado este tiempo. Si no llega el comprobante, se libera solo." />
        </section>                                       //

        <section className="card grid gap-4 p-5 sm:grid-cols-2">
                                                         //   SECCIÓN: REGLAS DE RESERVA
          <h2 className="font-semibold sm:col-span-2">Reglas de reserva</h2>
          <Campo name="intervaloMin" label="Ofrecer horarios cada (minutos)" type="number" />
          <Campo name="anticipacionMinHoras" label="Anticipación mínima (horas)" type="number" />
          <Campo name="diasMaxReserva" label="Se puede reservar hasta (días adelante)" type="number" />
          <Campo name="horasParaCancelar" label="Cancelación online hasta (horas antes)" type="number" />
          <div className="sm:col-span-2">                //
            <label className="lbl" htmlFor="politicaCancelacion">Política de cancelación (se muestra al reservar y en el mail)</label>
            <textarea id="politicaCancelacion" name="politicaCancelacion" rows={2} defaultValue={c.politicaCancelacion} className="input" />
          </div>                                         //
        </section>                                       //

        <button className="btn">Guardar cambios</button> //   botón de abajo
      </form>                                            //
    </div>                                               //
  );                                                     //
}                                                        //

function Estado({ ok, titulo, detalle }: { ok: boolean; titulo: string; detalle: string }) {
                                                         // MINI COMPONENTE: un cuadro de estado
  return (                                               //
    <div className={`rounded-xl border p-4 text-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                                                         //   verde si ok, amarillo si no
      <p className="font-medium">{ok ? "✓" : "!"} {titulo}</p>
      <p className="break-words text-[#6b635b]">{detalle}</p>
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/usuarios/page.tsx` — Usuarios del panel

```tsx
import { prisma } from "@/lib/db";                       // La base
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { fechaHoraLarga } from "@/lib/tiempo";           // Fechas
import { cambiarActivoAdministrador, crearAdministrador, resetearPasswordAdministrador } from "../../acciones";
                                                         // Las tres acciones de esta pantalla

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [yo, sp, admins] = await Promise.all([           // A la vez:
    requireAdmin(),                                      //   exigir sesión (yo = quién soy)
    searchParams,                                        //   los mensajes
    prisma.administrador.findMany({ orderBy: { createdAt: "asc" } }),
                                                         //   todos los usuarios, del más viejo al más nuevo
  ]);                                                    //

  return (                                               //
    <div className="mx-auto max-w-3xl space-y-6">        //
      <div>                                              //
        <h1 className="font-serif text-3xl">Usuarios del panel</h1>
        <p className="text-sm text-[#6b635b]">Las personas que pueden entrar al panel con su email y contraseña.</p>
      </div>                                             //
      {sp.ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.ok}</p>}
      {sp.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>}

      <ul className="card divide-y divide-[#f0ebe3]">    // LA LISTA DE USUARIOS
        {admins.length === 0 && (                        //
          <li className="p-4 text-sm text-[#8b8279]">Todavía no hay usuarios. Creá el primero abajo (por ejemplo, para la profesional).</li>
        )}                                               //
        {admins.map((a) => (                             //   por cada usuario:
          <li key={a.id} className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 ${a.activo ? "" : "opacity-60"}`}>
            <div className="min-w-48 flex-1">            //
              <p className="font-medium">                //
                {a.nombre} {a.id === yo.id && <span className="text-xs text-[#8a6d3b]">(vos)</span>}
                                                         //     nombre, y "(vos)" si sos vos
                {!a.activo && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">Desactivado</span>}
              </p>                                       //
              <p className="text-sm text-[#6b635b]">{a.email}</p>
              <p className="text-xs text-[#8b8279] first-letter:uppercase">
                {a.ultimoIngreso ? `Último ingreso: ${fechaHoraLarga(a.ultimoIngreso)}` : "Todavía no ingresó"}
              </p>                                       //
            </div>                                       //
            <form action={resetearPasswordAdministrador} className="flex gap-2">
                                                         //     CAMBIAR SU CONTRASEÑA:
              <input type="hidden" name="id" value={a.id} />
              <label className="sr-only" htmlFor={`pw-${a.id}`}>Nueva contraseña para {a.nombre}</label>
              <input id={`pw-${a.id}`} name="password" type="password" minLength={8} required placeholder="Nueva contraseña" autoComplete="new-password" className="input !w-40 !py-1.5" />
                                                         //       autoComplete="new-password" = el navegador no completa con la contraseña guardada
              <button className="btn-sec">Cambiar</button>
            </form>                                      //
            {a.id !== yo.id && (                         //     DESACTIVAR / ACTIVAR (no aparece en tu propio usuario)
              <form action={cambiarActivoAdministrador}> //
                <input type="hidden" name="id" value={a.id} />
                <button className="btn-sec">{a.activo ? "Desactivar" : "Activar"}</button>
              </form>                                    //
            )}                                           //
          </li>                                          //
        ))}                                              //
      </ul>                                              //

      <form action={crearAdministrador} className="card grid gap-4 p-5 sm:grid-cols-2">
                                                         // CREAR USUARIO NUEVO
        <h2 className="font-semibold sm:col-span-2">Nuevo usuario</h2>
        <div><label className="lbl" htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" required className="input" placeholder="María C." /></div>
        <div><label className="lbl" htmlFor="email">Email (con esto ingresa)</label><input id="email" name="email" type="email" required autoComplete="off" className="input" /></div>
        <div className="sm:col-span-2">                  //
          <label className="lbl" htmlFor="password">Contraseña (mínimo 8 caracteres)</label>
          <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
          <p className="mt-1 text-xs text-[#8b8279]">Pasásela en persona o por WhatsApp. Después puede cambiarla desde "Mi cuenta".</p>
        </div>                                           //
        <div className="sm:col-span-2"><button className="btn">Crear usuario</button></div>
      </form>                                            //

      <p className="text-xs text-[#8b8279]">             //
        Acceso de emergencia: usuario <code>admin</code> con la contraseña <code>ADMIN_PASSWORD</code> configurada en Vercel.
      </p>                                               //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/(panel)/cuenta/page.tsx` — Mi cuenta

```tsx
import { requireAdmin } from "@/lib/auth";               // Exigir sesión
import { cambiarMiPassword } from "../../acciones";      // Acción de cambiar mi contraseña

export default async function MiCuenta({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [yo, sp] = await Promise.all([requireAdmin(), searchParams]);
                                                         // Quién soy y los mensajes
  return (                                               //
    <div className="mx-auto max-w-md space-y-6">         //
      <div>                                              //
        <h1 className="font-serif text-3xl">Mi cuenta</h1>
        <p className="text-sm text-[#6b635b]">{yo.nombre} · {yo.email}</p>
      </div>                                             //
      {sp.ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.ok}</p>}
      {sp.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>}
      {yo.maestro ? (                                    // Si entró con el acceso de emergencia "admin":
        <p className="card p-5 text-sm text-[#6b635b]">  //   explica que esa contraseña se cambia en Vercel
          Entraste con el acceso de emergencia (<code>admin</code>). Su contraseña es <code>ADMIN_PASSWORD</code> y se cambia en Vercel → Settings → Environment Variables.
          Para un acceso propio, creá un usuario en <a className="underline" href="/admin/usuarios">Usuarios</a>.
        </p>                                             //
      ) : (                                              // Si es un usuario normal: el formulario
        <form action={cambiarMiPassword} className="card grid gap-4 p-5">
          <h2 className="font-semibold">Cambiar contraseña</h2>
          <div><label className="lbl" htmlFor="actual">Contraseña actual</label><input id="actual" name="actual" type="password" required autoComplete="current-password" className="input" /></div>
          <div><label className="lbl" htmlFor="nueva">Contraseña nueva (mínimo 8)</label><input id="nueva" name="nueva" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
          <div><label className="lbl" htmlFor="repetir">Repetir contraseña nueva</label><input id="repetir" name="repetir" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
          <p className="text-xs text-[#8b8279]">Al cambiarla se cierra la sesión en tus otros dispositivos.</p>
          <button className="btn justify-self-start">Guardar</button>
        </form>                                          //
      )}                                                 //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

> **Una cosa a notar:** en Configuración, Usuarios y Mi cuenta, `requireAdmin()` está **dentro** del `Promise.all`, junto con otras lecturas. Hace lo mismo que ponerlo en su propia línea: si no hay sesión, redirige al login.
