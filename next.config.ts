import type { NextConfig } from "next";

/**
 * Encabezados de seguridad que se mandan con TODAS las páginas.
 *  - frame-ancestors / X-Frame-Options: nadie puede meter el sitio dentro de
 *    otro (evita que engañen a alguien con un panel "falso" encima).
 *  - form-action 'self': los formularios sólo se pueden enviar a este sitio.
 *  - nosniff: el navegador no "adivina" tipos de archivo.
 *  - Referrer-Policy: a otros sitios (WhatsApp, YouTube) sólo les llega el
 *    dominio, nunca la dirección completa (que puede tener el link secreto del turno).
 *  - Permissions-Policy: la página no puede pedir cámara, micrófono ni ubicación.
 */
const encabezados = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: encabezados }];
  },
};

export default nextConfig;
