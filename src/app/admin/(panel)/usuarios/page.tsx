import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fechaHoraLarga } from "@/lib/tiempo";
import { cambiarActivoAdministrador, crearAdministrador, resetearPasswordAdministrador } from "../../acciones";

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [yo, sp, admins] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.administrador.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Usuarios del panel</h1>
        <p className="text-sm text-[#6b635b]">Las personas que pueden entrar al panel con su email y contraseña.</p>
      </div>
      {sp.ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.ok}</p>}
      {sp.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>}

      <ul className="card divide-y divide-[#f0ebe3]">
        {admins.length === 0 && (
          <li className="p-4 text-sm text-[#8b8279]">Todavía no hay usuarios. Creá el primero abajo (por ejemplo, para la profesional).</li>
        )}
        {admins.map((a) => (
          <li key={a.id} className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 ${a.activo ? "" : "opacity-60"}`}>
            <div className="min-w-48 flex-1">
              <p className="font-medium">
                {a.nombre} {a.id === yo.id && <span className="text-xs text-[#8a6d3b]">(vos)</span>}
                {!a.activo && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">Desactivado</span>}
              </p>
              <p className="text-sm text-[#6b635b]">{a.email}</p>
              <p className="text-xs text-[#8b8279] first-letter:uppercase">
                {a.ultimoIngreso ? `Último ingreso: ${fechaHoraLarga(a.ultimoIngreso)}` : "Todavía no ingresó"}
              </p>
            </div>
            <form action={resetearPasswordAdministrador} className="flex gap-2">
              <input type="hidden" name="id" value={a.id} />
              <label className="sr-only" htmlFor={`pw-${a.id}`}>Nueva contraseña para {a.nombre}</label>
              <input id={`pw-${a.id}`} name="password" type="password" minLength={8} required placeholder="Nueva contraseña" autoComplete="new-password" className="input !w-40 !py-1.5" />
              <button className="btn-sec">Cambiar</button>
            </form>
            {a.id !== yo.id && (
              <form action={cambiarActivoAdministrador}>
                <input type="hidden" name="id" value={a.id} />
                <button className="btn-sec">{a.activo ? "Desactivar" : "Activar"}</button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <form action={crearAdministrador} className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Nuevo usuario</h2>
        <div><label className="lbl" htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" required className="input" placeholder="María C." /></div>
        <div><label className="lbl" htmlFor="email">Email (con esto ingresa)</label><input id="email" name="email" type="email" required autoComplete="off" className="input" /></div>
        <div className="sm:col-span-2">
          <label className="lbl" htmlFor="password">Contraseña (mínimo 8 caracteres)</label>
          <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
          <p className="mt-1 text-xs text-[#8b8279]">Pasásela en persona o por WhatsApp. Después puede cambiarla desde "Mi cuenta".</p>
        </div>
        <div className="sm:col-span-2"><button className="btn">Crear usuario</button></div>
      </form>

      <p className="text-xs text-[#8b8279]">
        Acceso de emergencia: usuario <code>admin</code> con la contraseña <code>ADMIN_PASSWORD</code> configurada en Vercel.
      </p>
    </div>
  );
}
