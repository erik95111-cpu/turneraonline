import { getSesion } from "@/lib/auth";
import { fechaISO } from "@/lib/tiempo";
import { leerRango, reporteClientas, reporteReservas, reporteTransacciones } from "@/lib/reportes";

export const runtime = "nodejs";

/** Descarga de reportes en Excel: /admin/reportes/clientas | reservas | transacciones */
export async function GET(req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  if (!(await getSesion())) return new Response("No autorizado", { status: 401 });
  const { tipo } = await params;
  const sp = new URL(req.url).searchParams;
  const rango = leerRango(sp);

  let archivo: Buffer;
  let nombre: string;
  switch (tipo) {
    case "clientas":
      archivo = await reporteClientas({ q: sp.get("q") ?? "", etiqueta: sp.get("etiqueta") ?? "" });
      nombre = `clientas_${fechaISO(new Date())}`;
      break;
    case "reservas":
      archivo = await reporteReservas(rango);
      nombre = `reservas_${rango.desde}_a_${rango.hasta}`;
      break;
    case "transacciones":
      archivo = await reporteTransacciones(rango);
      nombre = `transacciones_${rango.desde}_a_${rango.hasta}`;
      break;
    default:
      return new Response("Reporte no encontrado", { status: 404 });
  }
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
