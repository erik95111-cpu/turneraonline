import { requireAdmin } from "@/lib/auth";
import { cambiarMiPassword } from "../../acciones";

export default async function MiCuenta({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [yo, sp] = await Promise.all([requireAdmin(), searchParams]);
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Mi cuenta</h1>
        <p className="text-sm text-[#6b635b]">{yo.nombre} · {yo.email}</p>
      </div>
      {sp.ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.ok}</p>}
      {sp.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>}
      {yo.maestro ? (
        <p className="card p-5 text-sm text-[#6b635b]">
          Entraste con el acceso de emergencia (<code>admin</code>). Su contraseña es <code>ADMIN_PASSWORD</code> y se cambia en Vercel → Settings → Environment Variables.
          Para un acceso propio, creá un usuario en <a className="underline" href="/admin/usuarios">Usuarios</a>.
        </p>
      ) : (
        <form action={cambiarMiPassword} className="card grid gap-4 p-5">
          <h2 className="font-semibold">Cambiar contraseña</h2>
          <div><label className="lbl" htmlFor="actual">Contraseña actual</label><input id="actual" name="actual" type="password" required autoComplete="current-password" className="input" /></div>
          <div><label className="lbl" htmlFor="nueva">Contraseña nueva (mínimo 8)</label><input id="nueva" name="nueva" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
          <div><label className="lbl" htmlFor="repetir">Repetir contraseña nueva</label><input id="repetir" name="repetir" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
          <p className="text-xs text-[#8b8279]">Al cambiarla se cierra la sesión en tus otros dispositivos.</p>
          <button className="btn justify-self-start">Guardar</button>
        </form>
      )}
    </div>
  );
}
