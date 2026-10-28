# Guía de lectura · el código de seguridad, línea por línea

Esta guía recorre todo el código que se escribió en la revisión de seguridad.
Cada línea tiene al lado, después de `//`, una explicación de qué hace.

> **Cómo leerla:** lo que está a la izquierda es el código real, tal cual está en el proyecto.
> Lo que está a la derecha de `//` (o de `--` en SQL y de `#` en los scripts) es la explicación.
> En el proyecto real, esas explicaciones no están: las agregué solo para esta guía. Algunas líneas ya tenían en el proyecto un comentario corto al lado; acá lo reemplacé por la explicación larga.
> Los bloques de comentarios largos que abren cada archivo no se repiten acá: los reemplaza el texto de arriba de cada archivo.

---

## Antes de empezar: mini diccionario

Estas palabras aparecen todo el tiempo. Conviene leerlas primero.

| Palabra | Qué significa |
|---|---|
| `import … from "…"` | Trae código de otro archivo o de una biblioteca para usarlo acá |
| `export` | Deja que otros archivos usen esta función o valor |
| `const x = …` | Crea una "cajita" con nombre `x` que guarda un valor que no cambia |
| `let x` | Igual que `const`, pero el valor se puede cambiar después |
| `function nombre(a, b) { … }` | Define una función: un conjunto de pasos que recibe datos (`a`, `b`) |
| `(a) => …` | Otra forma, más corta, de escribir una función |
| `return …` | Termina la función y devuelve ese resultado |
| `async` / `await` | `async` marca una función que hace cosas que tardan (ir a la base, internet). `await` significa "esperá a que termine esto antes de seguir" |
| `if (condición) …` | "Si pasa esto, hacé aquello" |
| `!x` | "No x". `!sesion` = "no hay sesión" |
| `a && b` | "a Y b" (las dos tienen que cumplirse) |
| `a \|\| b` | "a O b" (alcanza con una) |
| `a ?? b` | "Usá a; si a no existe, usá b" |
| `a?.b` | "Leé b dentro de a, pero si a no existe no explotes: devolvé nada" |
| `===` / `!==` | "Es igual a" / "es distinto de" |
| `try { … } catch (err) { … }` | "Intentá esto; si falla, en vez de romper todo, hacé esto otro". `err` es el error |
| `throw` | "Tirar" un error a propósito para frenar todo |
| `` `Hola ${nombre}` `` | Texto con un valor metido adentro (si `nombre` es "Ana", queda "Hola Ana") |
| `{ a: 1, b: 2 }` | Un objeto: un paquete de datos con nombre (`a` vale 1, `b` vale 2) |
| `[1, 2, 3]` | Una lista |
| `{ ...x, y: 1 }` | Copia todo lo que tiene `x` y le agrega o pisa `y` |
| `process.env.ALGO` | Lee una variable de entorno (las que cargás en Vercel → Environment Variables) |
| `: string`, `: number`, `: boolean` | TypeScript: dice de qué tipo es un dato (texto, número, verdadero/falso) |
| `Promise<X>` | "Esto va a devolver X, pero más tarde" (va de la mano con `async`) |
| `null` | "Nada", "vacío" |
| `prisma.tabla.algo(…)` | Prisma es la biblioteca que habla con la base de datos. `prisma.turno.findMany()` = "traeme turnos" |
| `/.../` | Una "expresión regular": un patrón para buscar dentro de un texto |

---

## Mapa: qué archivo resuelve cada punto

| Punto | Archivo(s) |
|---|---|
| 1. La clave no va en el navegador | `server-only` en varios archivos · `scripts/verificar-secretos.mjs` · `scripts/vercel-build.sh` |
| 2. RLS en todas las tablas | `prisma/rls.sql` |
| 3. Cerrar sesión | `src/lib/auth.ts` (`cerrarSesion`) · `src/app/admin/acciones.ts` (`salir`) · `src/middleware.ts` |
| 4. Login | `src/app/admin/login/page.tsx` · `src/lib/limite-login.ts` · `src/lib/auth.ts` · `src/lib/passwords.ts` |
| 6. Planes B (fallbacks) | `src/app/actions/reservas.ts` · `src/app/api/disponibilidad/route.ts` · `src/app/error.tsx` · `src/components/Reserva.tsx` · `src/lib/turnos.ts` |
| 7. Etiquetas [APP] / [LIB] | `src/lib/log.ts` |
| Extra: encabezados | `next.config.ts` |

---

# Punto 7 · `src/lib/log.ts` — etiquetas [APP] / [LIB]

Lo vemos primero porque todos los demás archivos lo usan.
**Para qué sirve:** cuando algo falla, escribe en el registro (Vercel → Logs) una línea que arranca con una etiqueta que dice si el problema es nuestro (`[APP]`) o de una biblioteca externa (`[LIB:…]`).

```ts
export type Origen = "APP" | "LIB:prisma" | "LIB:nodemailer" | "LIB:jose" | "LIB:red" | "LIB:otra";
                                                         // Define la lista cerrada de etiquetas posibles. "|" = "o". Si alguien escribe una etiqueta que no está acá, TypeScript avisa

export class ErrorApp extends Error {                    // Crea un tipo de error propio, "hijo" del error común de JavaScript
  override name = "ErrorApp";                            // Le pone nombre, para reconocerlo en el log
}                                                        // Fin. Se usa para errores ESPERADOS de nuestro código ("ese horario ya está ocupado")

export function origenDelError(err: unknown): Origen {   // Función que recibe un error cualquiera ("unknown" = no sabemos qué es) y devuelve una etiqueta
  if (err instanceof ErrorApp) return "APP";             // Si es uno de nuestros errores → [APP]
  if (!(err instanceof Error)) return "APP";             // Si ni siquiera es un error de verdad (alguien tiró un texto suelto) → lo tratamos como nuestro

  const e = err as Error & { code?: unknown; responseCode?: unknown; command?: unknown };
                                                         // Le decimos a TypeScript: "este error puede traer además code, responseCode y command" (las bibliotecas los agregan)
  const code = typeof e.code === "string" ? e.code : ""; // Si el error trae un código de texto lo guardamos; si no, texto vacío. "? :" = "si… entonces… si no…"

  if (e.name.startsWith("PrismaClient") || /^P\d{4}$/.test(code)) return "LIB:prisma";
                                                         // Si el nombre empieza con "PrismaClient" O el código es "P" + 4 números (P1001, P2002) → es la base de datos
  if (code.startsWith("ERR_JW")) return "LIB:jose";      // Si el código empieza con "ERR_JW" (ERR_JWT_EXPIRED…) → es la biblioteca de tokens de sesión
  if (e.responseCode !== undefined || e.command !== undefined || /^E(AUTH|ENVELOPE|MESSAGE|SOCKET|CONNECTION|DNS|TLS)$/.test(code)) {
                                                         // Si trae respuesta del servidor de mail, o un código tipo EAUTH (login de Gmail rechazado)…
    return "LIB:nodemailer";                             // … → es el envío de mails
  }                                                      // Fin del if
  if (/^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)$/.test(code) || /failed to fetch|network ?error|load failed/i.test(e.message)) {
                                                         // Si es un código de conexión cortada, o el mensaje dice "Failed to fetch" (el navegador se quedó sin internet)…
    return "LIB:red";                                    // … → problema de red
  }                                                      // Fin del if
  const primeraLinea = e.stack?.split("\n").find((l) => l.trim().startsWith("at "));
                                                         // "stack" es el recorrido del error: dónde nació. Agarramos la primera línea que dice "at …" (el lugar exacto)
  if (primeraLinea?.includes("node_modules")) return "LIB:otra";
                                                         // node_modules es la carpeta de las bibliotecas externas. Si el error nació ahí → [LIB:otra]
  return "APP";                                          // Si no encajó en nada de lo anterior → asumimos que es nuestro código
}                                                        // Fin de la función

function mensaje(err: unknown): string {                 // Función interna (sin export): arma el texto del error en una línea
  const texto = err instanceof Error ? err.message : typeof err === "string" ? err : String(JSON.stringify(err));
                                                         // Si es un error, usa su mensaje; si es texto, el texto; si es otra cosa, la convierte a texto
  return texto.replace(/\s+/g, " ").trim().slice(0, 300);
                                                         // Cambia saltos de línea y espacios repetidos por un solo espacio, saca espacios de las puntas y corta en 300 letras
}                                                        // Fin

export function logError(donde: string, err: unknown): Origen {
                                                         // Función principal para registrar un ERROR. "donde" = qué estaba haciendo (ej: "reserva")
  const origen = origenDelError(err);                    // Averigua la etiqueta con la función de arriba
  console.error(`[${origen}][ERROR] ${donde} · ${mensaje(err)}`, err);
                                                         // Escribe en el log, por ejemplo: "[LIB:prisma][ERROR] reserva · Can't reach database server", y atrás el error completo
  return origen;                                         // Devuelve la etiqueta, por si quien la llamó quiere mostrar un mensaje distinto según el origen
}                                                        // Fin

export function logWarn(donde: string, detalle?: unknown, origen?: Origen): void {
                                                         // Igual, pero para AVISOS (algo raro que no rompió nada). "?" = dato opcional. "void" = no devuelve nada
  const o = origen ?? (detalle instanceof Error ? origenDelError(detalle) : "APP");
                                                         // Si nos pasaron la etiqueta la usamos; si no, la calculamos; si no hay error, ponemos APP
  console.warn(`[${o}][WARN] ${donde}${detalle === undefined ? "" : ` · ${mensaje(detalle)}`}`);
                                                         // Escribe "[APP][WARN] …". Si hay detalle, lo agrega después de "·"
}                                                        // Fin
```

---

# Punto 1 · Claves fuera del navegador

## `src/lib/db.ts` — la conexión a la base

**Para qué sirve:** crea la conexión a la base de datos que usa todo el proyecto.

```ts
import "server-only";                                    // CANDADO: si un componente del navegador intenta importar este archivo, la compilación falla
import { PrismaClient } from "@prisma/client";           // Trae Prisma, la biblioteca que habla con la base
import { completarVariablesDB } from "./env-db";         // Trae una función nuestra que acomoda los nombres de las variables de la base

completarVariablesDB();                                  // La ejecuta: Neon y Vercel usan nombres distintos para la misma variable, esto los unifica

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
                                                         // "globalThis" es un lugar compartido por todo el programa. Ahí guardamos la conexión para reusarla

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
                                                         // Si ya hay una conexión guardada la reusa; si no (??), crea una nueva

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
                                                         // En desarrollo (tu compu) la guarda, para no abrir cientos de conexiones cada vez que se recarga el código
```

## `src/lib/passwords.ts` — las contraseñas

**Para qué sirve:** guarda las contraseñas "picadas" (hash), nunca en texto normal, y las compara de forma segura.

```ts
import "server-only";                                    // Candado: sólo servidor
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
                                                         // Trae herramientas de criptografía que vienen con Node: números al azar, scrypt (picador de contraseñas) y comparación segura
import { promisify } from "node:util";                   // Herramienta para poder usar scrypt con "await"

const scrypt = promisify(scryptCb) as (pass: string, salt: Buffer, keylen: number) => Promise<Buffer>;
                                                         // Versión de scrypt que se puede "esperar" con await
const LARGO = 64;                                        // El resultado picado mide 64 bytes

export async function hashPassword(plano: string): Promise<string> {
                                                         // Recibe la contraseña escrita ("plano") y devuelve el texto para guardar en la base
  const sal = randomBytes(16);                           // "Sal": 16 bytes al azar. Hace que dos personas con la misma contraseña tengan hashes distintos
  const hash = await scrypt(plano, sal, LARGO);          // Pica la contraseña junto con la sal. Es lento a propósito: adivinar por fuerza bruta cuesta muchísimo
  return `scrypt$${sal.toString("base64")}$${hash.toString("base64")}`;
                                                         // Arma "scrypt$<sal>$<hash>" en texto. Esto es lo que se guarda: de acá NO se puede sacar la contraseña
}                                                        // Fin

export async function verificarPassword(plano: string, guardado: string): Promise<boolean> {
                                                         // Revisa si la contraseña escrita coincide con la guardada. Devuelve true/false
  const [alg, sal64, hash64] = guardado.split("$");      // Separa el texto guardado por "$" en sus 3 partes
  if (alg !== "scrypt" || !sal64 || !hash64) return false;
                                                         // Si el formato no es el esperado → no coincide
  const esperado = Buffer.from(hash64, "base64");        // Convierte el hash guardado de texto a bytes
  const calculado = await scrypt(plano, Buffer.from(sal64, "base64"), esperado.length);
                                                         // Pica la contraseña escrita con LA MISMA sal que se usó al guardarla
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
                                                         // Compara los dos resultados. timingSafeEqual tarda siempre lo mismo, así nadie puede adivinar midiendo el tiempo
}                                                        // Fin

export function igualesSeguro(a: string, b: string): boolean {
                                                         // Compara dos textos (ej: ADMIN_PASSWORD) también en tiempo constante
  const x = Buffer.from(a);                              // Texto 1 → bytes
  const y = Buffer.from(b);                              // Texto 2 → bytes
  return x.length === y.length && timingSafeEqual(x, y); // Iguales sólo si miden lo mismo y todos los bytes coinciden
}                                                        // Fin
```

## `scripts/verificar-secretos.mjs` — el chequeo antes de publicar

**Para qué sirve:** después de compilar, busca cada clave dentro de los archivos que descarga el navegador. Si encuentra una, corta el deploy.

```js
import { readdirSync, readFileSync, statSync } from "node:fs";
                                                         // Herramientas para leer carpetas y archivos del disco
import { join } from "node:path";                        // Herramienta para armar rutas de archivos ("carpeta/archivo")

const SECRETAS = [                                       // Lista de los NOMBRES de las variables secretas a buscar
  "AUTH_SECRET",                                         // La clave que firma las sesiones
  "ADMIN_PASSWORD",                                      // La contraseña de emergencia
  "CRON_SECRET",                                         // La clave del recordatorio automático
  "SMTP_PASS",                                           // La contraseña de aplicación de Gmail
  "DATABASE_URL",                                        // La dirección de la base, CON usuario y contraseña adentro
  "DATABASE_URL_UNPOOLED",                               // Otra versión de la dirección de la base
  "POSTGRES_URL",                                        // Nombres alternativos que usan algunas integraciones de Vercel
  "POSTGRES_PRISMA_URL",                                 // (ídem)
  "POSTGRES_URL_NON_POOLING",                            // (ídem)
  "POSTGRES_PASSWORD",                                   // (ídem)
];                                                       // Fin de la lista
const CARPETA = ".next/static";                          // La carpeta donde Next.js deja los archivos que se mandan al navegador

function archivos(dir) {                                 // Función: devuelve TODOS los archivos de una carpeta, también los de sus subcarpetas
  return readdirSync(dir).flatMap((n) => {               // Lee lo que hay en la carpeta y, por cada cosa "n"…
    const p = join(dir, n);                              // … arma su ruta completa
    return statSync(p).isDirectory() ? archivos(p) : [p];
                                                         // Si es una carpeta, se llama a sí misma para entrar; si es archivo, lo agrega a la lista
  });                                                    // flatMap junta todo en una sola lista
}                                                        // Fin

const buscar = SECRETAS.map((nombre) => ({ nombre, valor: process.env[nombre]?.trim() ?? "" })).filter((s) => s.valor.length >= 8);
                                                         // Por cada nombre, lee el VALOR real de la variable. Se queda sólo con las que tienen 8 letras o más (una muy corta aparecería por casualidad)

let lista;                                               // Acá va a ir la lista de archivos
try {                                                    // Intentamos…
  lista = archivos(CARPETA);                             // … listar los archivos del navegador
} catch {                                                // Si falla (la carpeta no existe porque no se compiló)…
  console.error(`[APP][ERROR] verificar-secretos · no existe ${CARPETA}: correr después de "next build"`);
                                                         // … avisa en el log
  process.exit(1);                                       // … y termina con error (1 = falló). En Vercel, esto corta el deploy
}                                                        // Fin

const filtrados = [];                                    // Lista vacía donde anotamos cada clave encontrada
for (const archivo of lista) {                           // Recorremos archivo por archivo
  const contenido = readFileSync(archivo, "utf8");       // Leemos su contenido como texto
  for (const s of buscar) {                              // Por cada clave a buscar…
    if (contenido.includes(s.valor)) filtrados.push(`${s.nombre} → ${archivo}`);
                                                         // … si el texto del archivo la contiene, la anotamos: "AUTH_SECRET → archivo.js"
  }                                                      // Fin del recorrido de claves
}                                                        // Fin del recorrido de archivos

if (filtrados.length) {                                  // Si se encontró al menos una…
  console.error("[APP][ERROR] verificar-secretos · ¡Hay claves dentro de los archivos del navegador!");
                                                         // … avisa fuerte
  for (const f of filtrados) console.error("   ", f);    // … muestra cuál y dónde
  process.exit(1);                                       // … y corta el deploy
}                                                        // Fin
console.log(`verificar-secretos · OK: ${buscar.length} claves revisadas en ${lista.length} archivos del navegador, ninguna expuesta.`);
                                                         // Si llegó hasta acá, todo bien: lo informa
```

## `scripts/vercel-build.sh` — los pasos de cada deploy en Vercel

**Para qué sirve:** es la lista de pasos que corre Vercel cada vez que publicás. Si un paso falla, el deploy se corta.

```sh
#!/bin/sh                                                # Indica que es un script para la terminal (shell)
set -e                                                   # "Si cualquier paso falla, frená todo". Así nunca se publica algo a medias
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-$POSTGRES_URL}}"
                                                         # Si DATABASE_URL está vacía, usa POSTGRES_PRISMA_URL; si también está vacía, POSTGRES_URL
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
                                                         # Lo mismo para la conexión directa a la base
if [ -z "$DATABASE_URL" ]; then                          # Si después de todo sigue vacía ("-z" = está vacía)…
  echo "Falta la base de datos: en Vercel, Storage → crear una base y conectarla al proyecto." >&2
                                                         # … muestra el error ("> &2" = mandarlo como error)
  exit 1                                                 # … y corta
fi                                                       # Fin del if (en shell se cierra con "fi")
npx prisma generate                                      # Genera el código de Prisma que habla con la base
npx prisma migrate deploy                                # Aplica los cambios pendientes a las tablas (migraciones), incluida la 0004 de seguridad
npx prisma db execute --schema prisma/schema.prisma --file prisma/rls.sql \
  || echo "[LIB:prisma][WARN] no se pudo re-aplicar prisma/rls.sql (la migración 0004 ya activó RLS)" >&2
                                                         # Vuelve a activar RLS en todas las tablas (cubre tablas nuevas). Si falla ("||"), sólo avisa: la migración ya lo había activado
npx tsx prisma/seed.ts                                   # Carga los datos iniciales (tratamientos, horarios) sólo si la base está vacía
npx next build                                           # Compila la página
node scripts/verificar-secretos.mjs                      # Busca claves en los archivos del navegador. Si encuentra una, corta el deploy
```

---

# Punto 2 · `prisma/rls.sql` — RLS en todas las tablas

**Para qué sirve:** activa RLS (Row Level Security, "seguridad por fila") en todas las tablas.
Resultado: sólo el usuario dueño de las tablas (el que usa la página) puede ver datos. Cualquier otro usuario de la base ve las tablas vacías.
En SQL, los comentarios van después de `--`.

```sql
DO $$                                                    -- "Ejecutá este bloque de código". $$ marca dónde empieza y dónde termina
DECLARE                                                  -- Acá se declaran las variables del bloque
  t record;                                              -- "t" va a guardar una fila (una tabla de la lista)
BEGIN                                                    -- Empieza el bloque
  FOR t IN                                               -- Para cada tabla "t" que salga de esta consulta…
    SELECT tablename FROM pg_tables                      -- … buscá en el catálogo de Postgres (pg_tables) los nombres de tabla…
    WHERE schemaname = 'public' AND tableowner = current_user
                                                         -- … que estén en "public" (donde viven las nuestras) y cuyo dueño sea el usuario con el que estamos conectados
  LOOP                                                   -- Repetí lo siguiente por cada tabla
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
                                                         -- ACTIVA RLS en esa tabla. %I mete el nombre de la tabla de forma segura (con comillas si hace falta)
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t.tablename);
                                                         -- Le SACA todos los permisos a "PUBLIC" (= cualquier otro usuario de la base)
  END LOOP;                                              -- Fin de la repetición
END $$;                                                  -- Fin del bloque
```

**¿Por qué la página sigue funcionando?** Postgres no limita con RLS al dueño de la tabla, y la página entra como dueño.
Las dos barreras protegen contra todos los demás:
1. **Sin permisos** → "permiso denegado".
2. **Aunque alguien le dé permiso** a otro usuario, RLS no tiene ninguna regla que deje ver filas → ve 0 filas.

---

# Punto 3 · Cerrar sesión

## `src/lib/auth.ts` — sesiones del panel (archivo completo)

**Para qué sirve:** es el corazón del ingreso al panel: revisa usuario y contraseña, crea la sesión, la lee y la cierra.

```ts
import "server-only";                                    // Candado: sólo servidor
import { createHmac } from "node:crypto";                // Herramienta para crear una "huella" firmada (HMAC)
import { SignJWT, jwtVerify } from "jose";               // jose: biblioteca para crear (SignJWT) y revisar (jwtVerify) tokens de sesión
import { cookies } from "next/headers";                  // Para leer y escribir cookies del navegador desde el servidor
import { redirect } from "next/navigation";              // Para mandar a la persona a otra página
import { cache } from "react";                           // Para que una función no se repita dos veces en la misma carga de página
import { prisma } from "./db";                           // La conexión a la base
import { COOKIE_ADMIN, secreto } from "./token";         // El nombre de la cookie ("hs_admin") y la función que lee AUTH_SECRET
import { igualesSeguro, verificarPassword } from "./passwords";
                                                         // Las comparaciones seguras de contraseñas (ver passwords.ts)

const DURACION_SEG = 60 * 60 * 24 * 7;                   // 60 segundos × 60 minutos × 24 horas × 7 días = la sesión dura una semana
export const USUARIO_MAESTRO = "admin";                  // El nombre del usuario de emergencia

export interface Sesion {                                // Describe qué datos tiene una sesión
  id: string;                                            // Identificador del usuario (texto)
  nombre: string;                                        // Su nombre
  email: string;                                         // Su email
  maestro: boolean;                                      // true = entró con el acceso de emergencia "admin"
}                                                        // Fin

const OPCIONES_COOKIE = {                                // Opciones de la cookie de sesión. Se usan IGUALES al crearla y al borrarla
  httpOnly: true,                                        // El JavaScript de la página NO puede leerla → aunque inyecten código, no la roban
  secure: process.env.NODE_ENV === "production",         // En producción sólo viaja por https (conexión cifrada)
  sameSite: "lax" as const,                              // Otros sitios no la pueden usar para mandar formularios haciéndose pasar por vos
  path: "/",                                             // Vale para todo el sitio
};                                                       // Fin

function huellaMaestra(): string {                       // Calcula una "huella" de ADMIN_PASSWORD
  const pass = process.env.ADMIN_PASSWORD?.trim() ?? ""; // Lee ADMIN_PASSWORD de Vercel sin espacios en las puntas (si no existe, texto vacío)
  return createHmac("sha256", secreto()).update(`maestro:${pass}`).digest("base64url").slice(0, 22);
                                                         // La mezcla con AUTH_SECRET (HMAC). Sin AUTH_SECRET no se puede volver atrás para sacar la contraseña. Se queda con 22 letras
}                                                        // Si cambiás ADMIN_PASSWORD, la huella cambia → las sesiones viejas de "admin" dejan de valer

export async function verificarCredenciales(             // Revisa usuario y contraseña. Devuelve los datos para la sesión, o null si no coinciden
  usuario: string,                                       // Lo que escribió en "Email"
  password: string,                                      // Lo que escribió en "Contraseña"
): Promise<{ sub: string; v: number } | null> {          // Devuelve { sub: id del usuario, v: versión } o null
  const u = usuario.trim().toLowerCase();                // Saca espacios y pasa a minúsculas ("Maria@X.com " → "maria@x.com")
  if (!u || !password) return null;                      // Si dejó algo vacío → no

  if (u === USUARIO_MAESTRO) {                           // Si escribió "admin" (acceso de emergencia)…
    const real = process.env.ADMIN_PASSWORD?.trim();     // … lee la contraseña real de Vercel
    return real && igualesSeguro(password.trim(), real) ? { sub: USUARIO_MAESTRO, v: 0 } : null;
                                                         // … si existe y coincide → datos de sesión; si no → null
  }                                                      // Fin del caso "admin"

  const admin = await prisma.administrador.findUnique({ where: { email: u } });
                                                         // Busca en la base un usuario con ese email
  if (!admin || !admin.activo || !(await verificarPassword(password, admin.passwordHash))) return null;
                                                         // Si no existe, está desactivado o la contraseña no coincide → null (mismo mensaje en los 3 casos: no le damos pistas a un atacante)
  await prisma.administrador.update({ where: { id: admin.id }, data: { ultimoIngreso: new Date() } });
                                                         // Anota la fecha y hora del ingreso
  return { sub: admin.id, v: admin.version };            // Devuelve su id y su "versión" (sube cada vez que cambia la contraseña)
}                                                        // Fin

export async function crearSesion(datos: { sub: string; v: number }) {
                                                         // Crea la sesión: arma el token y lo guarda en la cookie
  const claims = datos.sub === USUARIO_MAESTRO ? { v: datos.v, h: huellaMaestra() } : { v: datos.v };
                                                         // Los datos que van adentro del token. Al usuario "admin" se le agrega la huella "h"
  const token = await new SignJWT(claims)                // Empieza a armar el token con esos datos
    .setProtectedHeader({ alg: "HS256" })                // Elige cómo se firma (HS256 = firma con clave secreta)
    .setSubject(datos.sub)                               // Para quién es (el id del usuario)
    .setIssuedAt()                                       // Cuándo se creó
    .setExpirationTime(`${DURACION_SEG}s`)               // Cuándo vence (en 7 días)
    .sign(secreto());                                    // Lo FIRMA con AUTH_SECRET. Si alguien lo modifica, la firma deja de coincidir
  (await cookies()).set(COOKIE_ADMIN, token, { ...OPCIONES_COOKIE, maxAge: DURACION_SEG });
                                                         // Guarda el token en la cookie "hs_admin" con las opciones seguras, por 7 días
}                                                        // Fin

export async function cerrarSesion() {                   // CIERRA la sesión en este navegador
  (await cookies()).set(COOKIE_ADMIN, "", { ...OPCIONES_COOKIE, maxAge: 0, expires: new Date(0) });
                                                         // Pisa la cookie con una vacía que vence YA (maxAge 0, fecha del año 1970). Con las mismas opciones; si no, el navegador no la borra
}                                                        // Fin

export const getSesion = cache(async (): Promise<Sesion | null> => {
                                                         // Lee la sesión actual. cache() = si se pide 2 veces en la misma carga, consulta la base 1 sola vez
  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
                                                         // Lee la cookie "hs_admin"
  if (!token) return null;                               // Si no hay cookie → no hay sesión
  try {                                                  // Intentamos…
    const { payload } = await jwtVerify(token, secreto());
                                                         // … revisar la firma y que no esté vencido. Si algo está mal, salta al catch
    if (payload.sub === USUARIO_MAESTRO) {               // Si es el usuario "admin"…
      if (!process.env.ADMIN_PASSWORD?.trim() || payload.h !== huellaMaestra()) return null;
                                                         // … y borraron ADMIN_PASSWORD o la huella ya no coincide (la cambiaron) → sesión inválida
      return { id: USUARIO_MAESTRO, nombre: "Administrador", email: USUARIO_MAESTRO, maestro: true };
                                                         // … si no, sesión válida de emergencia
    }                                                    // Fin del caso "admin"
    if (!payload.sub) return null;                       // Si el token no dice de quién es → inválido
    const admin = await prisma.administrador.findUnique({ where: { id: payload.sub } });
                                                         // Busca al usuario en la base
    if (!admin || !admin.activo || admin.version !== payload.v) return null;
                                                         // Si lo borraron, lo desactivaron o cambió la contraseña (versión distinta) → afuera
    return { id: admin.id, nombre: admin.nombre, email: admin.email, maestro: false };
                                                         // Todo bien: devuelve los datos de la sesión
  } catch {                                              // Si algo falló (token adulterado, vencido o base caída)…
    return null;                                         // … lo tratamos como "sin sesión": vuelve al login
  }                                                      // Fin
});                                                      // Fin de getSesion

export async function requireAdmin(): Promise<Sesion> {  // "Exigí que haya sesión". Se pone al principio de cada página y acción del panel
  const sesion = await getSesion();                      // Lee la sesión
  if (!sesion) redirect("/admin/login");                 // Si no hay → manda al login (y no se ejecuta nada más)
  return sesion;                                         // Si hay → devuelve los datos para usarlos
}                                                        // Fin
```

## `src/app/admin/acciones.ts` — el botón "Salir" (fragmento)

**Para qué sirve:** lo que pasa al tocar "Salir" en el panel.

```ts
export async function salir() {                          // Función que corre en el servidor al tocar "Salir"
  await cerrarSesion();                                  // 1. Borra la cookie de sesión (ver auth.ts)
  revalidatePath("/admin", "layout");                    // 2. Vacía la memoria (caché) del panel en el navegador → con "Atrás" no se ve nada
  redirect("/admin/login");                              // 3. Manda al login
}                                                        // Fin
```

**Importante:** cada página del panel empieza ahora con esta línea:

```ts
  await requireAdmin(); // cada página revisa la sesión  // Sin esto, un usuario DESACTIVADO podía seguir navegando el panel hasta 7 días (se comprobó en las pruebas)
```

## `src/lib/token.ts` — revisar la firma del token

**Para qué sirve:** lo usa el "portero" (middleware). No cambió en esta revisión, pero el portero depende de él.

```ts
import { jwtVerify } from "jose";                        // Trae la función que revisa tokens

export const COOKIE_ADMIN = "hs_admin";                  // El nombre de la cookie de sesión

export function secreto() {                              // Devuelve AUTH_SECRET listo para firmar o revisar
  const s = process.env.AUTH_SECRET;                     // Lo lee de Vercel
  if (!s || s.length < 16) throw new Error("Falta AUTH_SECRET (mínimo 16 caracteres)");
                                                         // Si falta o es muy corto, frena con un error claro
  return new TextEncoder().encode(s);                    // Lo convierte a bytes (lo que pide jose)
}                                                        // Fin

export async function tokenValido(token: string | undefined): Promise<boolean> {
                                                         // ¿El token tiene firma válida y no está vencido? true/false
  if (!token) return false;                              // Sin token → no
  try {                                                  // Intentamos…
    await jwtVerify(token, secreto());                   // … revisar la firma
    return true;                                         // Si no saltó error → válido
  } catch {                                              // Si saltó error…
    return false;                                        // … inválido
  }                                                      // Fin
}                                                        // Fin
```

## `src/middleware.ts` — el portero del panel

**Para qué sirve:** corre ANTES de mostrar cualquier página que empiece con `/admin`. Sin un token válido, manda al login.

```ts
import { NextResponse, type NextRequest } from "next/server";
                                                         // Herramientas de Next.js para leer el pedido (request) y armar la respuesta
import { COOKIE_ADMIN, tokenValido } from "@/lib/token"; // El nombre de la cookie y la función que revisa la firma

function sinCache(res: NextResponse): NextResponse {     // Recibe una respuesta y le agrega "no guardes esto"
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
                                                         // Instrucción al navegador: no guardes copia de esta página (así no se ve con "Atrás" ni queda en la compu)
  return res;                                            // Devuelve la respuesta modificada
}                                                        // Fin

export async function middleware(req: NextRequest) {     // El portero. "req" = el pedido que hizo el navegador
  if (req.nextUrl.pathname.startsWith("/admin/login")) return sinCache(NextResponse.next());
                                                         // Si va al login, dejalo pasar (si no, nadie podría ingresar nunca)
  if (await tokenValido(req.cookies.get(COOKIE_ADMIN)?.value)) return sinCache(NextResponse.next());
                                                         // Si trae una cookie con firma válida, dejalo pasar (sin caché)
  return NextResponse.redirect(new URL("/admin/login", req.url));
                                                         // En cualquier otro caso → al login
}                                                        // Fin

export const config = { matcher: ["/admin/:path*"] };    // Le dice a Next.js: este portero sólo vigila las direcciones /admin y todo lo que cuelga de ahí
```

---

# Punto 4 · Login

## `src/lib/limite-login.ts` — freno a la fuerza bruta

**Para qué sirve:** cuenta los intentos fallidos. Con 8 desde la misma conexión, o 15 contra la misma cuenta, en 15 minutos, bloquea.

```ts
import "server-only";                                    // Candado: sólo servidor
import { prisma } from "./db";                           // La base (los intentos se guardan en la tabla IntentoLogin)
import { logWarn } from "./log";                         // Para dejar avisos en el registro

const VENTANA_MS = 15 * 60_000;                          // 15 minutos en milisegundos (60_000 = 60.000 ms = 1 minuto; el "_" sólo ayuda a leer)
const MAX_POR_IP = 8;                                    // Máximo de fallos desde una misma conexión (IP)
const MAX_POR_USUARIO = 15;                              // Máximo de fallos contra una misma cuenta

function claves(ip: string, usuario: string) {           // Arma las dos "etiquetas" con las que se anotan los intentos
  return { ip: `ip:${ip || "desconocida"}`, usuario: `usuario:${usuario.trim().toLowerCase()}` };
                                                         // Ej: "ip:190.1.2.3" y "usuario:maria@x.com"
}                                                        // Fin

export async function loginBloqueado(ip: string, usuario: string): Promise<boolean> {
                                                         // ¿Está bloqueado? true = sí, no dejar intentar
  const c = claves(ip, usuario);                         // Arma las etiquetas
  const desde = new Date(Date.now() - VENTANA_MS);       // La hora de hace 15 minutos
  try {                                                  // Intentamos…
    const [porIp, porUsuario] = await Promise.all([      // … hacer DOS consultas a la vez (Promise.all = en paralelo, más rápido):
      prisma.intentoLogin.count({ where: { clave: c.ip, creadoEn: { gt: desde } } }),
                                                         //    contar fallos de esta IP en los últimos 15 min ("gt" = posterior a)
      prisma.intentoLogin.count({ where: { clave: c.usuario, creadoEn: { gt: desde } } }),
                                                         //    contar fallos contra esta cuenta en los últimos 15 min
    ]);                                                  // Fin de las consultas
    return porIp >= MAX_POR_IP || porUsuario >= MAX_POR_USUARIO;
                                                         // Bloqueado si se pasó cualquiera de los dos límites
  } catch (err) {                                        // PLAN B: si la base no responde…
    logWarn("login · no se pudo revisar el límite de intentos (se deja pasar)", err);
                                                         // … deja un aviso en el log…
    return false;                                        // … y NO bloquea (mejor que la profesional pueda entrar)
  }                                                      // Fin
}                                                        // Fin

export async function registrarFallo(ip: string, usuario: string): Promise<void> {
                                                         // Anota un intento fallido
  const c = claves(ip, usuario);                         // Arma las etiquetas
  try {                                                  // Intentamos…
    await prisma.intentoLogin.createMany({ data: [{ clave: c.ip }, { clave: c.usuario }] });
                                                         // … guardar dos filas: una por la IP y otra por la cuenta
    await prisma.intentoLogin.deleteMany({ where: { creadoEn: { lt: new Date(Date.now() - 86_400_000) } } });
                                                         // … y de paso borrar lo de hace más de 1 día (86.400.000 ms) para que la tabla no crezca. "lt" = anterior a
  } catch (err) {                                        // Si falla…
    logWarn("login · no se pudo anotar el intento fallido", err);
                                                         // … sólo avisa
  }                                                      // Fin
}                                                        // Fin

export async function limpiarFallos(ip: string, usuario: string): Promise<void> {
                                                         // Cuando entra bien, borra sus fallos anteriores
  const c = claves(ip, usuario);                         // Arma las etiquetas
  try {                                                  // Intentamos…
    await prisma.intentoLogin.deleteMany({ where: { clave: { in: [c.ip, c.usuario] } } });
                                                         // … borrar las filas con esas dos etiquetas ("in" = que sea alguna de esta lista)
  } catch (err) {                                        // Si falla…
    logWarn("login · no se pudieron borrar los intentos fallidos", err);
                                                         // … sólo avisa
  }                                                      // Fin
}                                                        // Fin
```

## `src/app/admin/login/page.tsx` — la pantalla de ingreso

**Para qué sirve:** muestra el formulario de ingreso y, al tocar "Ingresar", revisa todo en el servidor.

```tsx
import type { Metadata } from "next";                    // Tipo para los datos de la página (título, etc.)
import Image from "next/image";                          // Componente de Next.js para mostrar imágenes optimizadas (el logo)
import { headers } from "next/headers";                  // Para leer los encabezados del pedido (de ahí sale la IP)
import { redirect } from "next/navigation";              // Para mandar a otra página
import { crearSesion, getSesion, verificarCredenciales } from "@/lib/auth";
                                                         // Funciones de sesión (ver auth.ts)
import { limpiarFallos, loginBloqueado, registrarFallo } from "@/lib/limite-login";
                                                         // El freno a la fuerza bruta (ver arriba)
import { logError } from "@/lib/log";                    // Para registrar errores con etiqueta
import { prisma } from "@/lib/db";                       // La base

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };
                                                         // Título de la pestaña: "Ingresar". robots index:false = que Google no la muestre en búsquedas
export const dynamic = "force-dynamic";                  // Esta página se arma de nuevo en cada visita (nunca una copia guardada)

const ERRORES: Record<string, string> = {                // Tabla: código de error que viene en la dirección (?error=…) → mensaje para la persona
  "1": "Email o contraseña incorrectos",                 // ?error=1
  bloqueado: "Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.",
                                                         // ?error=bloqueado
  servidor: "No pudimos conectar con el servidor. Probá de nuevo en un rato.",
                                                         // ?error=servidor
};                                                       // Fin

async function problemasDeConfiguracion(): Promise<string[]> {
                                                         // Revisa que estén cargadas las variables necesarias. Devuelve una lista de problemas
  const problemas: string[] = [];                        // Lista vacía de problemas
  const secreto = process.env.AUTH_SECRET ?? "";         // Lee AUTH_SECRET (o vacío)
  if (secreto.length < 16) {                             // Si tiene menos de 16 letras…
    problemas.push("Falta la variable AUTH_SECRET en Vercel (o tiene menos de 16 caracteres).");
                                                         // … agrega el problema a la lista
  }                                                      // Fin
  if (!process.env.ADMIN_PASSWORD?.trim()) {             // Si ADMIN_PASSWORD falta o son sólo espacios…
    const usuarios = await prisma.administrador.count().catch(() => 0);
                                                         // … cuenta cuántos usuarios hay (si la base falla, asume 0)
    if (usuarios === 0) problemas.push("Falta la variable ADMIN_PASSWORD en Vercel y todavía no hay usuarios creados.");
                                                         // … si tampoco hay usuarios, nadie podría entrar → problema
  }                                                      // Fin
  return problemas;                                      // Devuelve la lista
}                                                        // Fin

async function ipCliente(): Promise<string> {            // Averigua la IP de quien intenta entrar
  const h = await headers();                             // Lee los encabezados del pedido
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
                                                         // Vercel manda la IP real en "x-forwarded-for" (la primera de la lista). Si no está, prueba "x-real-ip"
}                                                        // Fin

async function ingresar(formData: FormData) {            // Lo que pasa al tocar "Ingresar". formData = lo que se escribió en el formulario
  "use server";                                          // Esta función corre en el SERVIDOR: la contraseña nunca se compara en el navegador
  await new Promise((r) => setTimeout(r, 600));          // Espera 0,6 segundos a propósito: frena a quien prueba miles de contraseñas
  if ((await problemasDeConfiguracion()).length) redirect("/admin/login");
                                                         // Si falta configuración, vuelve al login (ahí se muestra el problema)

  const usuario = String(formData.get("email") ?? "");   // Lee lo escrito en "Email"
  const password = String(formData.get("password") ?? "");
                                                         // Lee lo escrito en "Contraseña"
  const ip = await ipCliente();                          // Averigua la IP

  let destino: string;                                   // Acá se guarda adónde mandar a la persona al final
  try {                                                  // Intentamos todo el ingreso…
    if (await loginBloqueado(ip, usuario)) {             // ¿Demasiados intentos?
      destino = "/admin/login?error=bloqueado";          //   → mensaje de bloqueo (ni se revisa la contraseña)
    } else {                                             // Si no está bloqueado…
      const datos = await verificarCredenciales(usuario, password);
                                                         //   revisa usuario y contraseña
      if (!datos) {                                      //   Si no coinciden…
        await registrarFallo(ip, usuario);               //     anota el fallo
        destino = "/admin/login?error=1";                //     → "Email o contraseña incorrectos"
      } else {                                           //   Si coinciden…
        await limpiarFallos(ip, usuario);                //     borra sus fallos anteriores
        await crearSesion(datos);                        //     crea la sesión (cookie)
        destino = "/admin";                              //     → al panel
      }                                                  //   Fin
    }                                                    // Fin
  } catch (err) {                                        // PLAN B: si algo falló (por ejemplo, la base no responde)…
    logError("login", err);                              //   … lo anota con su etiqueta ([LIB:prisma] si fue la base)
    destino = "/admin/login?error=servidor";             //   … y muestra un mensaje claro en vez de la pantalla de error
  }                                                      // Fin
  redirect(destino);                                     // Recién ahora redirige. Va AFUERA del try porque redirect() funciona "tirando" un aviso especial que el catch atraparía por error
}                                                        // Fin

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
                                                         // La página en sí. searchParams = lo que viene después del "?" en la dirección
  const [{ error }, problemas, sesion] = await Promise.all([searchParams, problemasDeConfiguracion(), getSesion()]);
                                                         // Hace tres cosas a la vez: lee ?error=, revisa la configuración y mira si ya hay sesión
  if (sesion) redirect("/admin");                        // Si ya está logueado, no tiene sentido mostrarle el formulario → al panel
  const textoError = error ? (ERRORES[error] ?? ERRORES["1"]) : null;
                                                         // Si hay ?error=, busca su mensaje en la tabla (si es un código raro, usa el de "incorrectos")
  return (                                               // Lo que se dibuja en pantalla (HTML):
    <div className="flex min-h-screen items-center justify-center px-4">
                                                         // Contenedor que centra todo en la pantalla
      <form action={ingresar} className="w-full max-w-sm rounded-2xl border border-linea bg-carbon p-8 text-center">
                                                         // El formulario. action={ingresar} = al enviarlo, corre la función "ingresar" en el servidor
        <Image src="/logo.png" alt="" width={88} height={88} className="mx-auto rounded-full" />
                                                         // El logo redondo
        <h1 className="mt-5 font-serif text-3xl text-gold-light">Panel</h1>
                                                         // Título "Panel"
        <p className="mt-1 text-sm text-piedra">Ingresá con tu email y contraseña</p>
                                                         // Subtítulo
        {problemas.length > 0 && (                       // Si hay problemas de configuración, muestra este cuadro:
          <div role="alert" className="mt-5 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-left text-sm text-amber-200">
                                                         //   cuadro amarillo. role="alert" = los lectores de pantalla lo anuncian
            <p className="font-semibold">El panel todavía no está configurado:</p>
            <ul className="mt-1 list-disc pl-5">{problemas.map((p) => <li key={p}>{p}</li>)}</ul>
                                                         //   un punto de lista por cada problema
            <p className="mt-2 text-xs">Se cargan en Vercel → Settings → Environment Variables, y después hay que hacer Redeploy.</p>
          </div>
        )}                                               // Fin del cuadro
        <label htmlFor="email" className="sr-only">Email</label>
                                                         // Etiqueta "Email": invisible, pero la leen los lectores de pantalla
        <input id="email" name="email" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off"
          spellCheck={false} placeholder="Email (o admin)" required autoFocus className="campo mt-6 text-left" />
                                                         // Casilla de email: teclado de email en el celular, sin mayúscula ni autocorrector, obligatoria, con el cursor ya puesto
        <label htmlFor="password" className="sr-only">Contraseña</label>
                                                         // Etiqueta invisible "Contraseña"
        <input id="password" type="password" name="password" autoComplete="current-password" placeholder="Contraseña" required className="campo mt-3 text-left" />
                                                         // Casilla de contraseña (type="password" = muestra puntitos)
        {textoError && <p role="alert" className="mt-3 text-sm text-red-400">{textoError}</p>}
                                                         // Si hay error, lo muestra en rojo
        <button className="btn-oro mt-6 w-full">Ingresar</button>
                                                         // Botón dorado que envía el formulario
      </form>
    </div>
  );                                                     // Fin de lo que se dibuja
}                                                        // Fin de la página
```

---

# Punto 6 · Planes B (fallbacks)

## `src/app/actions/reservas.ts` — reservar y cancelar (servidor)

**Para qué sirve:** son las acciones que dispara la clienta. Pase lo que pase, al navegador sólo le devuelven un resultado prolijo; nunca detalles internos.

```ts
"use server";                                            // Todo este archivo corre en el servidor

import { prisma } from "@/lib/db";                       // La base
import { ErrorReserva, cancelarTurno, crearReserva, reservaSchema } from "@/lib/turnos";
                                                         // La lógica de turnos y el "molde" que valida los datos de la reserva
import { igualesSeguro } from "@/lib/passwords";         // Comparación segura (para el token del turno)
import { logError } from "@/lib/log";                    // Registro con etiqueta
import { revalidatePath } from "next/cache";             // Para refrescar una página después de un cambio

export type ResultadoReserva = { ok: true; url: string } | { ok: false; error: string };
                                                         // Lo único que puede volver: "salió bien + adónde ir" o "salió mal + mensaje"

const ERROR_GENERICO = "Ocurrió un error inesperado. Probá de nuevo o escribinos por WhatsApp.";
                                                         // Mensaje para errores técnicos (no le mostramos detalles a la clienta)

export async function reservarTurno(input: unknown, honeypot?: string): Promise<ResultadoReserva> {
                                                         // Reserva un turno. input = los datos del formulario. honeypot = el campo trampa
  if (honeypot) return { ok: false, error: "No se pudo procesar la reserva" };
                                                         // El campo trampa es invisible para las personas: si viene lleno, es un robot
  const parsed = reservaSchema.safeParse(input);         // Revisa que los datos tengan el formato correcto (email válido, nombre, etc.)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
                                                         // Si algo está mal, devuelve el primer problema ("Email inválido")

  try {                                                  // Intentamos…
    const r = await crearReserva(parsed.data);           // … crear la reserva
    return { ok: true, url: `/reserva/${r.turnoId}?t=${r.token}` };
                                                         // … salió bien: la mandamos a la página de su turno (con su token secreto)
  } catch (err) {                                        // PLAN B si falla:
    if (err instanceof ErrorReserva) return { ok: false, error: err.message };
                                                         //   si es un error esperado ("ese horario ya no está"), se muestra tal cual
    logError("reserva", err);                            //   si es técnico, se anota con su etiqueta ([LIB:prisma] = la base)
    return { ok: false, error: ERROR_GENERICO };         //   y la clienta ve un mensaje amable
  }                                                      // Fin
}                                                        // Fin

export async function cancelarPorClienta(turnoId: string, token: string): Promise<{ error?: string }> {
                                                         // La clienta cancela desde el link del mail
  try {                                                  // Intentamos…
    const turno = await prisma.turno.findUnique({ where: { id: String(turnoId) }, select: { token: true } });
                                                         // … buscar el turno (sólo su token secreto)
    if (!turno || !igualesSeguro(turno.token, String(token))) return { error: "Turno no encontrado" };
                                                         // … si no existe o el token no coincide → "no encontrado" (el token es la "llave" del turno)
    await cancelarTurno(turnoId, "clienta");             // … cancelarlo
  } catch (err) {                                        // PLAN B:
    if (err instanceof ErrorReserva) return { error: err.message };
                                                         //   error esperado ("sólo se puede cancelar hasta 24 hs antes") → se muestra
    logError("cancelación por clienta", err);            //   error técnico → se anota
    return { error: ERROR_GENERICO };                    //   y mensaje amable
  }                                                      // Fin
  revalidatePath(`/reserva/${turnoId}`);                 // Refresca la página del turno para que muestre "Turno cancelado"
  return {};                                             // Sin error = salió bien
}                                                        // Fin
```

## `src/app/api/disponibilidad/route.ts` — los horarios libres

**Para qué sirve:** el calendario le pregunta a esta dirección qué horarios quedan libres en un día.

```ts
import { NextResponse } from "next/server";              // Para armar la respuesta
import { horariosDisponibles } from "@/lib/turnos";      // La función que calcula los horarios libres
import { getSesion } from "@/lib/auth";                  // Para saber si quien pregunta está en el panel
import { logError } from "@/lib/log";                    // Registro con etiqueta

export async function GET(req: Request) {                // Responde a pedidos GET (los de "leer")
  const { searchParams } = new URL(req.url);             // Lee lo que viene después del "?" en la dirección
  const servicio = searchParams.get("servicio") ?? "";   // ?servicio=… (qué tratamiento)
  const fecha = searchParams.get("fecha") ?? "";         // ?fecha=… (qué día)
  try {                                                  // Intentamos…
    const sinLimites = searchParams.get("panel") === "1" && Boolean(await getSesion());
                                                         // … "sin límite de días" sólo si lo pide el panel Y hay sesión iniciada (si no, cualquiera podría saltear el límite)
    const horarios = await horariosDisponibles(servicio, fecha, { sinLimites });
                                                         // … calcular los horarios libres
    return NextResponse.json({ horarios }, { headers: { "Cache-Control": "no-store" } });
                                                         // … responderlos, sin guardar copia (cambian a cada rato)
  } catch (err) {                                        // PLAN B: si falla (base caída)…
    logError("disponibilidad", err);                     //   … se anota
    return NextResponse.json({ error: "No disponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
                                                         //   … y responde 503 ("servicio no disponible"). El calendario muestra "No pudimos cargar los horarios · Reintentar"
  }                                                      // Fin
}                                                        // Fin
```

## `src/components/Reserva.tsx` — el formulario de reserva (fragmento del navegador)

**Para qué sirve:** es el envío del formulario en el navegador de la clienta.

```tsx
    startTransition(async () => {                        // Ejecuta el envío "en segundo plano": mientras tanto el botón dice "Procesando…"
      let r: ResultadoReserva;                           // Acá va a quedar la respuesta del servidor
      try {                                              // Intentamos…
        r = await p.accion(                              // … mandar la reserva al servidor
          {                                              //   con estos datos:
            servicioId: servicio.id,                     //   el tratamiento
            fecha,                                       //   el día
            hora,                                        //   la hora
            ...form,                                     //   y nombre, email, teléfono y notas
          },                                             //
          String(fd.get("website") ?? ""),               //   más el campo trampa para robots
        );                                               // Fin del envío
      } catch (err) {                                    // PLAN B: si no se pudo ni hablar con el servidor…
        const origen = logError("reserva (navegador)", err);
                                                         //   … lo anota (sale en la consola del navegador) y averigua el origen
        setError(                                        //   … y muestra un mensaje según el caso:
          origen === "LIB:red"                           //   ¿fue la conexión?
            ? "Parece que se cortó la conexión. Revisá tu internet y tocá el botón de nuevo."
                                                         //     sí → mensaje de internet
            : "No pudimos completar la reserva. Probá de nuevo en unos segundos o escribinos por WhatsApp.",
                                                         //     no → mensaje general
        );                                               //
        return;                                          //   Corta acá. Los datos que cargó NO se borran: puede volver a tocar el botón
      }                                                  // Fin
      if (r.ok) {                                        // Si salió bien…
        window.location.href = r.url;                    //   … la lleva a la página de su turno
      } else {                                           // Si el servidor dijo que no…
        setError(r.error);                               //   … muestra su mensaje
        if (/horario/i.test(r.error)) setRecarga((n) => n + 1);
                                                         //   … y si el problema era el horario, vuelve a cargar la lista de horarios libres
      }                                                  // Fin
    });                                                  // Fin
```

## `src/lib/turnos.ts` — los mails no rompen una reserva (fragmento)

**Para qué sirve:** cuando la reserva ya quedó guardada, si después falla el mail, la clienta igual ve su turno.

```ts
  const pendienteSena = turno.estado === "PENDIENTE_PAGO";
                                                         // ¿Falta que pague la seña?
  try {                                                  // Intentamos mandar los mails…
    const cfgActual = await getConfig();                 // … lee la configuración del negocio (nombre, WhatsApp…)
    await Promise.all(                                   // … manda los dos mails a la vez:
      pendienteSena                                      //   si falta la seña →
        ? [enviarMail(mailReservaPendienteClienta(cfgActual, turno)), enviarMail(mailNuevaReservaProfesional(cfgActual, turno))]
                                                         //     mail "transferí la seña" a la clienta + aviso a la profesional
        : [enviarMail(mailConfirmacionClienta(cfgActual, turno)), enviarMail(mailNuevoTurnoProfesional(cfgActual, turno))],
                                                         //   si no →  mail "turno confirmado" a la clienta + aviso a la profesional
    );                                                   //
  } catch (err) {                                        // PLAN B: si fallan los mails…
    logError(`mails de la reserva ${turno.id}`, err);    //   … se anota, pero NO se corta: si le mostráramos un error, podría reservar dos veces
  }                                                      // Fin
  return { turnoId: turno.id, token: turno.token, pendienteSena };
                                                         // Devuelve los datos del turno igual
```

## `src/app/error.tsx` — pantalla de "algo salió mal"

**Para qué sirve:** si una página se rompe, en vez de una pantalla en blanco se ve esto, con un botón para reintentar.

```tsx
"use client";                                            // Corre en el navegador (necesita el botón "Reintentar")

import Link from "next/link";                            // Para hacer links internos
import { useEffect } from "react";                       // Para ejecutar algo apenas aparece la pantalla
import { logError } from "@/lib/log";                    // Registro con etiqueta

export default function ErrorPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
                                                         // Next.js la muestra sola cuando una página falla. error = qué pasó; reset = función para reintentar
  useEffect(() => {                                      // Apenas se muestra…
    logError(`página${error.digest ? ` (digest ${error.digest})` : ""}`, error);
                                                         // … anota el error. "digest" es un código para buscar el error completo en Vercel → Logs
  }, [error]);                                           // (se repite sólo si cambia el error)

  return (                                               // Lo que se dibuja:
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
                                                         // Contenedor centrado
      <p className="eyebrow">Algo salió mal</p>          // Texto chiquito arriba
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">No pudimos cargar esta página</h1>
                                                         // Título
      <p className="mt-4 max-w-md text-piedra">          // Explicación:
        Puede ser un problema momentáneo. Probá de nuevo en unos segundos; si sigue pasando, escribinos por WhatsApp.
      </p>                                               //
      <div className="mt-8 flex flex-wrap justify-center gap-3">
                                                         // Fila de botones
        <button type="button" onClick={reset} className="btn-oro">Reintentar</button>
                                                         // Botón "Reintentar": vuelve a intentar cargar la página
        <Link href="/" className="btn-linea">Volver al inicio</Link>
                                                         // Link al inicio
      </div>                                             //
    </div>                                               //
  );                                                     // Fin de lo que se dibuja
}                                                        // Fin
```

Hay dos pantallas parecidas más:
- **`src/app/admin/(panel)/error.tsx`:** la versión del panel. Además muestra el código para buscar en Vercel.
- **`src/app/global-error.tsx`:** el último respaldo, por si se rompe la estructura general del sitio. Tiene los estilos escritos ahí mismo, porque tiene que funcionar aunque todo lo demás esté roto.

---

# Extra · `next.config.ts` — encabezados de seguridad

**Para qué sirve:** agrega instrucciones de seguridad que el navegador recibe en todas las páginas.

```ts
import type { NextConfig } from "next";                  // Tipo de la configuración de Next.js

const encabezados = [                                    // Lista de instrucciones de seguridad para el navegador:
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
                                                         // nadie puede meter el sitio dentro de otro; los formularios sólo se envían a este sitio; nada de plugins viejos
  { key: "X-Frame-Options", value: "DENY" },             // lo mismo que "frame-ancestors", para navegadores viejos
  { key: "X-Content-Type-Options", value: "nosniff" },   // el navegador no "adivina" qué tipo de archivo es (evita trucos con archivos disfrazados)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                                                         // a sitios externos (WhatsApp, YouTube) sólo les llega el dominio, nunca el link secreto del turno
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                                                         // la página no puede pedir cámara, micrófono ni ubicación
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
                                                         // el navegador recuerda por 2 años que este sitio va SIEMPRE por https
];                                                       // Fin

const nextConfig: NextConfig = {                         // La configuración de Next.js
  poweredByHeader: false,                                // No anunciar "hecho con Next.js" (no darle pistas a un atacante)
  async headers() {                                      // Función que Next.js usa para saber qué encabezados agregar
    return [{ source: "/:path*", headers: encabezados }];
                                                         // A TODAS las direcciones del sitio, agregales la lista de arriba
  },                                                     //
};                                                       // Fin

export default nextConfig;                               // Entrega esta configuración a Next.js
```

---

## Cómo seguir aprendiendo

1. **Empezá por `log.ts`:** es el más simple y lo usan todos.
2. **Seguí con `auth.ts`:** es el corazón del ingreso al panel.
3. **Después, `login/page.tsx`:** ahí se ve cómo se conectan auth, el freno a la fuerza bruta y el log.
4. **Para ver la seguridad en acción**, abrí Vercel → Logs y buscá `[APP]` o `[LIB:`.
