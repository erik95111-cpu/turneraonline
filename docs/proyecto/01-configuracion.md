# Capítulo 1 · Configuración

Antes de escribir una sola pantalla, un proyecto necesita decir **qué piezas usa** y **cómo se ajustan**.
Eso es este capítulo.

---

## `package.json` — la lista de piezas y comandos

Es lo primero que se crea. Le dice a `npm` (el instalador de bibliotecas) qué tiene que bajar y qué comandos existen.
El formato JSON no admite comentarios: los de esta guía son solo para explicar.

```jsonc
{
  "name": "healthy-skin-turnos",                         // Nombre interno del proyecto
  "version": "1.0.0",                                    // Versión del proyecto
  "private": true,                                       // "No publicar en npm": es nuestro, no una biblioteca para otros
  "description": "Sistema de turnos online para MC Healthy Skin - Dermatocosmiatría",
                                                         // Descripción
  "scripts": {                                           // COMANDOS. Se usan con "npm run <nombre>"
    "dev": "next dev",                                   // npm run dev → la página en tu compu, se recarga sola al cambiar el código
    "build": "prisma generate && next build",            // npm run build → prepara Prisma y compila la versión final ("&&" = y después)
    "start": "next start",                               // npm start → corre la versión ya compilada
    "lint": "tsc --noEmit",                              // npm run lint → TypeScript revisa todo el código buscando errores, sin generar archivos
    "test": "vitest run",                                // npm test → corre las pruebas automáticas
    "db:push": "prisma db push",                         // Copia el plano de la base directo a la base (atajo para pruebas)
    "db:migrate": "prisma migrate deploy",               // Aplica las migraciones pendientes a la base
    "db:seed": "tsx prisma/seed.ts",                     // Carga los datos iniciales (tratamientos, horarios)
    "postinstall": "prisma generate",                    // Se ejecuta solo después de "npm install": genera el código de Prisma
    "vercel-build": "sh scripts/vercel-build.sh"         // El comando que usa Vercel al publicar (ver capítulo 7)
  },                                                     // Fin de los comandos
  "prisma": {                                            // Ajustes de Prisma
    "seed": "tsx prisma/seed.ts"                         // Qué archivo carga los datos iniciales
  },                                                     //
  "dependencies": {                                      // Bibliotecas que la página NECESITA para funcionar
    "@prisma/client": "^6.19.3",                         // Prisma: habla con la base de datos. "^6.19.3" = versión 6.19.3 o una 6.x más nueva
    "date-fns": "^4.4.0",                                // Herramientas para trabajar con fechas
    "date-fns-tz": "^3.2.0",                             // Lo mismo, pero con zonas horarias (hora de Argentina)
    "jose": "^6.2.12",                                   // Tokens de sesión firmados (JWT)
    "next": "^15.5.27",                                  // Next.js: el armazón de la página
    "nodemailer": "^7.0.13",                             // Envío de mails
    "react": "^19.3.0",                                  // React: para escribir las pantallas
    "react-dom": "^19.3.0",                              // La parte de React que dibuja en el navegador
    "server-only": "^0.0.1",                             // El "candado" que impide usar código del servidor en el navegador
    "zod": "^3.25.76"                                    // Revisa que los datos tengan el formato correcto (email válido, etc.)
  },                                                     //
  "devDependencies": {                                   // Bibliotecas que solo se usan para DESARROLLAR (no van a la página final)
    "@tailwindcss/postcss": "^4.3.3",                    // Conecta Tailwind con el procesador de estilos
    "@types/node": "^22.20.5",                           // "Tipos" de Node para TypeScript (para que entienda process.env, etc.)
    "@types/nodemailer": "^8.0.2",                       // Tipos de nodemailer
    "@types/react": "^19.3.0",                           // Tipos de React
    "@types/react-dom": "^19.3.0",                       // Tipos de react-dom
    "postcss": "^8.5.28",                                // Procesador de estilos CSS
    "prisma": "^6.19.3",                                 // La herramienta de línea de comandos de Prisma (migraciones, generate)
    "tailwindcss": "^4.3.3",                             // Tailwind: estilos con clases como "text-sm" o "bg-gold"
    "tsx": "^4.23.15",                                   // Permite correr archivos TypeScript directo (lo usa el seed)
    "typescript": "^5.9.3",                              // TypeScript
    "vitest": "^3.2.7"                                   // Las pruebas automáticas
  },                                                     //
  "engines": {                                           // Requisitos
    "node": ">=20"                                       // Necesita Node versión 20 o más nueva
  }                                                      //
}
```

> `package-lock.json` es un archivo enorme que genera `npm` solo. Anota la versión **exacta** de cada biblioteca, para que en tu compu y en Vercel se instale lo mismo. No se edita a mano.

---

## `tsconfig.json` — las reglas de TypeScript

```jsonc
{
  "compilerOptions": {                                   // Opciones del "compilador" (el que revisa y traduce TypeScript)
    "target": "ES2022",                                  // Qué versión de JavaScript generar (2022: moderna)
    "lib": ["dom", "dom.iterable", "esnext"],            // Qué cosas conoce: el navegador (dom) y lo último de JavaScript
    "allowJs": false,                                    // No se aceptan archivos .js sueltos: todo en TypeScript
    "skipLibCheck": true,                                // No revisar los tipos internos de las bibliotecas (más rápido)
    "strict": true,                                      // MODO ESTRICTO: TypeScript es exigente y atrapa más errores
    "noEmit": true,                                      // Solo revisa; la traducción la hace Next.js
    "esModuleInterop": true,                             // Permite importar bibliotecas viejas con la sintaxis moderna
    "module": "esnext",                                  // Usa "import/export" modernos
    "moduleResolution": "bundler",                       // Busca los archivos como lo hace Next.js
    "resolveJsonModule": true,                           // Permite importar archivos .json
    "isolatedModules": true,                             // Cada archivo se tiene que poder traducir solo (lo exige Next.js)
    "jsx": "preserve",                                   // Deja el HTML-dentro-de-código (JSX) tal cual: lo procesa Next.js
    "incremental": true,                                 // Recuerda lo ya revisado para ir más rápido la próxima vez
    "plugins": [{ "name": "next" }],                     // Agrega las reglas especiales de Next.js
    "paths": { "@/*": ["./src/*"] }                      // ATAJO: "@/lib/db" quiere decir "src/lib/db". Evita escribir "../../../"
  },                                                     //
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
                                                         // Qué archivos revisar: todos los .ts y .tsx
  "exclude": ["node_modules"]                            // Menos la carpeta de bibliotecas
}
```

---

## `next.config.ts` — los ajustes de Next.js

Ya está explicado línea por línea en la guía de seguridad (sección "Extra · next.config.ts").
Resumen: agrega encabezados de seguridad a todas las páginas y oculta que el sitio está hecho con Next.js.

---

## `postcss.config.mjs` — conectar Tailwind

```js
export default {                                         // Exporta la configuración
  plugins: { "@tailwindcss/postcss": {} },               // Activa Tailwind dentro del procesador de estilos (PostCSS), sin opciones extra
};                                                       // Fin
```

---

## `vercel.json` — tareas programadas en Vercel

```jsonc
{
  "crons": [{ "path": "/api/cron/recordatorios", "schedule": "0 13 * * *" }]
                                                         // Todos los días llama a /api/cron/recordatorios (manda los recordatorios).
                                                         // "0 13 * * *" = minuto 0, hora 13 UTC, todos los días = 10:00 de Argentina
}
```

---

## `.env.example` — modelo de las variables

Es un **modelo** de las variables de entorno: no tiene valores reales.
Para trabajar en tu compu se copia como `.env` y se completa.
En Vercel, las mismas variables se cargan en Settings → Environment Variables.
En este formato, `#` es comentario.

```sh
DATABASE_URL="postgresql://usuario:password@localhost:5432/healthyskin"
                                                         # Dirección de la base CON usuario y contraseña. En Vercel la carga Neon sola
DATABASE_URL_UNPOOLED="postgresql://usuario:password@localhost:5432/healthyskin"
                                                         # Conexión directa a la base (sin "pool"): la usan las migraciones
NEXT_PUBLIC_SITE_URL="http://localhost:3000"             # Dirección pública del sitio. "NEXT_PUBLIC_" = SÍ llega al navegador (por eso nunca se usa para claves)
ADMIN_PASSWORD="cambiar-esta-clave"                      # Contraseña del acceso de emergencia "admin"
AUTH_SECRET="cambiar-por-una-cadena-larga-y-aleatoria"   # Clave que firma las sesiones. Larga y al azar
SMTP_HOST="smtp.gmail.com"                               # Servidor de mail de Gmail
SMTP_PORT="465"                                          # Puerto de Gmail (465 = conexión cifrada)
SMTP_USER="tucuenta@gmail.com"                           # La cuenta de Gmail que manda los mails
SMTP_PASS="xxxx xxxx xxxx xxxx"                          # La "contraseña de aplicación" de Gmail (16 letras)
EMAIL_FROM="MC Healthy Skin <tucuenta@gmail.com>"        # Cómo aparece el remitente
CRON_SECRET="otra-cadena-aleatoria"                      # Clave que solo conoce Vercel, para que nadie más dispare los recordatorios
```

---

## `.gitignore` — lo que NO se sube a GitHub

```sh
node_modules/                                            # Las bibliotecas descargadas (pesan mucho; se bajan con npm install)
.next/                                                   # La página compilada (se genera sola)
out/                                                     # Otra carpeta de compilación
build/                                                   # Ídem
coverage/                                                # Informes de las pruebas
*.tsbuildinfo                                            # Memoria interna de TypeScript
next-env.d.ts                                            # Archivo que genera Next.js solo
.env                                                     # ¡LAS CLAVES REALES! Nunca se suben a GitHub
.env.local                                               # Ídem
.env*.local                                              # Ídem, cualquier variante
.vercel                                                  # Datos locales de Vercel
.DS_Store                                                # Archivo basura de Mac
npm-debug.log*                                           # Registros de errores de npm
```

---

## `vitest.config.ts` — configuración de las pruebas

```ts
import { defineConfig } from "vitest/config";            // Trae la función para configurar Vitest (las pruebas)
import path from "node:path";                            // Herramienta para armar rutas de carpetas

export default defineConfig({                            // Exporta la configuración
  resolve: {                                             // Cómo encontrar los archivos:
    alias: {                                             //   atajos
      "@": path.resolve(__dirname, "src"),               //   "@" = la carpeta src (igual que en tsconfig)
      "server-only": path.resolve(__dirname, "vitest.server-only.ts"),
                                                         //   en las pruebas, el candado "server-only" se cambia por un archivo vacío (fuera de Next.js daría error)
    },                                                   //
  },                                                     //
  test: {                                                // Opciones de las pruebas:
    environment: "node",                                 //   corren como servidor (no simulan un navegador)
    include: ["src/**/*.test.ts"],                       //   son pruebas los archivos que terminan en ".test.ts"
    setupFiles: ["./vitest.setup.ts"],                   //   antes de empezar, ejecutar este archivo
    fileParallelism: false,                              //   un archivo de pruebas a la vez (comparten la base de prueba)
  },                                                     //
});                                                      // Fin
```

## `vitest.setup.ts` — preparación de las pruebas

```ts
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
                                                         // Si hay una base de PRUEBA configurada, todo el código usa esa en vez de la real. Las pruebas la borran: nunca apuntarla a la base real
```

## `vitest.server-only.ts` — el reemplazo vacío

```ts
export {};                                               // Un archivo que no hace nada. Reemplaza al candado "server-only" durante las pruebas
```
