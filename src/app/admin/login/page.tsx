import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { crearSesion, passwordCorrecta } from "@/lib/auth";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

async function ingresar(formData: FormData) {
  "use server";
  // Pequeña demora para desalentar ataques de fuerza bruta
  await new Promise((r) => setTimeout(r, 600));
  if (!passwordCorrecta(String(formData.get("password") ?? ""))) redirect("/admin/login?error=1");
  await crearSesion();
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form action={ingresar} className="w-full max-w-sm rounded-2xl border border-linea bg-carbon p-8 text-center">
        <Image src="/logo.png" alt="" width={88} height={88} className="mx-auto rounded-full" />
        <h1 className="mt-5 font-serif text-3xl text-gold-light">Panel</h1>
        <input type="password" name="password" placeholder="Contraseña" required autoFocus className="campo mt-6" />
        {error && <p className="mt-3 text-sm text-red-400">Contraseña incorrecta</p>}
        <button className="btn-oro mt-6 w-full">Ingresar</button>
      </form>
    </div>
  );
}
