import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MINUTOS_VALIDEZ, pedirRecuperacion } from "@/lib/recuperar-clave";

export const metadata: Metadata = { title: "Olvidé mi contraseña", robots: { index: false } };
export const dynamic = "force-dynamic";

async function pedir(formData: FormData) {
  "use server";
  // Misma demora exista o no el email, para no dar pistas
  await Promise.all([pedirRecuperacion(String(formData.get("email") ?? "")), new Promise((r) => setTimeout(r, 800))]);
  redirect("/admin/login/olvide?enviado=1");
}

export default async function Olvide({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const { enviado } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-linea bg-carbon p-8 text-center">
        <Image src="/logo.png" alt="" width={88} height={88} className="mx-auto rounded-full" />
        <h1 className="mt-5 font-serif text-3xl text-gold-light">Olvidé mi contraseña</h1>
        {enviado ? (
          <div role="status" className="mt-5 space-y-3 text-sm text-piedra">
            <p className="text-cream">Si ese email es de un usuario del panel, te mandamos un link para elegir una contraseña nueva.</p>
            <p>Vence en {MINUTOS_VALIDEZ} minutos. Si no lo ves, fijate en <strong>Spam</strong>.</p>
          </div>
        ) : (
          <form action={pedir}>
            <p className="mt-1 text-sm text-piedra">Escribí el email con el que entrás al panel y te mandamos un link para elegir una nueva.</p>
            <label htmlFor="email" className="sr-only">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" required autoFocus
              placeholder="Tu email" className="campo mt-6 text-left" />
            <button className="btn-oro mt-6 w-full">Mandarme el link</button>
          </form>
        )}
        <p className="mt-6 text-xs text-piedra">
          ¿Usás el usuario <strong>admin</strong>? Su contraseña es la variable ADMIN_PASSWORD de Vercel.
        </p>
        <Link href="/admin/login" className="mt-4 inline-block text-sm text-piedra underline underline-offset-4 hover:text-gold-light">Volver a ingresar</Link>
      </div>
    </div>
  );
}
