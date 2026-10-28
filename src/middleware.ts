import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ADMIN, tokenValido } from "@/lib/token";

/** Dirección exclusiva del panel (ej: panel.midominio.com.ar o mc-healthy-skin-panel.vercel.app) */
const esDireccionDelPanel = (host: string) => /(^|[.-])panel[.-]/.test(host);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) {
    // En la dirección del panel, la portada lleva directo al ingreso
    if (pathname === "/" && esDireccionDelPanel(req.headers.get("host") ?? "")) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  if (await tokenValido(req.cookies.get(COOKIE_ADMIN)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/admin/login", req.url));
}

export const config = { matcher: ["/", "/admin/:path*"] };
