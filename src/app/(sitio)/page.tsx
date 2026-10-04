import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { formatDuracion, formatPrecio } from "@/lib/formato";
import { VideoPresentacion } from "@/components/VideoPresentacion";
import { calcularSena } from "@/lib/sena";
import { mpHabilitado } from "@/lib/mercadopago";

export default async function Home() {
  const [cfg, servicios] = await Promise.all([
    getConfig(),
    prisma.servicio.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
  ]);

  const categorias = [...new Set(servicios.map((s) => s.categoria))];
  const conSena = mpHabilitado() && cfg.senaTipo !== "NINGUNA";

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(201,169,110,0.16),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-28">
          <div className="order-2 text-center md:order-1 md:text-left">
            <p className="eyebrow">Dermatocosmiatría</p>
            <h1 className="mt-5 font-serif text-5xl leading-[1.05] font-medium sm:text-6xl lg:text-7xl">
              Tu piel, en su <em className="texto-oro font-normal">mejor versión</em>
            </h1>
            <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-piedra md:mx-0">
              Tratamientos faciales personalizados para cuidar, renovar y realzar la salud de tu piel.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link href="/reservar" className="btn-oro">Reservar turno</Link>
              <Link href="#tratamientos" className="btn-linea">Ver tratamientos</Link>
            </div>
          </div>
          <div className="order-1 flex justify-center md:order-2">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full border border-gold/30" />
              <div className="absolute -inset-8 rounded-full border border-gold/10" />
              <Image
                src="/logo.png"
                alt="MC Healthy Skin - Dermatocosmiatría"
                width={420}
                height={420}
                priority
                className="relative w-64 rounded-full shadow-[0_0_120px_-10px_rgba(201,169,110,0.45)] sm:w-80 lg:w-[420px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Valores ─── */}
      <section className="border-y border-linea bg-carbon">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-center sm:grid-cols-3 sm:px-6">
          {[
            ["Evaluación personalizada", "Analizamos tu tipo de piel antes de cada tratamiento."],
            ["Protocolos a medida", "Cada sesión se adapta a lo que tu piel necesita."],
            ["Seguimiento", "Te acompañamos con indicaciones para tu rutina en casa."],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="font-serif text-2xl text-gold-light">{t}</p>
              <p className="mt-2 text-sm text-piedra">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Tratamientos ─── */}
      <section id="tratamientos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="text-center">
          <p className="eyebrow">Servicios</p>
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Tratamientos</h2>
        </div>

        {servicios.length === 0 && (
          <p className="mt-10 text-center text-piedra">Muy pronto vas a ver acá todos los tratamientos.</p>
        )}

        {categorias.map((cat) => (
          <div key={cat} className="mt-14">
            {categorias.length > 1 && (
              <h3 className="mb-6 flex items-center gap-4 font-serif text-2xl text-gold-light">
                {cat}
                <span className="h-px flex-1 bg-linea" />
              </h3>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {servicios.filter((s) => s.categoria === cat).map((s) => (
                <article
                  key={s.id}
                  className="group flex flex-col rounded-2xl border border-linea bg-carbon p-6 transition hover:border-gold/50"
                >
                  <h4 className="font-serif text-2xl leading-tight">{s.nombre}</h4>
                  {s.descripcion && <p className="mt-3 flex-1 text-sm leading-relaxed text-piedra">{s.descripcion}</p>}
                  <div className="mt-6 flex items-end justify-between border-t border-linea pt-4">
                    <div>
                      <p className="text-xs tracking-widest text-piedra uppercase">{formatDuracion(s.duracionMin)}</p>
                      <p className="mt-1 font-serif text-2xl text-gold-light">{formatPrecio(s.precio)}</p>
                      {conSena && (
                        <p className="text-xs text-piedra">Seña {formatPrecio(calcularSena(s.precio, cfg.senaTipo, cfg.senaValor))}</p>
                      )}
                    </div>
                    <Link href={`/reservar?servicio=${s.id}`} className="btn-linea !px-4 !py-2 !text-[0.65rem]">
                      Reservar
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ─── Cómo funciona ─── */}
      <section id="como-funciona" className="scroll-mt-20 border-t border-linea bg-carbon">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <p className="eyebrow">Turnos online</p>
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Reservar es muy simple</h2>
          </div>
          <ol className="mt-14 grid gap-10 sm:grid-cols-3">
            {[
              ["Elegí tu tratamiento", "Mirá duración y precio de cada servicio."],
              ["Elegí día y horario", "Ves sólo los horarios que están libres."],
              [
                conSena ? "Confirmá con tu seña" : "Confirmá tus datos",
                conSena
                  ? "Abonás la seña con Mercado Pago y te llega la confirmación por mail."
                  : "Te llega la confirmación por mail al instante.",
              ],
            ].map(([t, d], i) => (
              <li key={t} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 font-serif text-2xl text-gold-light">
                  {i + 1}
                </span>
                <p className="mt-5 font-serif text-2xl">{t}</p>
                <p className="mt-2 text-sm text-piedra">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 text-center">
            <Link href="/reservar" className="btn-oro">Reservar mi turno</Link>
          </div>
        </div>
      </section>

      {/* ─── Sobre mí ─── */}
      {cfg.sobreMi && (
        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <p className="eyebrow">Sobre mí</p>
          {cfg.nombreProfesional && <h2 className="mt-4 font-serif text-4xl">{cfg.nombreProfesional}</h2>}
          <p className="mt-6 leading-relaxed whitespace-pre-line text-piedra">{cfg.sobreMi}</p>
        </section>
      )}

      {/* ─── Video de presentación ─── */}
      {cfg.videoUrl && (
        <section id="presentacion" className="scroll-mt-20 border-t border-linea px-4 py-20 sm:px-6">
          <div className="mb-12 text-center">
            <p className="eyebrow">Presentación</p>
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Conocenos</h2>
          </div>
          <VideoPresentacion url={cfg.videoUrl} />
        </section>
      )}
    </>
  );
}
