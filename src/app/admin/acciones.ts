"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoTurno, TipoSena } from "@prisma/client";
import { prisma } from "@/lib/db";
import { USUARIO_MAESTRO, cerrarSesion, crearSesion, requireAdmin } from "@/lib/auth";
import { hashPassword, verificarPassword } from "@/lib/passwords";
import { ErrorReserva, cancelarTurno, crearReserva, reservaSchema } from "@/lib/turnos";
import { aFechaUTC } from "@/lib/tiempo";
import type { ResultadoReserva } from "@/app/actions/reservas";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Math.max(0, Math.round(Number(fd.get(k) ?? 0)) || 0);

function refrescar() {
  revalidatePath("/", "layout");
}

export async function salir() {
  await cerrarSesion();
  redirect("/admin/login");
}

// ─── Turnos ────────────────────────────────────────────────

export async function cambiarEstadoTurno(fd: FormData) {
  await requireAdmin();
  const id = txt(fd, "id");
  const estado = txt(fd, "estado") as EstadoTurno;
  const desde = txt(fd, "desde");
  let aviso = "";
  if (estado === "CANCELADO") {
    try {
      await cancelarTurno(id, "admin");
    } catch (err) {
      if (!(err instanceof ErrorReserva)) throw err;
      aviso = err.message;
    }
  } else if (["COMPLETADO", "AUSENTE", "CONFIRMADO"].includes(estado)) {
    await prisma.turno.update({ where: { id }, data: { estado } });
  }
  refrescar();
  if (aviso) {
    const q = new URLSearchParams({ aviso, ...(desde ? { desde } : {}) });
    redirect(`/admin?${q}`);
  }
}

export async function reservarDesdePanel(input: unknown): Promise<ResultadoReserva> {
  await requireAdmin();
  const parsed = reservaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await crearReserva(parsed.data, { porAdmin: true, sinSena: true });
    refrescar();
    return { ok: true, url: `/admin?desde=${parsed.data.fecha}` };
  } catch (err) {
    if (err instanceof ErrorReserva) return { ok: false, error: err.message };
    throw err;
  }
}

// ─── Servicios ─────────────────────────────────────────────

export async function guardarServicio(fd: FormData) {
  await requireAdmin();
  const data = {
    nombre: txt(fd, "nombre"),
    descripcion: txt(fd, "descripcion"),
    categoria: txt(fd, "categoria") || "Faciales",
    duracionMin: Math.max(5, num(fd, "duracionMin")),
    precio: num(fd, "precio"),
    orden: num(fd, "orden"),
    activo: fd.get("activo") === "on",
  };
  if (!data.nombre) return;
  const id = txt(fd, "id");
  if (id) await prisma.servicio.update({ where: { id }, data });
  else await prisma.servicio.create({ data });
  refrescar();
  redirect("/admin/servicios");
}

export async function eliminarServicio(fd: FormData) {
  await requireAdmin();
  const id = txt(fd, "id");
  const usados = await prisma.turno.count({ where: { servicioId: id } });
  // Si ya tiene turnos lo desactivamos para no perder el historial
  if (usados) await prisma.servicio.update({ where: { id }, data: { activo: false } });
  else await prisma.servicio.delete({ where: { id } });
  refrescar();
}

// ─── Horarios y bloqueos ───────────────────────────────────

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export async function agregarFranja(fd: FormData) {
  await requireAdmin();
  const diaSemana = Number(fd.get("diaSemana"));
  const ini = hora.safeParse(txt(fd, "horaInicio"));
  const fin = hora.safeParse(txt(fd, "horaFin"));
  if (!ini.success || !fin.success || ini.data >= fin.data || diaSemana < 0 || diaSemana > 6) return;
  await prisma.horarioAtencion.create({ data: { diaSemana, horaInicio: ini.data, horaFin: fin.data } });
  refrescar();
}

export async function eliminarFranja(fd: FormData) {
  await requireAdmin();
  await prisma.horarioAtencion.delete({ where: { id: txt(fd, "id") } });
  refrescar();
}

export async function agregarBloqueo(fd: FormData) {
  await requireAdmin();
  const desdeF = txt(fd, "desdeFecha");
  const hastaF = txt(fd, "hastaFecha") || desdeF;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desdeF) || !/^\d{4}-\d{2}-\d{2}$/.test(hastaF)) return;
  const desde = aFechaUTC(desdeF, txt(fd, "desdeHora") || "00:00");
  const hasta = aFechaUTC(hastaF, txt(fd, "hastaHora") || "23:59");
  if (hasta <= desde) return;
  await prisma.bloqueo.create({ data: { desde, hasta, motivo: txt(fd, "motivo") } });
  refrescar();
}

export async function eliminarBloqueo(fd: FormData) {
  await requireAdmin();
  await prisma.bloqueo.delete({ where: { id: txt(fd, "id") } });
  refrescar();
}

// ─── Clientas ──────────────────────────────────────────────

export async function guardarFicha(fd: FormData) {
  await requireAdmin();
  const id = txt(fd, "id");
  await prisma.clienta.update({
    where: { id },
    data: {
      nombre: txt(fd, "nombre"),
      telefono: txt(fd, "telefono"),
      tipoPiel: txt(fd, "tipoPiel"),
      alergias: txt(fd, "alergias"),
      notas: txt(fd, "notas"),
    },
  });
  revalidatePath(`/admin/clientas/${id}`);
}

// ─── Configuración ─────────────────────────────────────────

export async function guardarConfiguracion(fd: FormData) {
  await requireAdmin();
  const senaTipo = (["NINGUNA", "PORCENTAJE", "FIJO"].includes(txt(fd, "senaTipo")) ? txt(fd, "senaTipo") : "NINGUNA") as TipoSena;
  const data = {
    nombreNegocio: txt(fd, "nombreNegocio") || "MC Healthy Skin",
    nombreProfesional: txt(fd, "nombreProfesional"),
    emailProfesional: txt(fd, "emailProfesional"),
    whatsapp: txt(fd, "whatsapp"),
    instagram: txt(fd, "instagram"),
    direccion: txt(fd, "direccion"),
    sobreMi: txt(fd, "sobreMi"),
    videoUrl: txt(fd, "videoUrl"),
    senaTipo,
    senaValor: senaTipo === "PORCENTAJE" ? Math.min(100, num(fd, "senaValor")) : num(fd, "senaValor"),
    intervaloMin: Math.max(5, num(fd, "intervaloMin")),
    anticipacionMinHoras: num(fd, "anticipacionMinHoras"),
    diasMaxReserva: Math.max(1, num(fd, "diasMaxReserva")),
    minutosParaPagar: Math.max(10, num(fd, "minutosParaPagar")),
    horasParaCancelar: num(fd, "horasParaCancelar"),
    politicaCancelacion: txt(fd, "politicaCancelacion"),
  };
  await prisma.configuracion.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  refrescar();
  redirect("/admin/configuracion?ok=1");
}

// ─── Usuarios del panel ────────────────────────────────────

const usuarioSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresá el nombre").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido").max(120)
    .refine((e) => e !== USUARIO_MAESTRO, "Ese usuario está reservado"),
  password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres").max(200),
});

function volverUsuarios(q: Record<string, string>): never {
  redirect(`/admin/usuarios?${new URLSearchParams(q)}`);
}

export async function crearAdministrador(fd: FormData) {
  await requireAdmin();
  const r = usuarioSchema.safeParse({ nombre: txt(fd, "nombre"), email: txt(fd, "email"), password: String(fd.get("password") ?? "") });
  if (!r.success) volverUsuarios({ error: r.error.issues[0]?.message ?? "Datos inválidos" });
  const existe = await prisma.administrador.findUnique({ where: { email: r.data.email } });
  if (existe) volverUsuarios({ error: "Ya existe un usuario con ese email" });
  await prisma.administrador.create({
    data: { nombre: r.data.nombre, email: r.data.email, passwordHash: await hashPassword(r.data.password) },
  });
  volverUsuarios({ ok: `Usuario creado: ${r.data.email}` });
}

export async function cambiarActivoAdministrador(fd: FormData) {
  const yo = await requireAdmin();
  const id = txt(fd, "id");
  if (id === yo.id) volverUsuarios({ error: "No podés desactivar tu propio usuario" });
  const admin = await prisma.administrador.findUnique({ where: { id } });
  if (!admin) volverUsuarios({ error: "Usuario no encontrado" });
  // Al desactivar subimos la versión para cerrar sus sesiones abiertas
  await prisma.administrador.update({
    where: { id },
    data: { activo: !admin.activo, version: { increment: 1 } },
  });
  volverUsuarios({ ok: `${admin.nombre}: ${admin.activo ? "desactivado" : "activado"}` });
}

export async function resetearPasswordAdministrador(fd: FormData) {
  const yo = await requireAdmin();
  const id = txt(fd, "id");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) volverUsuarios({ error: "La contraseña tiene que tener al menos 8 caracteres" });
  const admin = await prisma.administrador.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), version: { increment: 1 } },
  });
  if (admin.id === yo.id) await crearSesion({ sub: admin.id, v: admin.version });
  volverUsuarios({ ok: `Contraseña actualizada para ${admin.nombre}` });
}

export async function cambiarMiPassword(fd: FormData) {
  const yo = await requireAdmin();
  const volver = (q: Record<string, string>): never => redirect(`/admin/cuenta?${new URLSearchParams(q)}`);
  if (yo.maestro) volver({ error: "La contraseña del usuario admin se cambia en Vercel (ADMIN_PASSWORD)" });
  const actual = String(fd.get("actual") ?? "");
  const nueva = String(fd.get("nueva") ?? "");
  if (nueva.length < 8) volver({ error: "La contraseña nueva tiene que tener al menos 8 caracteres" });
  if (nueva !== String(fd.get("repetir") ?? "")) volver({ error: "Las contraseñas nuevas no coinciden" });
  const admin = await prisma.administrador.findUniqueOrThrow({ where: { id: yo.id } });
  if (!(await verificarPassword(actual, admin.passwordHash))) volver({ error: "La contraseña actual no es correcta" });
  const act = await prisma.administrador.update({
    where: { id: yo.id },
    data: { passwordHash: await hashPassword(nueva), version: { increment: 1 } },
  });
  // Cierra las otras sesiones y deja ésta abierta
  await crearSesion({ sub: act.id, v: act.version });
  volver({ ok: "Contraseña cambiada" });
}
