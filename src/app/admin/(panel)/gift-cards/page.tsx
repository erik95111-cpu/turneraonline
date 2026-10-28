import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/config";
import { fechaHoraLarga, fechaLarga } from "@/lib/tiempo";
import { formatPrecio, linkWhatsapp } from "@/lib/formato";
import { estadoVisible, linkGiftCard, type EstadoVisible } from "@/lib/giftcards";
import { cambiarEstadoGiftCard, venderGiftCard } from "../../acciones";

const VISTAS: [string, string][] = [
  ["", "Todas"],
  ["PENDIENTE_PAGO", "Esperando pago"],
  ["ACTIVA", "Activas"],
  ["USADA", "Usadas"],
  ["VENCIDA", "Vencidas"],
  ["ANULADA", "Anuladas"],
];

const ESTILO: Record<EstadoVisible, [string, string]> = {
  PENDIENTE_PAGO: ["Esperando pago", "bg-amber-100 text-amber-800"],
  ACTIVA: ["Activa", "bg-emerald-100 text-emerald-800"],
  USADA: ["Usada", "bg-sky-100 text-sky-800"],
  VENCIDA: ["Vencida", "bg-orange-100 text-orange-800"],
  ANULADA: ["Anulada", "bg-stone-200 text-stone-600"],
};

interface Filtros { ver?: string; q?: string; ok?: string; error?: string }

export default async function GiftCardsAdmin({ searchParams }: { searchParams: Promise<Filtros> }) {
  const sp = await searchParams;
  const ver = VISTAS.some(([v]) => v && v === sp.ver) ? sp.ver! : "";
  const q = (sp.q ?? "").trim();
  const ahora = new Date();

  const porEstado: Prisma.GiftCardWhereInput =
    ver === "VENCIDA" ? { estado: "ACTIVA", venceEn: { lt: ahora } }
    : ver === "ACTIVA" ? { estado: "ACTIVA", OR: [{ venceEn: null }, { venceEn: { gte: ahora } }] }
    : ver ? { estado: ver as "PENDIENTE_PAGO" | "USADA" | "ANULADA" }
    : {};
  const where: Prisma.GiftCardWhereInput = {
    AND: [
      porEstado,
      q ? { OR: ["codigo", "para", "de", "compradorEmail"].map((k) => ({ [k]: { contains: q, mode: "insensitive" } })) } : {},
    ],
  };

  const [giftCards, servicios, pendientes] = await Promise.all([
    prisma.giftCard.findMany({
      where,
      include: { servicio: true, turnos: { include: { clienta: true }, orderBy: { inicio: "desc" } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.servicio.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    prisma.giftCard.count({ where: { estado: "PENDIENTE_PAGO" } }),
  ]);
  const base = siteUrl();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Gift cards</h1>
          <p className="text-sm text-[#6b635b]">
            {pendientes ? `${pendientes} esperando pago · ` : ""}Cuando cobres una, tocá “Pago recibido” y se le manda por mail.
          </p>
        </div>
        <a href="#vender" className="btn">+ Vender en persona</a>
      </div>

      {sp.ok && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.ok}</p>}
      {sp.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>}

      <div className="flex flex-wrap gap-1.5">
        {VISTAS.map(([v, t]) => (
          <Link key={v} href={`/admin/gift-cards?${new URLSearchParams({ ...(v ? { ver: v } : {}), ...(q ? { q } : {}) })}`} className={ver === v ? "btn" : "btn-sec"}>{t}</Link>
        ))}
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-3">
        {ver && <input type="hidden" name="ver" value={ver} />}
        <div className="min-w-48 flex-1">
          <label className="lbl" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={q} placeholder="Código, para, de o email" className="input" />
        </div>
        <button className="btn-sec">Buscar</button>
      </form>

      <ul className="card divide-y divide-[#f0ebe3]">
        {giftCards.length === 0 && <li className="p-6 text-center text-sm text-[#8b8279]">No hay gift cards con estos filtros.</li>}
        {giftCards.map((g) => {
          const estado = estadoVisible(g, ahora);
          const [txt, cls] = ESTILO[estado];
          return (
            <li key={g.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4">
              <div className="w-32 shrink-0">
                <p className="font-mono text-sm font-semibold tracking-wider">{g.codigo}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{txt}</span>
              </div>
              <div className="min-w-48 flex-1 text-sm">
                <p className="font-medium">{g.servicio ? g.servicio.nombre : "Monto"} · {formatPrecio(g.monto)}
                  {!g.servicioId && g.saldo < g.monto && estado !== "PENDIENTE_PAGO" && <span className="text-[#6b635b]"> · saldo {formatPrecio(g.saldo)}</span>}
                </p>
                <p className="text-[#6b635b]">Para <strong>{g.para}</strong> · de {g.de}{g.compradorEmail ? ` (${g.compradorEmail})` : ""}</p>
                <p className="text-xs text-[#8b8279] first-letter:uppercase">
                  Pedida el {fechaLarga(g.createdAt)}{g.creadaPorAdmin ? " · venta en persona" : ""}
                  {g.venceEn ? ` · ${estado === "VENCIDA" ? "venció" : "vence"} el ${fechaLarga(g.venceEn)}` : ""}
                </p>
                {g.turnos.map((t) => (
                  <p key={t.id} className="text-xs text-[#8b8279] first-letter:uppercase">
                    ↳ Usada en el turno de {t.clienta.nombre}, {fechaHoraLarga(t.inicio)} ({formatPrecio(t.montoGiftCard)}){t.estado === "CANCELADO" ? " · cancelado" : ""}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {estado === "PENDIENTE_PAGO" && (
                  <form action={cambiarEstadoGiftCard}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="accion" value="PAGADA" />
                    <button className="btn">Pago recibido ✓</button>
                  </form>
                )}
                <a className="btn-sec" href={linkGiftCard(base, g)} target="_blank" rel="noopener">Ver tarjeta</a>
                {g.compradorTelefono && (
                  <a className="btn-sec" target="_blank" rel="noopener" href={linkWhatsapp(g.compradorTelefono)}>WhatsApp</a>
                )}
                {(estado === "PENDIENTE_PAGO" || estado === "ACTIVA") && (
                  <form action={cambiarEstadoGiftCard}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="accion" value="ANULAR" />
                    <button className="btn-sec">Anular</button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <form id="vender" action={venderGiftCard} className="card grid scroll-mt-6 gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-semibold">Vender una gift card en persona</h2>
          <p className="text-sm text-[#6b635b]">Queda activa en el momento. Si ponés un email, se la mandamos; si no, abrila con “Ver tarjeta” para imprimirla o mandarla por WhatsApp.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="lbl" htmlFor="servicioId">Qué se regala</label>
          <select id="servicioId" name="servicioId" className="input" defaultValue="">
            <option value="">Monto (el configurado en Configuración)</option>
            {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {formatPrecio(s.precio)}</option>)}
          </select>
        </div>
        <div><label className="lbl" htmlFor="para">Para</label><input id="para" name="para" required minLength={2} className="input" /></div>
        <div><label className="lbl" htmlFor="de">De</label><input id="de" name="de" required minLength={2} className="input" /></div>
        <div className="sm:col-span-2"><label className="lbl" htmlFor="mensaje">Mensaje (opcional)</label><input id="mensaje" name="mensaje" maxLength={200} className="input" /></div>
        <div><label className="lbl" htmlFor="email">Email de quien la compra (opcional)</label><input id="email" name="email" type="email" className="input" /></div>
        <div><label className="lbl" htmlFor="telefono">Teléfono (opcional)</label><input id="telefono" name="telefono" className="input" /></div>
        <div className="sm:col-span-2"><button className="btn">Crear gift card activa</button></div>
      </form>
    </div>
  );
}
