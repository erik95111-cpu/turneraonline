import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/config";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "MC Healthy Skin · Dermatocosmiatría",
    template: "%s · MC Healthy Skin",
  },
  description:
    "Tratamientos faciales y de cuidado de la piel. Reservá tu turno online en MC Healthy Skin - Dermatocosmiatría.",
  openGraph: {
    title: "MC Healthy Skin · Dermatocosmiatría",
    description: "Reservá tu turno online.",
    images: ["/og.jpg"],
    locale: "es_AR",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0b0a0c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${cormorant.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
