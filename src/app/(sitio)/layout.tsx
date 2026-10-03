import Image from "next/image";
import Link from "next/link";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { linkInstagram, linkWhatsapp, resumenHorarios } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function SitioLayout({ children }: { children: React.ReactNode }) {
  const [cfg, franjas] = await Promise.all([getConfig(), prisma.horarioAtencion.findMany()]);
  const horarios = resumenHorarios(franjas);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-linea/60 bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="" width={40} height={40} className="rounded-full" priority />
            <span className="font-serif text-xl tracking-wide text-gold-light">Healthy Skin</span>
          </Link>
          <nav className="hidden items-center gap-8 text-xs tracking-[0.2em] uppercase text-piedra md:flex">
            <Link href="/#tratamientos" className="hover:text-gold-light">Tratamientos</Link>
            <Link href="/#como-funciona" className="hover:text-gold-light">Cómo funciona</Link>
            {cfg.videoUrl && <Link href="/#presentacion" className="hover:text-gold-light">Presentación</Link>}
            <Link href="/#contacto" className="hover:text-gold-light">Contacto</Link>
          </nav>
          <Link href="/reservar" className="btn-oro !px-5 !py-2.5 !text-[0.7rem]">Reservar</Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer id="contacto" className="border-t border-linea bg-carbon">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="MC Healthy Skin" width={72} height={72} className="rounded-full" />
            <div>
              <p className="font-serif text-2xl text-gold-light">{cfg.nombreNegocio}</p>
              <p className="eyebrow !text-[0.6rem] mt-1">Dermatocosmiatría</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-piedra">
            <p className="eyebrow mb-3">Contacto</p>
            {cfg.whatsapp && (
              <p><a className="hover:text-gold-light" href={linkWhatsapp(cfg.whatsapp, "Hola! Quería hacer una consulta")} target="_blank" rel="noopener">WhatsApp · {cfg.whatsapp}</a></p>
            )}
            {cfg.instagram && (
              <p><a className="hover:text-gold-light" href={linkInstagram(cfg.instagram)} target="_blank" rel="noopener">Instagram · {cfg.instagram}</a></p>
            )}
            {cfg.direccion && (
              <p><a className="hover:text-gold-light" href={`https://maps.google.com/?q=${encodeURIComponent(cfg.direccion)}`} target="_blank" rel="noopener">{cfg.direccion}</a></p>
            )}
          </div>
          <div className="text-sm text-piedra md:text-right">
            <p className="eyebrow mb-3">Días de atención</p>
            {horarios.map((h) => <p key={h}>{h}</p>)}
            <p className="mt-3 mb-5">Reservá online y recibí la confirmación por mail.</p>
            <Link href="/reservar" className="btn-linea">Reservar turno</Link>
          </div>
        </div>
        <p className="border-t border-linea py-5 text-center text-xs text-piedra/60">
          © {new Date().getFullYear()} {cfg.nombreNegocio}
        </p>
      </footer>
    </div>
  );
}
