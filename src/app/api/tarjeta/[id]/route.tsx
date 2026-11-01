import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { fechaLarga, horaAR } from "@/lib/tiempo";

export const runtime = "nodejs";

const ORO = "#e6cf9f";
const ORO_OSCURO = "#c9a96e";
const CREMA = "#f4efe6";
const PIEDRA = "#a39a8c";

let fuentes: Promise<{ name: string; data: Buffer; style: "normal" | "italic"; weight: 500 }[]> | null = null;
function cargarFuentes() {
  const dir = join(process.cwd(), "src/assets/fuentes");
  fuentes ??= Promise.all([
    readFile(join(dir, "CormorantGaramond-Medium.ttf")).then((data) => ({ name: "Cormorant", data, style: "normal" as const, weight: 500 as const })),
    readFile(join(dir, "CormorantGaramond-MediumItalic.ttf")).then((data) => ({ name: "Cormorant", data, style: "italic" as const, weight: 500 as const })),
    readFile(join(dir, "Montserrat-Medium.ttf")).then((data) => ({ name: "Montserrat", data, style: "normal" as const, weight: 500 as const })),
  ]);
  return fuentes;
}

let logo: Promise<string> | null = null;
function cargarLogo() {
  logo ??= readFile(join(process.cwd(), "public/logo.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);
  return logo;
}

/**
 * Tarjeta con el logo, el día y la hora del turno. Es la imagen que muestra WhatsApp
 * al mandar el link del turno (vista previa) y la que se puede descargar desde el panel.
 * GET /api/tarjeta/:id?t=<token>&v=confirmacion|recordatorio[&descargar=1]
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const turno = await prisma.turno.findUnique({ where: { id }, include: { clienta: true, servicio: true } });
  if (!turno || turno.token !== url.searchParams.get("t")) return new Response("No encontrado", { status: 404 });

  const recordatorio = url.searchParams.get("v") === "recordatorio";
  const [cfg, fonts, logoSrc] = await Promise.all([getConfig(), cargarFuentes(), cargarLogo()]);
  const nombre = turno.clienta.nombre.trim().split(/\s+/)[0];
  const dia = fechaLarga(turno.inicio);
  const titulo = recordatorio ? `${nombre}, te esperamos` : `¡Listo, ${nombre}!`;
  // Los nombres largos achican el título para que entre en una línea
  const tamTitulo = Math.min(84, Math.floor(1700 / titulo.length));

  const imagen = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "radial-gradient(circle at 25% 40%, #2a2219 0%, #0b0a0c 70%)", fontFamily: "Montserrat" }}>
        {/* Marco dorado fino */}
        <div style={{ position: "absolute", top: 28, left: 28, right: 28, bottom: 28, border: `2px solid ${ORO_OSCURO}`, borderRadius: 28, opacity: 0.6, display: "flex" }} />
        <div style={{ display: "flex", width: 470, alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", width: 330, height: 330, borderRadius: 330, padding: 8, background: `linear-gradient(135deg, #8a6d3b, ${ORO} 50%, ${ORO_OSCURO})`, boxShadow: "0 0 90px rgba(201,169,110,0.45)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={314} height={314} style={{ borderRadius: 314 }} alt="" />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, paddingRight: 80 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: ORO_OSCURO, textTransform: "uppercase" }}>
            {recordatorio ? "Recordatorio de turno" : "Turno confirmado"}
          </div>
          <div style={{ display: "flex", fontFamily: "Cormorant", fontStyle: "italic", fontSize: tamTitulo, lineHeight: 1, color: ORO, marginTop: 18 }}>
            {titulo}
          </div>
          <div style={{ display: "flex", width: 120, height: 2, background: ORO_OSCURO, marginTop: 30, marginBottom: 30 }} />
          <div style={{ display: "flex", fontFamily: "Cormorant", fontSize: dia.length > 22 ? 52 : 58, lineHeight: 1.05, color: CREMA }}>
            {dia.charAt(0).toUpperCase() + dia.slice(1)}
          </div>
          <div style={{ display: "flex", fontSize: 44, color: ORO, marginTop: 12 }}>{horaAR(turno.inicio)} hs</div>
          <div style={{ display: "flex", fontSize: 24, color: PIEDRA, marginTop: 22 }}>{turno.servicio.nombre}</div>
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 4, color: PIEDRA, marginTop: 40, textTransform: "uppercase" }}>
            {cfg.nombreNegocio} · Dermatocosmiatría
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );

  const headers = new Headers(imagen.headers);
  headers.set("Cache-Control", "public, max-age=300");
  if (url.searchParams.get("descargar")) {
    headers.set("Content-Disposition", `attachment; filename="turno-${nombre.toLowerCase()}-${recordatorio ? "recordatorio" : "confirmado"}.png"`);
  }
  return new Response(imagen.body, { status: 200, headers });
}
