# Capítulo 6 · El panel de la profesional (`/admin`)

El panel tiene tres partes:
1. **El portero y el login:** quién puede entrar. Está en la [guía de seguridad](../guia-codigo-seguridad.md): `middleware.ts`, `login/page.tsx`, `auth.ts`.
2. **El marco y las acciones** (este capítulo): el menú de arriba y todo lo que "hace cosas" (guardar, cancelar, crear usuarios…).
3. **Las pantallas** ([capítulo 6b](06b-panel-pantallas.md)): agenda, turnos, tratamientos, horarios, clientas, estadísticas, configuración, usuarios.

---

## Cómo funciona un botón del panel ("server action")

En el panel casi no hay código del navegador. Los botones son **formularios** que llaman a una **acción del servidor**. Un ejemplo simplificado (el real está en la Agenda, capítulo 6b):

```tsx
<form action={cambiarEstadoTurno}>                       // al enviar este formulario, corre cambiarEstadoTurno EN EL SERVIDOR
  <input type="hidden" name="id" value={t.id} />         // dato oculto: qué turno
  <input type="hidden" name="estado" value="COMPLETADO" />
                                                         // dato oculto: a qué estado pasarlo
  <button className="btn-sec">Realizado</button>         // el botón visible
</form>
```

La acción recibe los datos del formulario (`FormData`), hace el cambio en la base y refresca la pantalla.
**Cada acción empieza con `await requireAdmin()`**: aunque alguien sepa el nombre de la acción, sin sesión no puede usarla.

---

## `src/app/admin/(panel)/layout.tsx` — el marco del panel (menú de arriba)

```tsx
import type { Metadata } from "next";                    // Tipo de los datos de la página
import Image from "next/image";                          // Imágenes
import Link from "next/link";                            // Links
import { requireAdmin } from "@/lib/auth";               // "Exigí sesión"
import { salir } from "../acciones";                     // La acción del botón "Salir"

export const metadata: Metadata = { title: "Panel", robots: { index: false } };
                                                         // Título "Panel"; que Google no lo indexe nunca
export const dynamic = "force-dynamic";                  // Siempre se arma de nuevo (nunca una copia guardada)

const LINKS = [                                          // Los links del menú: [dirección, texto]
  ["/admin", "Agenda"],                                  //
  ["/admin/turnos", "Turnos"],                           //
  ["/admin/turnos/nuevo", "Nuevo turno"],                //
  ["/admin/servicios", "Tratamientos"],                  //
  ["/admin/horarios", "Horarios"],                       //
  ["/admin/clientas", "Clientas"],                       //
  ["/admin/estadisticas", "Estadísticas"],               //
  ["/admin/configuracion", "Configuración"],             //
  ["/admin/usuarios", "Usuarios"],                       //
];                                                       //

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
                                                         // El marco. "children" = la pantalla del panel que va adentro
  const sesion = await requireAdmin();                   // Exige sesión (si no hay, va al login) y trae los datos de quién entró
  return (                                               //
    <div className="admin">                              // Todo dentro de "admin" → tema claro (ver globals.css)
      <header className="bg-ink text-cream">             // Barra de arriba, negra
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
                                                         //   logo + "Panel", que llevan a la agenda
            <Image src="/logo.png" alt="" width={34} height={34} className="rounded-full" />
            <span className="font-serif text-lg text-gold-light">Panel</span>
          </Link>                                        //
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:w-auto sm:flex-1">
                                                         //   el menú. En el celular va en su propia fila y se desliza de costado (overflow-x-auto)
            {LINKS.map(([href, label]) => (              //   un link por cada elemento de LINKS:
              <Link key={href} href={href} className="shrink-0 rounded-md px-2.5 py-1.5 text-piedra hover:bg-humo hover:text-gold-light">
                {label}                                  //
              </Link>                                    //
            ))}                                          //
          </nav>                                         //
          <div className="ml-auto flex items-center gap-3 text-sm">
                                                         //   a la derecha:
            <Link href="/admin/cuenta" className="text-gold-light hover:underline" title="Mi cuenta">{sesion.nombre.split(" ")[0]}</Link>
                                                         //     el primer nombre de quien entró → lleva a "Mi cuenta"
            <Link href="/" target="_blank" className="text-piedra hover:text-gold-light">Ver web ↗</Link>
                                                         //     abre la web pública en otra pestaña
            <form action={salir}><button className="text-piedra hover:text-gold-light">Salir</button></form>
                                                         //     botón "Salir" (cierra la sesión: ver guía de seguridad)
          </div>                                         //
        </div>                                           //
      </header>                                          //
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
                                                         // La pantalla del panel
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/admin/acciones.ts` — todas las acciones del panel

Todo lo que el panel **modifica** pasa por este archivo.

```ts
"use server";                                            // Todo este archivo corre en el servidor

import { revalidatePath } from "next/cache";             // Para refrescar pantallas después de un cambio
import { redirect } from "next/navigation";              // Para mandar a otra página
import { z } from "zod";                                 // Para validar datos
import type { EstadoTurno, TipoSena } from "@prisma/client";
                                                         // Tipos de estado de turno y de seña
import { prisma } from "@/lib/db";                       // La base
import { USUARIO_MAESTRO, cerrarSesion, crearSesion, requireAdmin } from "@/lib/auth";
                                                         // Sesiones (guía de seguridad)
import { hashPassword, verificarPassword } from "@/lib/passwords";
                                                         // Contraseñas (guía de seguridad)
import { ErrorReserva, cancelarTurno, confirmarSena, crearReserva, reservaSchema } from "@/lib/turnos";
                                                         // Lógica de turnos (capítulo 4)
import { probarEnvio } from "@/lib/email";               // Mail de prueba
import { aFechaUTC } from "@/lib/tiempo";                // Fechas
import type { ResultadoReserva } from "@/app/actions/reservas";
                                                         // Tipo de respuesta de una reserva

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
                                                         // ATAJO: lee un campo de texto del formulario, sin espacios en las puntas (si no vino, "")
const num = (fd: FormData, k: string) => Math.max(0, Math.round(Number(fd.get(k) ?? 0)) || 0);
                                                         // ATAJO: lee un número entero, nunca negativo (si escribieron algo raro, 0)

function refrescar() {                                   // Refresca TODAS las pantallas (web y panel)…
  revalidatePath("/", "layout");                         // … para que un cambio (precio, horario) se vea en todos lados al instante
}                                                        //

export async function salir() {                          // BOTÓN "SALIR" (explicado en la guía de seguridad)
  await cerrarSesion();                                  //   borra la cookie de sesión
  revalidatePath("/admin", "layout");                    //   vacía la caché del panel
  redirect("/admin/login");                              //   va al login
}                                                        //

// ─── Turnos ───

export async function cambiarEstadoTurno(fd: FormData) { // Botones de la agenda: Seña recibida / Realizado / No vino / Cancelar / Deshacer
  await requireAdmin();                                  //   exige sesión
  const id = txt(fd, "id");                              //   qué turno
  const estado = txt(fd, "estado") as EstadoTurno | "SENA_RECIBIDA";
                                                         //   a qué estado (SENA_RECIBIDA es una acción especial, no un estado)
  const desde = txt(fd, "desde");                        //   desde qué semana estaba mirando la agenda (para volver ahí)
  let aviso = "";                                        //   mensaje para mostrar si algo no se pudo
  if (estado === "CANCELADO" || estado === "SENA_RECIBIDA") {
                                                         //   cancelar o confirmar seña: tienen reglas propias (capítulo 4)
    try {                                                //
      if (estado === "CANCELADO") await cancelarTurno(id, "admin");
                                                         //     cancela (y manda los mails)
      else await confirmarSena(id);                      //     confirma la seña (y manda el mail)
    } catch (err) {                                      //
      if (!(err instanceof ErrorReserva)) throw err;     //     si es un error técnico, lo deja pasar (aparece la pantalla de error del panel)
      aviso = err.message;                               //     si es esperado ("el horario ya está ocupado"), lo guarda para mostrarlo
    }                                                    //
  } else if (["COMPLETADO", "AUSENTE", "CONFIRMADO"].includes(estado)) {
                                                         //   los otros estados se cambian directo:
    await prisma.turno.update({ where: { id }, data: { estado } });
  }                                                      //   (cualquier otro valor se ignora: nadie puede inventar estados)
  refrescar();                                           //   refresca las pantallas
  if (aviso) {                                           //   si hubo aviso…
    const q = new URLSearchParams({ aviso, ...(desde ? { desde } : {}) });
                                                         //     arma "?aviso=…&desde=…"
    redirect(`/admin?${q}`);                             //     y vuelve a la agenda mostrándolo
  }                                                      //
}                                                        //

export async function reservarDesdePanel(input: unknown): Promise<ResultadoReserva> {
                                                         // "Nuevo turno" del panel (turnos que llegan por WhatsApp)
  await requireAdmin();                                  //   exige sesión
  const parsed = reservaSchema.safeParse(input);         //   valida con el mismo molde que la web
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {                                                  //
    await crearReserva(parsed.data, { porAdmin: true, sinSena: true });
                                                         //   crea la reserva: sin límites de anticipación y SIN seña (queda confirmada)
    refrescar();                                         //
    return { ok: true, url: `/admin?desde=${parsed.data.fecha}` };
                                                         //   después lleva a la agenda en esa semana
  } catch (err) {                                        //
    if (err instanceof ErrorReserva) return { ok: false, error: err.message };
                                                         //   error esperado → se muestra
    throw err;                                           //   técnico → pantalla de error del panel
  }                                                      //
}                                                        //

// ─── Servicios (tratamientos) ───

export async function guardarServicio(fd: FormData) {    // Botón "Guardar" de un tratamiento (nuevo o editado)
  await requireAdmin();                                  //
  const data = {                                         //   arma los datos desde el formulario:
    nombre: txt(fd, "nombre"),                           //
    descripcion: txt(fd, "descripcion"),                 //
    categoria: txt(fd, "categoria") || "Faciales",       //     (si no escribió categoría, "Faciales")
    duracionMin: Math.max(5, num(fd, "duracionMin")),    //     duración: mínimo 5 minutos
    precio: num(fd, "precio"),                           //
    orden: num(fd, "orden"),                             //
    activo: fd.get("activo") === "on",                   //     la casilla tildada llega como "on"
  };                                                     //
  if (!data.nombre) return;                              //   sin nombre, no guarda
  const id = txt(fd, "id");                              //   ¿tiene id? → es una edición
  if (id) await prisma.servicio.update({ where: { id }, data });
                                                         //   edición: actualiza
  else await prisma.servicio.create({ data });           //   nuevo: crea
  refrescar();                                           //
  redirect("/admin/servicios");                          //   vuelve a la lista
}                                                        //

export async function eliminarServicio(fd: FormData) {   // Botón "Eliminar" de un tratamiento
  await requireAdmin();                                  //
  const id = txt(fd, "id");                              //
  const usados = await prisma.turno.count({ where: { servicioId: id } });
                                                         //   ¿tiene turnos?
  if (usados) await prisma.servicio.update({ where: { id }, data: { activo: false } });
                                                         //   si tiene: solo lo OCULTA (para no perder el historial de esos turnos)
  else await prisma.servicio.delete({ where: { id } });  //   si no tiene: lo borra de verdad
  refrescar();                                           //
}                                                        //

// ─── Horarios y bloqueos ───

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
                                                         // Molde de una hora válida: 00:00 a 23:59

export async function agregarFranja(fd: FormData) {      // Botón "Agregar" franja de atención
  await requireAdmin();                                  //
  const diaSemana = Number(fd.get("diaSemana"));         //   el día (0 a 6)
  const ini = hora.safeParse(txt(fd, "horaInicio"));     //   valida la hora de inicio
  const fin = hora.safeParse(txt(fd, "horaFin"));        //   valida la hora de fin
  if (!ini.success || !fin.success || ini.data >= fin.data || diaSemana < 0 || diaSemana > 6) return;
                                                         //   si algo es inválido, o termina antes de empezar, no hace nada
  await prisma.horarioAtencion.create({ data: { diaSemana, horaInicio: ini.data, horaFin: fin.data } });
                                                         //   crea la franja
  refrescar();                                           //
}                                                        //

export async function eliminarFranja(fd: FormData) {     // Botón "×" de una franja
  await requireAdmin();                                  //
  await prisma.horarioAtencion.delete({ where: { id: txt(fd, "id") } });
                                                         //   la borra
  refrescar();                                           //
}                                                        //

export async function agregarBloqueo(fd: FormData) {     // Botón "Bloquear" (vacaciones, feriados)
  await requireAdmin();                                  //
  const desdeF = txt(fd, "desdeFecha");                  //   día de inicio
  const hastaF = txt(fd, "hastaFecha") || desdeF;        //   día de fin (si no puso, el mismo día)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desdeF) || !/^\d{4}-\d{2}-\d{2}$/.test(hastaF)) return;
                                                         //   si las fechas no tienen formato válido, no hace nada
  const desde = aFechaUTC(desdeF, txt(fd, "desdeHora") || "00:00");
                                                         //   desde: esa fecha y hora (si no puso hora, desde las 00:00)
  const hasta = aFechaUTC(hastaF, txt(fd, "hastaHora") || "23:59");
                                                         //   hasta: esa fecha y hora (si no puso hora, hasta las 23:59)
  if (hasta <= desde) return;                            //   si termina antes de empezar, no hace nada
  await prisma.bloqueo.create({ data: { desde, hasta, motivo: txt(fd, "motivo") } });
                                                         //   crea el bloqueo (esos horarios dejan de ofrecerse)
  refrescar();                                           //
}                                                        //

export async function eliminarBloqueo(fd: FormData) {    // Botón "Quitar" de un bloqueo
  await requireAdmin();                                  //
  await prisma.bloqueo.delete({ where: { id: txt(fd, "id") } });
  refrescar();                                           //
}                                                        //

// ─── Clientas ───

export async function guardarFicha(fd: FormData) {       // Botón "Guardar ficha" de una clienta
  await requireAdmin();                                  //
  const id = txt(fd, "id");                              //
  await prisma.clienta.update({                          //   actualiza la clienta con:
    where: { id },                                       //
    data: {                                              //
      nombre: txt(fd, "nombre"),                         //
      telefono: txt(fd, "telefono"),                     //
      tipoPiel: txt(fd, "tipoPiel"),                     //
      alergias: txt(fd, "alergias"),                     //
      notas: txt(fd, "notas"),                           //
    },                                                   //   (el email no se cambia: es lo que identifica a la clienta)
  });                                                    //
  revalidatePath(`/admin/clientas/${id}`);               //   refresca solo su ficha
}                                                        //

// ─── Configuración ───

export async function guardarConfiguracion(fd: FormData) {
                                                         // Botón "Guardar cambios" de Configuración
  await requireAdmin();                                  //
  const senaTipo = (["NINGUNA", "PORCENTAJE", "FIJO"].includes(txt(fd, "senaTipo")) ? txt(fd, "senaTipo") : "NINGUNA") as TipoSena;
                                                         //   tipo de seña: solo acepta los 3 valores válidos (si llega otra cosa, "NINGUNA")
  const data = {                                         //   todos los datos, cada uno con su control:
    nombreNegocio: txt(fd, "nombreNegocio") || "MC Healthy Skin",
                                                         //     si lo deja vacío, vuelve al nombre por defecto
    nombreProfesional: txt(fd, "nombreProfesional"),     //
    emailProfesional: txt(fd, "emailProfesional"),       //
    whatsapp: txt(fd, "whatsapp"),                       //
    instagram: txt(fd, "instagram"),                     //
    direccion: txt(fd, "direccion"),                     //
    sobreMi: txt(fd, "sobreMi"),                         //
    videoUrl: txt(fd, "videoUrl"),                       //
    senaTipo,                                            //
    senaValor: senaTipo === "PORCENTAJE" ? Math.min(100, num(fd, "senaValor")) : num(fd, "senaValor"),
                                                         //     si es porcentaje, nunca más de 100
    intervaloMin: Math.max(5, num(fd, "intervaloMin")),  //     intervalo: mínimo 5 minutos
    anticipacionMinHoras: num(fd, "anticipacionMinHoras"),
    diasMaxReserva: Math.max(1, num(fd, "diasMaxReserva")),
                                                         //     al menos 1 día
    cbu: txt(fd, "cbu").replace(/\s+/g, ""),             //     el CBU sin espacios
    alias: txt(fd, "alias"),                             //
    titularCuenta: txt(fd, "titularCuenta"),             //
    banco: txt(fd, "banco"),                             //
    horasParaSena: Math.min(168, Math.max(1, num(fd, "horasParaSena"))),
                                                         //     entre 1 hora y 168 (una semana)
    horasParaCancelar: num(fd, "horasParaCancelar"),     //
    politicaCancelacion: txt(fd, "politicaCancelacion"), //
  };                                                     //
  await prisma.configuracion.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
                                                         //   guarda en la fila 1 (o la crea si no existiera)
  refrescar();                                           //
  redirect("/admin/configuracion?ok=1");                 //   vuelve mostrando "Cambios guardados ✓"
}                                                        //

// ─── Usuarios del panel ───

const usuarioSchema = z.object({                         // Molde de un usuario nuevo:
  nombre: z.string().trim().min(2, "Ingresá el nombre").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido").max(120)
    .refine((e) => e !== USUARIO_MAESTRO, "Ese usuario está reservado"),
                                                         //   el email no puede ser "admin" (está reservado para el acceso de emergencia)
  password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres").max(200),
});                                                      //

function volverUsuarios(q: Record<string, string>): never {
                                                         // Atajo: vuelve a la pantalla Usuarios con un mensaje (?ok=… o ?error=…). "never" = esta función nunca termina normalmente (siempre redirige)
  redirect(`/admin/usuarios?${new URLSearchParams(q)}`); //
}                                                        //

export async function crearAdministrador(fd: FormData) { // Botón "Crear usuario"
  await requireAdmin();                                  //
  const r = usuarioSchema.safeParse({ nombre: txt(fd, "nombre"), email: txt(fd, "email"), password: String(fd.get("password") ?? "") });
                                                         //   valida los datos con el molde
  if (!r.success) volverUsuarios({ error: r.error.issues[0]?.message ?? "Datos inválidos" });
                                                         //   si algo está mal, vuelve con el error
  const existe = await prisma.administrador.findUnique({ where: { email: r.data.email } });
                                                         //   ¿ya hay alguien con ese email?
  if (existe) volverUsuarios({ error: "Ya existe un usuario con ese email" });
  await prisma.administrador.create({                    //   crea el usuario…
    data: { nombre: r.data.nombre, email: r.data.email, passwordHash: await hashPassword(r.data.password) },
                                                         //   … con la contraseña PICADA (nunca la real)
  });                                                    //
  volverUsuarios({ ok: `Usuario creado: ${r.data.email}` });
}                                                        //

export async function cambiarActivoAdministrador(fd: FormData) {
                                                         // Botón "Desactivar" / "Activar"
  const yo = await requireAdmin();                       //   exige sesión y sabe quién soy
  const id = txt(fd, "id");                              //
  if (id === yo.id) volverUsuarios({ error: "No podés desactivar tu propio usuario" });
                                                         //   no se puede desactivar a uno mismo (quedaría afuera)
  const admin = await prisma.administrador.findUnique({ where: { id } });
  if (!admin) volverUsuarios({ error: "Usuario no encontrado" });
  await prisma.administrador.update({                    //   cambia activo ↔ inactivo…
    where: { id },                                       //
    data: { activo: !admin.activo, version: { increment: 1 } },
                                                         //   … y SUBE LA VERSIÓN: así sus sesiones abiertas dejan de valer al instante
  });                                                    //
  volverUsuarios({ ok: `${admin.nombre}: ${admin.activo ? "desactivado" : "activado"}` });
}                                                        //

export async function resetearPasswordAdministrador(fd: FormData) {
                                                         // Botón "Cambiar" contraseña de otro usuario
  const yo = await requireAdmin();                       //
  const id = txt(fd, "id");                              //
  const password = String(fd.get("password") ?? "");     //
  if (password.length < 8) volverUsuarios({ error: "La contraseña tiene que tener al menos 8 caracteres" });
  const admin = await prisma.administrador.update({      //   guarda la nueva contraseña (picada) y sube la versión (cierra sus sesiones)
    where: { id },                                       //
    data: { passwordHash: await hashPassword(password), version: { increment: 1 } },
  });                                                    //
  if (admin.id === yo.id) await crearSesion({ sub: admin.id, v: admin.version });
                                                         //   si me la cambié a mí mismo, me crea una sesión nueva (para no quedar afuera)
  volverUsuarios({ ok: `Contraseña actualizada para ${admin.nombre}` });
}                                                        //

export async function cambiarMiPassword(fd: FormData) {  // "Mi cuenta" → cambiar mi contraseña
  const yo = await requireAdmin();                       //
  const volver = (q: Record<string, string>): never => redirect(`/admin/cuenta?${new URLSearchParams(q)}`);
                                                         //   atajo para volver a "Mi cuenta" con un mensaje
  if (yo.maestro) volver({ error: "La contraseña del usuario admin se cambia en Vercel (ADMIN_PASSWORD)" });
                                                         //   el usuario de emergencia no tiene contraseña en la base
  const actual = String(fd.get("actual") ?? "");         //   contraseña actual
  const nueva = String(fd.get("nueva") ?? "");           //   contraseña nueva
  if (nueva.length < 8) volver({ error: "La contraseña nueva tiene que tener al menos 8 caracteres" });
  if (nueva !== String(fd.get("repetir") ?? "")) volver({ error: "Las contraseñas nuevas no coinciden" });
                                                         //   tiene que escribirla dos veces igual
  const admin = await prisma.administrador.findUniqueOrThrow({ where: { id: yo.id } });
  if (!(await verificarPassword(actual, admin.passwordHash))) volver({ error: "La contraseña actual no es correcta" });
                                                         //   exige la contraseña actual (por si alguien dejó la compu abierta)
  const act = await prisma.administrador.update({        //   guarda la nueva y sube la versión
    where: { id: yo.id },                                //
    data: { passwordHash: await hashPassword(nueva), version: { increment: 1 } },
  });                                                    //
  await crearSesion({ sub: act.id, v: act.version });    //   nueva sesión para ESTE dispositivo (los demás quedan cerrados)
  volver({ ok: "Contraseña cambiada" });                 //
}                                                        //

export async function enviarMailPrueba(fd: FormData) {   // Botón "Enviar mail de prueba"
  await requireAdmin();                                  //
  const para = txt(fd, "para");                          //   a quién
  const r = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)      //   si parece un email (algo@algo.algo)…
    ? await probarEnvio(para)                            //     manda la prueba (capítulo 4)
    : { ok: false, mensaje: "Escribí un email válido para la prueba" };
                                                         //   si no, error
  redirect(`/admin/configuracion?${new URLSearchParams({ [r.ok ? "mailok" : "mailerror"]: r.mensaje })}#mails`);
                                                         //   vuelve a Configuración con ?mailok=… o ?mailerror=…, bajando a la sección de mails
}                                                        // Fin
```
