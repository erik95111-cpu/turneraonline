import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // La tarjeta del turno (imagen para WhatsApp) lee las tipografías y el logo del disco
  outputFileTracingIncludes: {
    "/api/tarjeta/[id]": ["./src/assets/fuentes/*.ttf", "./public/logo.png"],
  },
};

export default nextConfig;
