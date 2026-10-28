/**
 * Portero del panel: corre ANTES de mostrar cualquier página de /admin.
 * Sin una cookie de sesión con firma válida, manda al login.
 * (La revisión completa, si el usuario sigue activo, se hace en requireAdmin.)
 */
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ADMIN, tokenValido } from "@/lib/token";

/** Las páginas del panel nunca se guardan en caché (ni en el navegador ni en proxies) */
function sinCache(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin/login")) return sinCache(NextResponse.next());
  if (await tokenValido(req.cookies.get(COOKIE_ADMIN)?.value)) return sinCache(NextResponse.next());
  return NextResponse.redirect(new URL("/admin/login", req.url));
}

export const config = { matcher: ["/admin/:path*"] };
