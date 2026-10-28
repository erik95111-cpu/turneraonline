# Seguridad · cómo está protegido el sistema

Guía en castellano simple de qué protege cada parte y dónde está el código.

## 1. Las claves nunca llegan al navegador

| Clave | Dónde vive | ¿Llega al navegador? |
|---|---|---|
| `AUTH_SECRET`, `ADMIN_PASSWORD`, `CRON_SECRET` | Variables de Vercel | **No** |
| `SMTP_PASS` (Gmail) | Variables de Vercel | **No** |
| `DATABASE_URL` (Neon) | Variables de Vercel | **No** |
| `NEXT_PUBLIC_SITE_URL` | Variables de Vercel | Sí (es sólo la dirección del sitio, no es secreta) |

- Next.js sólo manda al navegador las variables que empiezan con `NEXT_PUBLIC_`. **Nunca** le pongas ese prefijo a una clave.
- Los archivos que tocan la base, las contraseñas o los mails (`src/lib/db.ts`, `auth.ts`, `passwords.ts`, `email.ts`, `turnos.ts`) arrancan con `import "server-only"`: si por error un componente del navegador los importa, el build falla.
- **Chequeo automático:** después de compilar, `scripts/verificar-secretos.mjs` busca el valor real de cada clave dentro de los archivos del navegador. Si encuentra una, corta el deploy (en Vercel y en GitHub).

## 2. Base de datos: RLS activado en todas las tablas

- `prisma/rls.sql` activa **RLS (Row Level Security)** en todas las tablas y les saca los permisos a cualquier otro usuario de la base.
- La app entra con el usuario **dueño** de las tablas, que no queda limitado por RLS: la web funciona igual.
- Cualquier otro acceso (un usuario de sólo lectura, la "Data API" de Neon, alguien que consiga otro usuario) **no ve ninguna fila**.
- Se aplica en la migración `0004_seguridad` y se vuelve a aplicar en cada deploy, así que las tablas nuevas también quedan protegidas.
- El test `src/lib/seguridad.test.ts` falla si alguna tabla queda sin RLS.

> Importante: la `DATABASE_URL` es la llave maestra de la base. No la compartas ni la pegues en ningún lado fuera de Vercel.

## 3. Cerrar sesión (botón "Salir")

`salir()` en `src/app/admin/acciones.ts`:
1. borra la cookie de sesión (con las mismas opciones con que se creó, si no, el navegador no la borra),
2. vacía la caché del panel en el navegador: con el botón **Atrás** no se vuelve a ver nada,
3. manda al login.

Además:
- Las páginas del panel se mandan con `Cache-Control: no-store` (`src/middleware.ts`).
- **Cambiar la contraseña** de un usuario cierra sus sesiones en todos los dispositivos.
- **Desactivar** un usuario lo saca del panel en el próximo clic: cada página revisa la sesión contra la base.
- **Cambiar `ADMIN_PASSWORD`** en Vercel cierra todas las sesiones del usuario `admin`.

## 4. Login

- La contraseña se revisa sólo en el servidor y se guarda con `scrypt` (nunca en texto plano).
- La cookie de sesión es `httpOnly`: el JavaScript de la página no la puede leer.
- **Freno a la fuerza bruta:** con 8 intentos fallidos desde una misma conexión (o 15 contra una misma cuenta) en 15 minutos, el login se bloquea 15 minutos (`src/lib/limite-login.ts`).
- Mensajes claros: contraseña incorrecta / demasiados intentos / no se pudo conectar con el servidor.
- Si la base no responde, el login muestra un mensaje en vez de la pantalla de error.

## 5. Planes B (fallbacks) en las funciones críticas

| Qué falla | Qué ve la persona |
|---|---|
| Se cae la base al reservar | "Ocurrió un error inesperado. Probá de nuevo o escribinos por WhatsApp." |
| Se corta internet al reservar | "Parece que se cortó la conexión…". Los datos cargados no se pierden |
| No cargan los horarios | "No pudimos cargar los horarios · Reintentar" |
| Falla el mail de confirmación | La reserva queda hecha igual; el error queda en el log |
| Falla cancelar el turno | Mensaje claro; el turno **no** se cancela a medias |
| Falla un recordatorio | Se siguen mandando los demás |
| Se rompe una página | Pantalla "No pudimos cargar esta página · Reintentar" (`src/app/error.tsx`) |
| Se rompe una pantalla del panel | Mensaje con el código para buscar en Vercel → Logs |

## 6. Cómo leer los errores (Vercel → Logs)

Cada línea empieza con una etiqueta que dice **de dónde** viene el problema (`src/lib/log.ts`):

| Etiqueta | Significa | Qué revisar |
|---|---|---|
| `[APP]` | Error de **nuestro código** | El código del proyecto |
| `[LIB:prisma]` | La **base de datos** | Neon, `DATABASE_URL` |
| `[LIB:nodemailer]` | El **envío de mails** | Gmail, `SMTP_USER` / `SMTP_PASS` |
| `[LIB:jose]` | Los **tokens de sesión** | `AUTH_SECRET` |
| `[LIB:red]` | **Conexión** cortada | Internet, servidor caído |
| `[LIB:otra]` | Otra **biblioteca externa** | Actualizaciones de dependencias |

Y después el nivel: `[ERROR]` (algo falló) o `[WARN]` (algo raro, pero se siguió).
Ejemplo: `[LIB:prisma][ERROR] reserva · Can't reach database server` → el problema es la base, no el código.

## Otras protecciones

- Encabezados de seguridad en todas las páginas (`next.config.ts`): no se puede meter el sitio dentro de otro, los formularios sólo se envían a este sitio, y a sitios externos no les llega el link secreto del turno.
- El link para ver o cancelar un turno lleva un token aleatorio de 192 bits.
- El cron de recordatorios sólo responde a Vercel (`CRON_SECRET`).
