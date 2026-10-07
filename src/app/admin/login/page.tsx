import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { crearSesion, verificarCredenciales } from "@/lib/auth";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

async function ingresar(formData: FormData) {
  "use server";
  // Pequeña demora para desalentar ataques de fuerza bruta
  await new Promise((r) => setTimeout(r, 600));
  const datos = await verificarCredenciales(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!datos) redirect("/admin/login?error=1");
  await crearSesion(datos);
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form action={ingresar} className="w-full max-w-sm rounded-2xl border border-linea bg-carbon p-8 text-center">
        <Image src="/logo.png" alt="" width={88} height={88} className="mx-auto rounded-full" />
        <h1 className="mt-5 font-serif text-3xl text-gold-light">Panel</h1>
        <p className="mt-1 text-sm text-piedra">Ingresá con tu email y contraseña</p>
        <label htmlFor="email" className="sr-only">Email</label>
        <input id="email" name="email" type="text" inputMode="email" autoComplete="username" autoCapitalize="none"
          placeholder="Email" required autoFocus className="campo mt-6 text-left" />
        <label htmlFor="password" className="sr-only">Contraseña</label>
        <input id="password" type="password" name="password" autoComplete="current-password" placeholder="Contraseña" required className="campo mt-3 text-left" />
        {error && <p role="alert" className="mt-3 text-sm text-red-400">Email o contraseña incorrectos</p>}
        <button className="btn-oro mt-6 w-full">Ingresar</button>
      </form>
    </div>
  );
}
