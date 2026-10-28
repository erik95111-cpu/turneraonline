import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { crearSesion, getSesion, verificarCredenciales } from "@/lib/auth";
import { limpiarFallos, loginBloqueado, registrarFallo } from "@/lib/limite-login";
import { logError } from "@/lib/log";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Mensaje que ve la persona según el motivo del rechazo (?error=…) */
const ERRORES: Record<string, string> = {
  "1": "Email o contraseña incorrectos",
  bloqueado: "Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.",
  servidor: "No pudimos conectar con el servidor. Probá de nuevo en un rato.",
};

/** Revisa que estén las variables necesarias para entrar al panel */
async function problemasDeConfiguracion(): Promise<string[]> {
  const problemas: string[] = [];
  const secreto = process.env.AUTH_SECRET ?? "";
  if (secreto.length < 16) {
    problemas.push("Falta la variable AUTH_SECRET en Vercel (o tiene menos de 16 caracteres).");
  }
  // trim: una variable con sólo espacios cuenta como vacía (así lo trata también el login)
  if (!process.env.ADMIN_PASSWORD?.trim()) {
    const usuarios = await prisma.administrador.count().catch(() => 0);
    if (usuarios === 0) problemas.push("Falta la variable ADMIN_PASSWORD en Vercel y todavía no hay usuarios creados.");
  }
  return problemas;
}

/** IP de quien intenta entrar (Vercel la manda en x-forwarded-for) */
async function ipCliente(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
}

/**
 * Se ejecuta en el SERVIDOR al tocar "Ingresar". La contraseña nunca se
 * guarda ni se compara en el navegador.
 */
async function ingresar(formData: FormData) {
  "use server";
  // Pequeña demora para desalentar ataques de fuerza bruta
  await new Promise((r) => setTimeout(r, 600));
  if ((await problemasDeConfiguracion()).length) redirect("/admin/login");

  const usuario = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const ip = await ipCliente();

  // El redirect va AFUERA del try: Next.js implementa redirect() tirando un
  // error especial, y un catch lo "tragaría".
  let destino: string;
  try {
    if (await loginBloqueado(ip, usuario)) {
      destino = "/admin/login?error=bloqueado";
    } else {
      const datos = await verificarCredenciales(usuario, password);
      if (!datos) {
        await registrarFallo(ip, usuario);
        destino = "/admin/login?error=1";
      } else {
        await limpiarFallos(ip, usuario);
        await crearSesion(datos);
        destino = "/admin";
      }
    }
  } catch (err) {
    // Fallback: base caída, etc. Mostramos un mensaje claro en vez de la pantalla de error
    logError("login", err);
    destino = "/admin/login?error=servidor";
  }
  redirect(destino);
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, problemas, sesion] = await Promise.all([searchParams, problemasDeConfiguracion(), getSesion()]);
  // Si ya tiene la sesión abierta, no tiene sentido mostrarle el formulario
  if (sesion) redirect("/admin");
  const textoError = error ? (ERRORES[error] ?? ERRORES["1"]) : null;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form action={ingresar} className="w-full max-w-sm rounded-2xl border border-linea bg-carbon p-8 text-center">
        <Image src="/logo.png" alt="" width={88} height={88} className="mx-auto rounded-full" />
        <h1 className="mt-5 font-serif text-3xl text-gold-light">Panel</h1>
        <p className="mt-1 text-sm text-piedra">Ingresá con tu email y contraseña</p>
        {problemas.length > 0 && (
          <div role="alert" className="mt-5 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-left text-sm text-amber-200">
            <p className="font-semibold">El panel todavía no está configurado:</p>
            <ul className="mt-1 list-disc pl-5">{problemas.map((p) => <li key={p}>{p}</li>)}</ul>
            <p className="mt-2 text-xs">Se cargan en Vercel → Settings → Environment Variables, y después hay que hacer Redeploy.</p>
          </div>
        )}
        <label htmlFor="email" className="sr-only">Email</label>
        <input id="email" name="email" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off"
          spellCheck={false} placeholder="Email (o admin)" required autoFocus className="campo mt-6 text-left" />
        <label htmlFor="password" className="sr-only">Contraseña</label>
        <input id="password" type="password" name="password" autoComplete="current-password" placeholder="Contraseña" required className="campo mt-3 text-left" />
        {textoError && <p role="alert" className="mt-3 text-sm text-red-400">{textoError}</p>}
        <button className="btn-oro mt-6 w-full">Ingresar</button>
      </form>
    </div>
  );
}
