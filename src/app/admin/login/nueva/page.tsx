import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { crearSesion } from "@/lib/auth";
import { ErrorRecuperacion, linkValido, restablecerClave } from "@/lib/recuperar-clave";

export const metadata: Metadata = { title: "Contraseña nueva", robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

async function guardar(formData: FormData) {
  "use server";
  const token = String(formData.get("t") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const volver = (error: string): never => redirect(`/admin/login/nueva?${new URLSearchParams({ t: token, error })}`);
  if (nueva !== String(formData.get("repetir") ?? "")) volver("Las contraseñas no coinciden");
  let sesion: { sub: string; v: number } | null = null;
  try {
    sesion = await restablecerClave(token, nueva);
  } catch (err) {
    if (!(err instanceof ErrorRecuperacion)) throw err;
    volver(err.message);
  }
  await crearSesion(sesion!);
  redirect("/admin?clave=nueva");
}

export default async function Nueva({ searchParams }: { searchParams: Promise<{ t?: string; error?: string }> }) {
  const { t = "", error } = await searchParams;
  const valido = await linkValido(t);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-linea bg-carbon p-8 text-center">
        <Image src="/logo.png" alt="" width={88} height={88} className="mx-auto rounded-full" />
        <h1 className="mt-5 font-serif text-3xl text-gold-light">Contraseña nueva</h1>
        {valido ? (
          <form action={guardar} className="text-left">
            <input type="hidden" name="t" value={t} />
            <p className="mt-1 text-center text-sm text-piedra">Elegí una contraseña de al menos 8 caracteres.</p>
            <label htmlFor="nueva" className="sr-only">Contraseña nueva</label>
            <input id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={8} required autoFocus
              placeholder="Contraseña nueva" className="campo mt-6" />
            <label htmlFor="repetir" className="sr-only">Repetir contraseña</label>
            <input id="repetir" name="repetir" type="password" autoComplete="new-password" minLength={8} required
              placeholder="Repetila" className="campo mt-3" />
            {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
            <button className="btn-oro mt-6 w-full">Guardar y entrar</button>
          </form>
        ) : (
          <div className="mt-4 space-y-5">
            <p role="alert" className="text-sm text-piedra">{error ?? "Este link venció o ya se usó."} Los links sirven una sola vez y duran 1 hora.</p>
            <Link href="/admin/login/olvide" className="btn-oro w-full">Pedir un link nuevo</Link>
          </div>
        )}
      </div>
    </div>
  );
}
