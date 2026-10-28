# Capítulo 5 · El sitio público (lo que ven las clientas)

Ahora sí: las **pantallas**. En Next.js, cada archivo `page.tsx` dentro de `src/app/` es una página, y cada `layout.tsx` es el **marco** que la rodea (encabezado, pie).

Los componentes reutilizables (calendario, formulario de reserva, etc.) están en el [capítulo 5b](05b-componentes.md).

---

## Antes de empezar: cómo se leen las pantallas (JSX y Tailwind)

Las pantallas mezclan código con algo parecido a HTML. Eso se llama **JSX**.

| Lo que ves | Qué significa |
|---|---|
| `<div>…</div>` | Una "caja" que agrupa cosas |
| `<p>`, `<h1>`, `<h2>` | Párrafo, título grande, título mediano |
| `<Link href="/reservar">` | Un link interno (de Next.js: cambia de página sin recargar todo) |
| `<Image src="/logo.png">` | Una imagen optimizada (de Next.js: la achica según el celular) |
| `{variable}` | Mete el valor de una variable en la pantalla |
| `{condición && <p>…</p>}` | "Si se cumple la condición, mostrá esto" |
| `{lista.map((x) => <p>{x}</p>)}` | "Por cada elemento de la lista, dibujá esto" |
| `{/* comentario */}` | Un comentario dentro de JSX |
| `<>…</>` | Una caja "invisible": agrupa sin agregar nada a la pantalla |
| `key={…}` | Un identificador que React necesita cuando dibuja listas |

**Tailwind:** el estilo se escribe con clases cortas en `className`. Las más comunes:

| Clase | Qué hace |
|---|---|
| `mt-4`, `mb-6`, `px-4`, `py-2` | Margen arriba (t), abajo (b); relleno a los costados (x) y arriba-abajo (y). El número es el tamaño |
| `text-sm`, `text-4xl` | Tamaño de letra (sm = chico, 4xl = muy grande) |
| `font-serif` | Letra con serifa (la elegante, Cormorant) |
| `text-gold-light`, `bg-carbon` | Color de texto / de fondo (colores propios, definidos en `globals.css`) |
| `flex`, `grid`, `gap-3` | Acomodar cosas en fila o en grilla, con espacio entre ellas |
| `rounded-full`, `rounded-2xl` | Puntas redondeadas |
| `sm:` `md:` `lg:` adelante de una clase | "Solo en pantallas medianas o más grandes". Así la página se adapta del celular a la compu |
| `hover:` adelante | "Cuando el mouse pasa por encima" |
| `!` adelante (`!px-4`) | "Este estilo gana sobre cualquier otro" |

---

## `src/app/layout.tsx` — el marco de TODO el sitio

Envuelve todas las páginas, públicas y del panel.

```tsx
import type { Metadata, Viewport } from "next";          // Tipos para los datos de la página (título, color del navegador)
import { Cormorant_Garamond, Montserrat } from "next/font/google";
                                                         // Las dos tipografías de Google: Cormorant (títulos elegantes) y Montserrat (texto)
import "./globals.css";                                  // Los estilos generales (ver más abajo)
import { siteUrl } from "@/lib/config";                  // La dirección del sitio

const cormorant = Cormorant_Garamond({                   // Carga Cormorant…
  subsets: ["latin"],                                    //   solo las letras latinas (con acentos y ñ)
  weight: ["400", "500", "600"],                         //   en tres grosores
  style: ["normal", "italic"],                           //   normal y cursiva
  variable: "--font-cormorant",                          //   y la deja disponible con este nombre para el CSS
});                                                      //
const montserrat = Montserrat({                          // Carga Montserrat…
  subsets: ["latin"],                                    //
  weight: ["300", "400", "500", "600"],                  //   en cuatro grosores
  variable: "--font-montserrat",                         //
});                                                      //

export const metadata: Metadata = {                      // Datos de la página para Google y para cuando se comparte el link:
  metadataBase: new URL(siteUrl()),                      //   la dirección base del sitio
  title: {                                               //   el título de la pestaña:
    default: "MC Healthy Skin · Dermatocosmiatría",      //     el de la página de inicio
    template: "%s · MC Healthy Skin",                    //     el resto: "<título de la página> · MC Healthy Skin" (%s = el título de cada página)
  },                                                     //
  description:                                           //   la descripción que muestra Google
    "Tratamientos faciales y de cuidado de la piel. Reservá tu turno online en MC Healthy Skin - Dermatocosmiatría.",
  openGraph: {                                           //   cómo se ve el link al compartirlo por WhatsApp o Instagram:
    title: "MC Healthy Skin · Dermatocosmiatría",        //     título
    description: "Reservá tu turno online.",             //     texto
    images: ["/og.jpg"],                                 //     la imagen de vista previa
    locale: "es_AR",                                     //     idioma: español de Argentina
    type: "website",                                     //     tipo: sitio web
  },                                                     //
};                                                       //

export const viewport: Viewport = { themeColor: "#0b0a0c" };
                                                         // Color de la barra del navegador en el celular (negro, igual que el sitio)

export default function RootLayout({ children }: { children: React.ReactNode }) {
                                                         // El marco. "children" = la página que va adentro
  return (                                               //
    <html lang="es-AR" className={`${cormorant.variable} ${montserrat.variable}`} suppressHydrationWarning>
                                                         // La página entera, en español argentino, con las dos tipografías disponibles
    <body>{children}</body>                              // El cuerpo, con la página adentro
    </html>                                              //
  );                                                     //
}                                                        // Fin
```

> `suppressHydrationWarning` evita un aviso inofensivo de React: la portada animada (`Intro`) marca la página antes de que React arranque.

---

## `src/app/globals.css` — los estilos generales

En CSS, los comentarios reales se escriben `/* así */`. En esta guía uso `//` para que se lea igual que el resto.

```css
@import "tailwindcss";                                   // Activa Tailwind

@theme {                                                 // LOS COLORES Y LETRAS DE LA MARCA. Con esto existen clases como "bg-ink" o "text-gold"
  --color-ink: #0b0a0c;                                  // ink: negro (fondo del sitio)
  --color-carbon: #141215;                               // carbon: negro un poco más claro (tarjetas)
  --color-humo: #1d1a1e;                                 // humo: gris muy oscuro (casillas)
  --color-linea: #2c282d;                                // linea: gris de los bordes
  --color-gold: #c9a96e;                                 // gold: dorado
  --color-gold-light: #e6cf9f;                           // gold-light: dorado claro (títulos)
  --color-gold-dark: #8a6d3b;                            // gold-dark: dorado oscuro
  --color-cream: #f6f1e9;                                // cream: crema (texto principal)
  --color-piedra: #a49d94;                               // piedra: gris cálido (texto secundario)
  --font-serif: var(--font-cormorant), Georgia, serif;   // Letra con serifa: Cormorant (si no carga, Georgia)
  --font-sans: var(--font-montserrat), system-ui, sans-serif;
                                                         // Letra sin serifa: Montserrat (si no carga, la del sistema)
}                                                        //

html {                                                   // Toda la página:
  scroll-behavior: smooth;                               //   al tocar un link "#tratamientos", baja suave en vez de saltar
}                                                        //

body {                                                   // El cuerpo:
  background: var(--color-ink);                          //   fondo negro
  color: var(--color-cream);                             //   texto crema
  font-family: var(--font-sans);                         //   letra Montserrat
  -webkit-font-smoothing: antialiased;                   //   letras más suaves en Mac/iPhone
}                                                        //

.texto-oro {                                             // Clase "texto-oro": texto con degradé dorado (el "mejor versión" del inicio)
  background: linear-gradient(100deg, #b08d57 0%, #f1dcae 45%, #c9a96e 70%, #8a6d3b 100%);
                                                         //   un degradé de cuatro dorados…
  -webkit-background-clip: text;                        //   … recortado con la forma de las letras (Safari)
  background-clip: text;                                 //   … (resto de los navegadores)
  color: transparent;                                    //   y la letra transparente, para que se vea el degradé
}                                                        //

.eyebrow {                                               // Clase "eyebrow": el textito chico en mayúsculas arriba de los títulos ("SERVICIOS")
  font-size: 0.72rem;                                    //   chico
  letter-spacing: 0.32em;                                //   letras separadas
  text-transform: uppercase;                             //   en mayúsculas
  color: var(--color-gold);                              //   dorado
}                                                        //

.btn-oro {                                               // Clase "btn-oro": el botón dorado principal ("Reservar turno")
  display: inline-flex;                                  //   se acomoda en línea, con su contenido centrado:
  align-items: center;                                   //   centrado vertical
  justify-content: center;                               //   centrado horizontal
  gap: 0.5rem;                                           //   espacio entre ícono y texto
  border-radius: 999px;                                  //   puntas totalmente redondas (forma de píldora)
  padding: 0.85rem 1.75rem;                              //   relleno: arriba-abajo y costados
  font-size: 0.8rem;                                     //   letra chica
  font-weight: 500;                                      //   semi-negrita
  letter-spacing: 0.18em;                                //   letras separadas
  text-transform: uppercase;                             //   mayúsculas
  color: var(--color-ink);                               //   texto negro
  background: linear-gradient(100deg, #b08d57, #ecd6a7 50%, #c9a96e);
                                                         //   fondo con degradé dorado
  transition: filter 0.2s, transform 0.2s;               //   los cambios (brillo, movimiento) duran 0,2 segundos
}                                                        //
.btn-oro:hover { filter: brightness(1.08); transform: translateY(-1px); }
                                                         // Al pasar el mouse: un poco más brillante y se levanta 1 píxel
.btn-oro:disabled { opacity: 0.45; pointer-events: none; }
                                                         // Desactivado (mientras procesa): medio transparente y no se puede tocar

.btn-linea {                                             // Clase "btn-linea": botón secundario, solo con borde dorado
  display: inline-flex;                                  //   (igual que el de arriba…)
  align-items: center;                                   //
  justify-content: center;                               //
  gap: 0.5rem;                                           //
  border-radius: 999px;                                  //
  padding: 0.8rem 1.6rem;                                //
  font-size: 0.8rem;                                     //
  letter-spacing: 0.18em;                                //
  text-transform: uppercase;                             //
  color: var(--color-gold-light);                        //   … pero con texto dorado claro…
  border: 1px solid color-mix(in srgb, var(--color-gold) 55%, transparent);
                                                         //   … y un borde dorado medio transparente
  transition: background 0.2s;                           //   el fondo cambia suave
}                                                        //
.btn-linea:hover { background: color-mix(in srgb, var(--color-gold) 12%, transparent); }
                                                         // Al pasar el mouse: un fondo dorado muy suave

.campo {                                                 // Clase "campo": las casillas de texto del sitio (nombre, email…)
  width: 100%;                                           //   ancho completo
  border-radius: 0.75rem;                                //   puntas redondeadas
  border: 1px solid var(--color-linea);                  //   borde gris
  background: var(--color-humo);                         //   fondo gris oscuro
  padding: 0.8rem 1rem;                                  //   relleno
  color: var(--color-cream);                             //   texto crema
  outline: none;                                         //   sin el contorno azul que pone el navegador
}                                                        //
.campo:focus { border-color: var(--color-gold); }        // Cuando se está escribiendo: borde dorado
.campo::placeholder { color: #6f6870; }                  // El texto de ejemplo ("Ej: 11 2345 6789"), en gris

.admin {                                                 // PANEL (tema claro). Todo lo que esté dentro de una caja "admin":
  background: #f7f4ef;                                   //   fondo crema claro
  color: #1a1714;                                        //   texto casi negro
  min-height: 100vh;                                     //   ocupa al menos toda la altura de la pantalla
}                                                        //
.admin .input {                                          // Casillas del panel:
  width: 100%;                                           //   ancho completo
  border-radius: 0.5rem;                                 //   puntas redondeadas
  border: 1px solid #d9d2c7;                             //   borde beige
  background: #fff;                                      //   fondo blanco
  padding: 0.55rem 0.75rem;                              //   relleno
  font-size: 0.9rem;                                     //   letra
}                                                        //
.admin .input:focus { outline: 2px solid #c9a96e; outline-offset: 0; border-color: #c9a96e; }
                                                         // Al escribir: contorno dorado
.admin .card { background: #fff; border: 1px solid #ebe5db; border-radius: 0.9rem; }
                                                         // "Tarjetas" del panel: blancas con borde suave
.admin .btn {                                            // Botón principal del panel:
  display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
                                                         //   contenido centrado
  border-radius: .5rem; padding: .5rem .9rem; font-size: .85rem; font-weight: 500;
                                                         //   forma y tamaño
  background: #0b0a0c; color: #e6cf9f;                   //   fondo negro, letra dorada
}                                                        //
.admin .btn:hover { background: #2a2529; }               // Al pasar el mouse: gris oscuro
.admin .btn-sec {                                        // Botón secundario del panel:
  display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
                                                         //   contenido centrado
  border-radius: .5rem; padding: .45rem .8rem; font-size: .8rem;
                                                         //   forma y tamaño
  border: 1px solid #d9d2c7; background: #fff; color: #1a1714;
                                                         //   blanco con borde
}                                                        //
.admin .btn-sec:hover { background: #f1ece4; }           // Al pasar el mouse: beige
.admin label.lbl { display: block; font-size: .78rem; color: #6b635b; margin-bottom: .3rem; }
                                                         // Etiquetas de las casillas del panel: chicas y grises
```

**La portada animada (`.intro…`).** El resto del archivo son los estilos de la animación de bienvenida con el logo. Cada pieza hace esto:

| Clase o regla | Qué hace |
|---|---|
| `.intro` | Capa negra que tapa toda la pantalla (`position: fixed; inset: 0`), por encima de todo (`z-index: 100`), con el contenido centrado |
| `html[data-intro="no"] .intro` | Si la clienta ya la vio en esta visita, la oculta antes de que se dibuje (sin parpadeo) |
| `.intro-flota` | Hace "flotar" el logo arriba y abajo, suave y sin parar (empieza a los 2 segundos) |
| `.intro-logo` | Tamaño del logo: 64% del ancho de la pantalla, máximo 300 px, cuadrado |
| `.intro-img` | El logo: aparece de borroso y chico a nítido y normal, y después respira con un halo dorado |
| `.intro-brillo` | Un reflejo de luz que cruza el logo cada 5 segundos |
| `.intro-aro` + `circle` | El anillo dorado que se dibuja alrededor del logo (el truco: `stroke-dasharray` / `stroke-dashoffset`) |
| `.intro-orbita` + `span` | La lucecita dorada que gira sobre el anillo |
| `.intro-boton` | El botón "Reservá tu turno": aparece a los 1,8 s y después "late" suave |
| `.intro-ver` | El link "Ver la página": aparece a los 2,3 s |
| `@keyframes …` | Cada animación paso a paso (de dónde a dónde va cada movimiento) |
| `@media (prefers-reduced-motion: reduce)` | **Accesibilidad:** si la persona configuró su celular para "reducir movimiento", se apagan las animaciones y todo aparece directo |

---

## `src/app/(sitio)/layout.tsx` — el marco de las páginas públicas

El encabezado con el logo y el menú, y el pie con contacto y horarios.

```tsx
import Image from "next/image";                          // Imágenes optimizadas
import Link from "next/link";                            // Links internos
import { getConfig } from "@/lib/config";                // Configuración del negocio
import { prisma } from "@/lib/db";                       // La base
import { linkInstagram, linkWhatsapp, resumenHorarios } from "@/lib/formato";
                                                         // Formatos (capítulo 3)

export const dynamic = "force-dynamic";                  // Se arma de nuevo en cada visita (así un cambio en el panel se ve al instante)

export default async function SitioLayout({ children }: { children: React.ReactNode }) {
                                                         // El marco. "async" porque lee la base
  const [cfg, franjas] = await Promise.all([getConfig(), prisma.horarioAtencion.findMany()]);
                                                         // Lee a la vez la configuración y los horarios de atención
  const horarios = resumenHorarios(franjas);             // Arma el texto "Sábados · 09:00 a 13:00 y 14:00 a 18:00"
  return (                                               //
    <div className="flex min-h-screen flex-col">         // Caja de toda la página, en columna, al menos del alto de la pantalla
      <header className="sticky top-0 z-40 border-b border-linea/60 bg-ink/80 backdrop-blur-md">
                                                         // ENCABEZADO: queda pegado arriba al bajar (sticky), semitransparente con efecto vidrio esmerilado
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                                                         //   fila centrada: logo a la izquierda, menú en el medio, botón a la derecha
          <Link href="/" className="flex items-center gap-3">
                                                         //   el logo + nombre, que llevan al inicio
            <Image src="/logo.png" alt="" width={40} height={40} className="rounded-full" priority />
                                                         //     logo redondo chico. priority = cargarlo primero
            <span className="font-serif text-xl tracking-wide text-gold-light">Healthy Skin</span>
                                                         //     nombre
          </Link>                                        //
          <nav className="hidden items-center gap-8 text-xs tracking-[0.2em] uppercase text-piedra md:flex">
                                                         //   MENÚ: oculto en el celular (hidden), visible en pantallas medianas o más (md:flex)
            <Link href="/#tratamientos" className="hover:text-gold-light">Tratamientos</Link>
                                                         //     baja a la sección de tratamientos
            <Link href="/#como-funciona" className="hover:text-gold-light">Cómo funciona</Link>
                                                         //     baja a "cómo funciona"
            {cfg.videoUrl && <Link href="/#presentacion" className="hover:text-gold-light">Presentación</Link>}
                                                         //     solo si hay video cargado
            <Link href="/#contacto" className="hover:text-gold-light">Contacto</Link>
                                                         //     baja al pie
          </nav>                                         //
          <Link href="/reservar" className="btn-oro !px-5 !py-2.5 !text-[0.7rem]">Reservar</Link>
                                                         //   botón dorado "Reservar", más chico que el normal
        </div>                                           //
      </header>                                          // Fin del encabezado

      <main className="flex-1">{children}</main>         // EL CONTENIDO de cada página. flex-1 = ocupa todo el espacio libre (empuja el pie abajo)

      <footer id="contacto" className="border-t border-linea bg-carbon">
                                                         // PIE DE PÁGINA (id="contacto" para que el menú pueda bajar acá)
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
                                                         //   grilla: una columna en celular, tres en pantallas medianas
          <div className="flex items-center gap-4">      //   COLUMNA 1: logo y nombre
            <Image src="/logo.png" alt="MC Healthy Skin" width={72} height={72} className="rounded-full" />
            <div>                                        //
              <p className="font-serif text-2xl text-gold-light">{cfg.nombreNegocio}</p>
                                                         //     nombre del negocio (de la configuración)
              <p className="eyebrow !text-[0.6rem] mt-1">Dermatocosmiatría</p>
            </div>                                       //
          </div>                                         //
          <div className="space-y-2 text-sm text-piedra">
                                                         //   COLUMNA 2: contacto
            <p className="eyebrow mb-3">Contacto</p>     //
            {cfg.whatsapp && (                           //     si hay WhatsApp cargado:
              <p><a className="hover:text-gold-light" href={linkWhatsapp(cfg.whatsapp, "Hola! Quería hacer una consulta")} target="_blank" rel="noopener">WhatsApp · {cfg.whatsapp}</a></p>
                                                         //     link que abre WhatsApp con un mensaje ya escrito. target="_blank" = en otra pestaña; rel="noopener" = por seguridad, la otra pestaña no puede tocar la nuestra
            )}                                           //
            {cfg.instagram && (                          //     si hay Instagram:
              <p><a className="hover:text-gold-light" href={linkInstagram(cfg.instagram)} target="_blank" rel="noopener">Instagram · {cfg.instagram}</a></p>
            )}                                           //
            {cfg.direccion && (                          //     si hay dirección:
              <p><a className="hover:text-gold-light" href={`https://maps.google.com/?q=${encodeURIComponent(cfg.direccion)}`} target="_blank" rel="noopener">{cfg.direccion}</a></p>
                                                         //     link a Google Maps con la dirección buscada
            )}                                           //
          </div>                                         //
          <div className="text-sm text-piedra md:text-right">
                                                         //   COLUMNA 3: horarios
            <p className="eyebrow mb-3">Días de atención</p>
            {horarios.map((h) => <p key={h}>{h}</p>)}    //     un renglón por cada grupo de horarios
            <p className="mt-3 mb-5">Reservá online y recibí la confirmación por mail.</p>
            <Link href="/reservar" className="btn-linea">Reservar turno</Link>
          </div>                                         //
        </div>                                           //
        <p className="border-t border-linea py-5 text-center text-xs text-piedra/60">
          © {new Date().getFullYear()} {cfg.nombreNegocio}
                                                         //   "© 2026 MC Healthy Skin" (el año se calcula solo)
        </p>                                             //
      </footer>                                          // Fin del pie
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/(sitio)/page.tsx` — la página de inicio (`/`)

```tsx
import Image from "next/image";                          // Imágenes
import Link from "next/link";                            // Links
import { prisma } from "@/lib/db";                       // La base
import { getConfig } from "@/lib/config";                // Configuración
import { formatDuracion, formatPrecio } from "@/lib/formato";
                                                         // Formatos de duración y precio
import { VideoPresentacion } from "@/components/VideoPresentacion";
                                                         // El video (capítulo 5b)
import { Intro } from "@/components/Intro";              // La portada animada (capítulo 5b)
import { calcularSena, senaPorTransferencia } from "@/lib/sena";
                                                         // Cálculo de la seña

export default async function Home({ searchParams }: { searchParams: Promise<{ intro?: string }> }) {
                                                         // La página. searchParams = lo que viene después del "?" (acá, ?intro=0)
  const { intro } = await searchParams;                  // Lee ?intro=
  const [cfg, servicios] = await Promise.all([           // Lee a la vez:
    getConfig(),                                         //   la configuración
    prisma.servicio.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
                                                         //   los tratamientos activos, ordenados por "orden" y después por nombre
  ]);                                                    //

  const categorias = [...new Set(servicios.map((s) => s.categoria))];
                                                         // Lista de categorías sin repetir: ["Faciales", "Corporales", "Capilares"]
  const conSena = senaPorTransferencia(cfg);             // ¿Se cobra seña?

  return (                                               // Lo que se dibuja:
    <>                                                   //
      {intro !== "0" && <Intro />}                       // La portada animada, salvo que venga ?intro=0 (cuando tocaron "Ver la página")
      <section className="relative overflow-hidden">     // ─── PORTADA (hero) ───
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(201,169,110,0.16),transparent_60%)]" />
                                                         //   resplandor dorado de fondo (decorativo; pointer-events-none = no se puede tocar)
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-28">
                                                         //   grilla: en compu, dos columnas (texto | logo); en celular, una
          <div className="order-2 text-center md:order-1 md:text-left">
                                                         //   COLUMNA DE TEXTO: en celular va segunda (abajo del logo), en compu primera
            <p className="eyebrow">Dermatocosmiatría</p> //
            <h1 className="mt-5 font-serif text-5xl leading-[1.05] font-medium sm:text-6xl lg:text-7xl">
                                                         //   título principal, cada vez más grande según la pantalla
              Tu piel, en su <em className="texto-oro font-normal">mejor versión</em>
                                                         //   "mejor versión" en cursiva con degradé dorado
            </h1>                                        //
            <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-piedra md:mx-0">
              Tratamientos faciales personalizados para cuidar, renovar y realzar la salud de tu piel.
            </p>                                         //
            <div className="mt-9 flex flex-wrap justify-center gap-3 md:justify-start">
                                                         //   fila de botones
              <Link href="/reservar" className="btn-oro">Reservar turno</Link>
              <Link href="#tratamientos" className="btn-linea">Ver tratamientos</Link>
            </div>                                       //
          </div>                                         //
          <div className="order-1 flex justify-center md:order-2">
                                                         //   COLUMNA DEL LOGO
            <div className="relative">                   //
              <div className="absolute -inset-3 rounded-full border border-gold/30" />
                                                         //     anillo dorado cerca del logo
              <div className="absolute -inset-8 rounded-full border border-gold/10" />
                                                         //     anillo dorado más lejos y más suave
              <Image                                     //     el logo grande:
                src="/logo.png"                          //
                alt="MC Healthy Skin - Dermatocosmiatría"
                                                         //       texto alternativo (para lectores de pantalla y Google)
                width={420}                              //
                height={420}                             //
                priority                                 //       cargarlo primero
                className="relative w-64 rounded-full shadow-[0_0_120px_-10px_rgba(201,169,110,0.45)] sm:w-80 lg:w-[420px]"
                                                         //       redondo, con resplandor dorado, más grande en pantallas más grandes
              />                                         //
            </div>                                       //
          </div>                                         //
        </div>                                           //
      </section>                                         //

      <section className="border-y border-linea bg-carbon">
                                                         // ─── VALORES (tres frases) ───
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-center sm:grid-cols-3 sm:px-6">
          {[                                             //   una lista de [título, descripción]…
            ["Evaluación personalizada", "Analizamos tu tipo de piel antes de cada tratamiento."],
            ["Protocolos a medida", "Cada sesión se adapta a lo que tu piel necesita."],
            ["Seguimiento", "Te acompañamos con indicaciones para tu rutina en casa."],
          ].map(([t, d]) => (                            //   … y por cada una dibuja:
            <div key={t}>                                //
              <p className="font-serif text-2xl text-gold-light">{t}</p>
                                                         //     el título
              <p className="mt-2 text-sm text-piedra">{d}</p>
                                                         //     la descripción
            </div>                                       //
          ))}                                            //
        </div>                                           //
      </section>                                         //

      <section id="tratamientos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
                                                         // ─── TRATAMIENTOS ─── (scroll-mt-20 = al bajar acá, deja lugar para el encabezado pegado)
        <div className="text-center">                    //
          <p className="eyebrow">Servicios</p>           //
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Tratamientos</h2>
        </div>                                           //

        {servicios.length === 0 && (                     //   si todavía no hay tratamientos cargados:
          <p className="mt-10 text-center text-piedra">Muy pronto vas a ver acá todos los tratamientos.</p>
        )}                                               //

        {categorias.map((cat) => (                       //   por cada categoría…
          <div key={cat} className="mt-14">              //
            {categorias.length > 1 && (                  //     si hay más de una categoría, muestra su nombre con una línea al costado
              <h3 className="mb-6 flex items-center gap-4 font-serif text-2xl text-gold-light">
                {cat}                                    //       el nombre
                <span className="h-px flex-1 bg-linea" />
                                                         //       la línea (1 píxel de alto, ocupa el resto del ancho)
              </h3>                                      //
            )}                                           //
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                                         //     grilla de tarjetas: 1, 2 o 3 columnas según la pantalla
              {servicios.filter((s) => s.categoria === cat).map((s) => (
                                                         //     por cada tratamiento de esta categoría, una tarjeta:
                <article                                 //
                  key={s.id}                             //
                  className="group flex flex-col rounded-2xl border border-linea bg-carbon p-6 transition hover:border-gold/50"
                                                         //       tarjeta oscura; al pasar el mouse, el borde se pone dorado
                >                                        //
                  <h4 className="font-serif text-2xl leading-tight">{s.nombre}</h4>
                                                         //       nombre
                  {s.descripcion && <p className="mt-3 flex-1 text-sm leading-relaxed text-piedra">{s.descripcion}</p>}
                                                         //       descripción, si tiene
                  <div className="mt-6 flex items-end justify-between border-t border-linea pt-4">
                                                         //       parte de abajo: datos a la izquierda, botón a la derecha
                    <div>                                //
                      <p className="text-xs tracking-widest text-piedra uppercase">{formatDuracion(s.duracionMin)}</p>
                                                         //         duración ("1 H")
                      <p className="mt-1 font-serif text-2xl text-gold-light">{formatPrecio(s.precio)}</p>
                                                         //         precio
                      {conSena && (                      //         si se cobra seña, cuánto es:
                        <p className="text-xs text-piedra">Seña {formatPrecio(calcularSena(s.precio, cfg.senaTipo, cfg.senaValor))}</p>
                      )}                                 //
                    </div>                               //
                    <Link href={`/reservar?servicio=${s.id}`} className="btn-linea !px-4 !py-2 !text-[0.65rem]">
                                                         //         botón que va a reservar con ESTE tratamiento ya elegido
                      Reservar                           //
                    </Link>                              //
                  </div>                                 //
                </article>                               //
              ))}                                        //
            </div>                                       //
          </div>                                         //
        ))}                                              //
      </section>                                         //

      <section id="como-funciona" className="scroll-mt-20 border-t border-linea bg-carbon">
                                                         // ─── CÓMO FUNCIONA (3 pasos) ───
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="text-center">                  //
            <p className="eyebrow">Turnos online</p>     //
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Reservar es muy simple</h2>
          </div>                                         //
          <ol className="mt-14 grid gap-10 sm:grid-cols-3">
                                                         //   lista numerada (ol) en tres columnas
            {[                                           //   los tres pasos [título, texto]:
              ["Elegí tu tratamiento", "Mirá duración y precio de cada servicio."],
              ["Elegí día y horario", "Ves sólo los horarios que están libres."],
              [                                          //   el tercero cambia según haya seña o no:
                conSena ? "Confirmá con tu seña" : "Confirmá tus datos",
                conSena                                  //
                  ? "Transferís la seña, mandás la captura por WhatsApp y te llega la confirmación por mail."
                  : "Te llega la confirmación por mail al instante.",
              ],                                         //
            ].map(([t, d], i) => (                       //   por cada paso (i = su posición: 0, 1, 2):
              <li key={t} className="text-center">       //
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 font-serif text-2xl text-gold-light">
                  {i + 1}                                //     el número del paso dentro de un círculo (1, 2, 3)
                </span>                                  //
                <p className="mt-5 font-serif text-2xl">{t}</p>
                <p className="mt-2 text-sm text-piedra">{d}</p>
              </li>                                      //
            ))}                                          //
          </ol>                                          //
          <div className="mt-14 text-center">            //
            <Link href="/reservar" className="btn-oro">Reservar mi turno</Link>
          </div>                                         //
        </div>                                           //
      </section>                                         //

      {cfg.sobreMi && (                                  // ─── SOBRE MÍ ─── (solo si se cargó el texto en Configuración)
        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <p className="eyebrow">Sobre mí</p>            //
          {cfg.nombreProfesional && <h2 className="mt-4 font-serif text-4xl">{cfg.nombreProfesional}</h2>}
                                                         //   nombre de la profesional, si está
          <p className="mt-6 leading-relaxed whitespace-pre-line text-piedra">{cfg.sobreMi}</p>
                                                         //   el texto. whitespace-pre-line = respeta los saltos de línea que escribió
        </section>                                       //
      )}                                                 //

      {cfg.videoUrl && (                                 // ─── VIDEO DE PRESENTACIÓN ─── (solo si hay video)
        <section id="presentacion" className="scroll-mt-20 border-t border-linea px-4 py-20 sm:px-6">
          <div className="mb-12 text-center">            //
            <p className="eyebrow">Presentación</p>      //
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Conocenos</h2>
          </div>                                         //
          <VideoPresentacion url={cfg.videoUrl} />       //   el video (capítulo 5b)
        </section>                                       //
      )}                                                 //
    </>                                                  //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/(sitio)/reservar/page.tsx` — la página de reservar (`/reservar`)

Prepara los datos y le pasa todo al formulario `Reserva` (capítulo 5b).

```tsx
import type { Metadata } from "next";                    // Tipo de los datos de la página
import { prisma } from "@/lib/db";                       // La base
import { getConfig } from "@/lib/config";                // Configuración
import { fechaISO, sumarDias } from "@/lib/tiempo";      // Fechas
import { senaPorTransferencia } from "@/lib/sena";       // ¿Hay seña?
import { Reserva } from "@/components/Reserva";          // El formulario de reserva
import { reservarTurno } from "@/app/actions/reservas";  // La acción del servidor que reserva (guía de seguridad)

export const metadata: Metadata = { title: "Reservar turno" };
                                                         // Título de la pestaña: "Reservar turno · MC Healthy Skin"

export default async function ReservarPage({ searchParams }: { searchParams: Promise<{ servicio?: string }> }) {
                                                         // La página. Puede venir ?servicio=… (si tocaron "Reservar" en un tratamiento)
  const { servicio } = await searchParams;               // Lee ?servicio=
  const [cfg, servicios, franjas] = await Promise.all([  // Lee a la vez:
    getConfig(),                                         //   la configuración
    prisma.servicio.findMany({                           //   los tratamientos…
      where: { activo: true },                           //     activos
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],    //     ordenados
      select: { id: true, nombre: true, descripcion: true, categoria: true, duracionMin: true, precio: true },
                                                         //     SOLO estos datos (lo que necesita el formulario; nada de más va al navegador)
    }),                                                  //
    prisma.horarioAtencion.findMany({ select: { diaSemana: true } }),
                                                         //   los días que se atiende
  ]);                                                    //
  const hoy = fechaISO(new Date());                      // Hoy

  return (                                               //
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-10 text-center">                //
        <p className="eyebrow">Turnos online</p>         //
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">Reservá tu turno</h1>
      </div>                                             //
      {servicios.length === 0 || franjas.length === 0 ? (
                                                         // Si no hay tratamientos o no hay horarios cargados…
        <p className="text-center text-piedra">Por el momento no hay turnos disponibles online. Escribinos por WhatsApp.</p>
                                                         // … este mensaje
      ) : (                                              // Si hay, el formulario con todos sus datos:
        <Reserva                                         //
          servicios={servicios}                          //   los tratamientos
          servicioInicial={servicio}                     //   el que ya viene elegido (si vino ?servicio=)
          diasAtencion={[...new Set(franjas.map((f) => f.diaSemana))]}
                                                         //   los días de atención sin repetir (ej: [6] = solo sábados)
          desde={hoy}                                    //   desde hoy
          hasta={sumarDias(hoy, cfg.diasMaxReserva)}     //   hasta dentro de 45 días
          sena={{ tipo: cfg.senaTipo, valor: cfg.senaValor, activa: senaPorTransferencia(cfg) }}
                                                         //   los datos de la seña
          politica={cfg.politicaCancelacion}             //   la política de cancelación
          accion={reservarTurno}                         //   QUÉ HACER al confirmar: llamar a reservarTurno en el servidor
        />                                               //
      )}                                                 //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/(sitio)/reserva/[id]/page.tsx` — la página de "mi turno"

Es la página a la que llega la clienta después de reservar, o desde el link del mail. **Solo se ve con el token secreto correcto.**

```tsx
import type { Metadata } from "next";                    // Tipo de los datos de la página
import Link from "next/link";                            // Links
import { notFound } from "next/navigation";              // Para mostrar "Página no encontrada"
import { prisma } from "@/lib/db";                       // La base
import { getConfig } from "@/lib/config";                // Configuración
import { fechaHoraLarga } from "@/lib/tiempo";           // "sábado 3 de octubre, 09:30 hs"
import { formatDuracion, formatPrecio, linkWhatsapp } from "@/lib/formato";
                                                         // Formatos
import { mensajeComprobante } from "@/lib/plantillas-email";
                                                         // El mensaje de WhatsApp para el comprobante
import { BotonCancelar } from "@/components/BotonCancelar";
                                                         // El botón de cancelar (capítulo 5b)
import { Copiar } from "@/components/Copiar";            // El cuadro con botón "Copiar" (capítulo 5b)

export const metadata: Metadata = { title: "Mi turno", robots: { index: false } };
                                                         // Título "Mi turno". index:false = que Google NUNCA la muestre (es privada)

interface Props {                                        // Lo que recibe la página:
  params: Promise<{ id: string }>;                       //   el [id] de la dirección
  searchParams: Promise<{ t?: string }>;                 //   el ?t= (token secreto)
}                                                        //

export default async function TurnoPage({ params, searchParams }: Props) {
  const { id } = await params;                           // Lee el id del turno
  const { t: token } = await searchParams;               // Lee el token

  const turno = await prisma.turno.findUnique({ where: { id }, include: { servicio: true, clienta: true } });
                                                         // Busca el turno, con tratamiento y clienta
  if (!turno || !token || turno.token !== token) notFound();
                                                         // SEGURIDAD: si no existe, no vino token o el token no coincide → "Página no encontrada" (no dice cuál de las tres)

  const cfg = await getConfig();                         // Configuración
  const ahora = new Date();                              // Ahora
  const pendiente = turno.estado === "PENDIENTE_PAGO";   // ¿Espera la seña?
  const vencido = pendiente && turno.expiraEn !== null && turno.expiraEn < ahora;
                                                         // ¿Esperaba la seña y ya se le pasó el plazo?
  const futuro = turno.inicio > ahora;                   // ¿El turno todavía no pasó?

  const estados = {                                      // Ícono, título y texto según el estado:
    CONFIRMADO: { icono: "✓", titulo: "¡Turno confirmado!", texto: `Te enviamos los detalles a ${turno.clienta.email}.` },
    PENDIENTE_PAGO: vencido                              //   esperando seña: depende de si venció
      ? { icono: "!", titulo: "La reserva venció", texto: "No recibimos la seña a tiempo y el horario se liberó. Si ya la transferiste, escribinos por WhatsApp." }
      : { icono: "…", titulo: "¡Turno reservado!", texto: "Para confirmarlo, transferí la seña y mandanos la captura por WhatsApp." },
    CANCELADO: { icono: "×", titulo: "Turno cancelado", texto: "Este turno fue cancelado." },
    COMPLETADO: { icono: "✓", titulo: "Turno realizado", texto: "¡Gracias por tu visita!" },
    AUSENTE: { icono: "!", titulo: "Turno no asistido", texto: "" },
  }[turno.estado];                                       // … y se elige el del estado actual del turno

  const filas: [string, string][] = [                    // Las filas de datos [título, valor]:
    ["Tratamiento", turno.servicio.nombre],              //
    ["Fecha", fechaHoraLarga(turno.inicio)],             //
    ["Duración", formatDuracion(turno.servicio.duracionMin)],
    ["Precio", formatPrecio(turno.precio)],              //
    ...(turno.montoSena ? [[pendiente ? "Seña a transferir" : "Seña", formatPrecio(turno.montoSena)] as [string, string]] : []),
                                                         //   la seña, solo si hay ("..." agrega la fila o nada)
    ...(cfg.direccion ? [["Dirección", cfg.direccion] as [string, string]] : []),
                                                         //   la dirección, solo si hay
  ];                                                     //

  return (                                               //
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-linea bg-carbon p-6 text-center sm:p-10">
                                                         // La tarjeta
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/60 font-serif text-3xl text-gold-light">
          {estados.icono}                                //   el ícono en un círculo dorado
        </span>                                          //
        <h1 className="mt-6 font-serif text-4xl">{estados.titulo}</h1>
                                                         //   el título
        {estados.texto && <p className="mt-3 text-piedra">{estados.texto}</p>}
                                                         //   el texto, si hay

        {pendiente && !vencido && (                      //   SI ESPERA LA SEÑA (y no venció), los datos para transferir:
          <div className="mt-8 space-y-3 text-left">     //
            <p className="text-center font-serif text-2xl text-gold-light">Seña: {formatPrecio(turno.montoSena)}</p>
            {cfg.alias && <Copiar etiqueta="Alias" valor={cfg.alias} />}
                                                         //     alias con botón "Copiar"
            {cfg.cbu && <Copiar etiqueta="CBU / CVU" valor={cfg.cbu} />}
                                                         //     CBU con botón "Copiar"
            {(cfg.titularCuenta || cfg.banco) && (       //     titular y banco, si hay alguno:
              <p className="px-1 text-sm text-piedra">   //
                {cfg.titularCuenta && <>Titular: <span className="text-cream">{cfg.titularCuenta}</span></>}
                {cfg.titularCuenta && cfg.banco && " · "}
                                                         //       el separador solo si están los dos
                {cfg.banco && <>Banco: <span className="text-cream">{cfg.banco}</span></>}
              </p>                                       //
            )}                                           //
            {turno.expiraEn && (                         //     el plazo:
              <p className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm first-letter:uppercase">
                ⏰ Tenés tiempo hasta el <strong>{fechaHoraLarga(turno.expiraEn)}</strong>. Si no recibimos la seña, el horario se libera.
              </p>                                       //
            )}                                           //
            {cfg.whatsapp && (                           //     el botón de WhatsApp para mandar el comprobante:
              <a                                         //
                href={linkWhatsapp(cfg.whatsapp, mensajeComprobante(turno))}
                                                         //       abre WhatsApp con el mensaje ya escrito
                target="_blank"                          //       en otra pestaña
                rel="noopener"                           //
                className="btn-oro mt-2 w-full"          //
              >                                          //
                Enviar comprobante por WhatsApp          //
              </a>                                       //
            )}                                           //
            <p className="text-center text-xs text-piedra">
              Te mandamos estos datos también a {turno.clienta.email}. Cuando confirmemos la seña te llega otro mail.
            </p>                                         //
          </div>                                         //
        )}                                               //

        <dl className="mt-8 space-y-3 border-y border-linea py-6 text-left text-sm">
                                                         //   LOS DATOS DEL TURNO. dl = "lista de definiciones" (título → valor)
          {filas.map(([k, v]) => (                       //   por cada fila:
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-piedra">{k}</dt>       //     el título a la izquierda
              <dd className="text-right first-letter:uppercase">{v}</dd>
                                                         //     el valor a la derecha, con la primera letra en mayúscula
            </div>                                       //
          ))}                                            //
        </dl>                                            //

        <div className="mt-8 flex flex-col items-center gap-5">
                                                         //   BOTONES DE ABAJO:
          {(turno.estado === "CANCELADO" || vencido) && <Link href="/reservar" className="btn-oro">Reservar otro turno</Link>}
                                                         //     si se canceló o venció: "Reservar otro turno"
          {cfg.whatsapp && !(pendiente && !vencido) && (  //     si hay WhatsApp y no está esperando la seña:
            <a href={linkWhatsapp(cfg.whatsapp, `Hola! Tengo una consulta sobre mi turno de ${turno.servicio.nombre} del ${fechaHoraLarga(turno.inicio)}`)}
              target="_blank" rel="noopener" className="btn-linea">Escribir por WhatsApp</a>
                                                         //     botón de consulta con el turno ya mencionado
          )}                                             //
          {(turno.estado === "CONFIRMADO" || (pendiente && !vencido)) && futuro && <BotonCancelar turnoId={turno.id} token={turno.token} />}
                                                         //     botón "Cancelar turno", solo si está activo y todavía no pasó
        </div>                                           //
      </div>                                             //
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## `src/app/not-found.tsx` — "Página no encontrada"

Se muestra cuando la dirección no existe, o cuando el código llama a `notFound()`.

```tsx
import Link from "next/link";                            // Links

export default function NotFound() {                     // La página
  return (                                               //
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
                                                         // Contenido centrado, al menos el 70% de la altura de la pantalla
      <p className="eyebrow">Error 404</p>               // "404" es el código universal de "no encontrado"
      <h1 className="mt-4 font-serif text-5xl">Página no encontrada</h1>
      <Link href="/" className="btn-linea mt-8">Volver al inicio</Link>
    </div>                                               //
  );                                                     //
}                                                        // Fin
```

---

## Las piezas del servidor que usa el sitio público

Están explicadas línea por línea en la [guía de seguridad](../guia-codigo-seguridad.md):
- **`src/app/actions/reservas.ts`:** `reservarTurno` y `cancelarPorClienta`.
- **`src/app/api/disponibilidad/route.ts`:** los horarios libres para el calendario.
- **`src/app/error.tsx` y `src/app/global-error.tsx`:** las pantallas de "algo salió mal".
