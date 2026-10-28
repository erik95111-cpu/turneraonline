import type { Metadata } from "next";

/** Vista previa propia al compartir el link del panel (WhatsApp, etc.), distinta a la del sitio */
export const metadata: Metadata = {
  title: { default: "Panel de administración", template: "%s · Panel MC Healthy Skin" },
  description: "Acceso sólo para el equipo de MC Healthy Skin.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Panel de administración · MC Healthy Skin",
    description: "Acceso sólo para el equipo: turnos, clientas y gift cards.",
    images: ["/og-panel.jpg"],
    locale: "es_AR",
    type: "website",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
