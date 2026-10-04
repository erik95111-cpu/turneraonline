import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { salir } from "../acciones";

export const metadata: Metadata = { title: "Panel", robots: { index: false } };
export const dynamic = "force-dynamic";

const LINKS = [
  ["/admin", "Agenda"],
  ["/admin/turnos/nuevo", "Nuevo turno"],
  ["/admin/servicios", "Tratamientos"],
  ["/admin/horarios", "Horarios"],
  ["/admin/clientas", "Clientas"],
  ["/admin/estadisticas", "Estadísticas"],
  ["/admin/configuracion", "Configuración"],
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="admin">
      <header className="bg-ink text-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo.png" alt="" width={34} height={34} className="rounded-full" />
            <span className="font-serif text-lg text-gold-light">Panel</span>
          </Link>
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:w-auto sm:flex-1">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} className="shrink-0 rounded-md px-2.5 py-1.5 text-piedra hover:bg-humo hover:text-gold-light">
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/" target="_blank" className="text-piedra hover:text-gold-light">Ver web ↗</Link>
            <form action={salir}><button className="text-piedra hover:text-gold-light">Salir</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
