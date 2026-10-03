# MC Healthy Skin · Turnos online

Sistema de turnos online para **MC Healthy Skin – Dermatocosmiatría**.
Las clientas eligen tratamiento, día y horario, pagan la seña con **Mercado Pago** y
reciben la confirmación por **mail** (la profesional también recibe un aviso).

> El sistema anterior (CakePHP 2, 2013-2014) quedó guardado en la rama `legacy-cakephp`
> y en el tag `legacy-cakephp-2014`.

## Funcionalidades

**Web pública**
- Página de inicio con el logo, tratamientos (por categoría, con duración y precio), “cómo funciona”, “sobre mí” y **video de presentación** al final.
- Reserva en 3 pasos: tratamiento → día y horario (sólo muestra horarios libres) → datos.
- Seña con Mercado Pago (porcentaje o monto fijo, configurable). El horario queda reservado unos minutos mientras se paga.
- Mail de confirmación a la clienta (con archivo para agregar al calendario) y aviso a la profesional.
- Link en el mail para ver o **cancelar** el turno (hasta X horas antes).
- Recordatorio automático por mail el día anterior.

**Panel (`/admin`)**
- Agenda semanal: marcar turnos como realizados / no vino / cancelar, botón de WhatsApp.
- Cargar turnos a mano (los que llegan por WhatsApp).
- Tratamientos: alta, edición, precios, duración, ocultar.
- Horarios de atención (varias franjas por día) y días bloqueados (vacaciones, feriados).
- Clientas: ficha con tipo de piel, alergias, notas privadas e historial.
- Estadísticas mensuales: ingresos, turnos, ausencias, tratamientos más pedidos.
- Configuración: datos de contacto, video, seña, reglas de reserva, política de cancelación.

## Tecnología

Next.js 15 (App Router, TypeScript) · PostgreSQL + Prisma · Tailwind CSS 4 · Nodemailer · SDK de Mercado Pago.

---

## Puesta en marcha (gratis, sin dominio propio)

### 1. Base de datos — Neon
1. Crear una cuenta en <https://neon.tech> y un proyecto.
2. Copiar la *connection string* (`postgresql://...`). Ésa es tu `DATABASE_URL`.

### 2. Mails — Gmail
1. En la cuenta de Gmail que va a enviar los mails, activar la **verificación en 2 pasos**.
2. Ir a <https://myaccount.google.com/apppasswords> y crear una contraseña de aplicación.
3. Usar `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<tu gmail>`, `SMTP_PASS=<la contraseña de 16 letras>`.

### 3. Mercado Pago
1. Entrar a <https://www.mercadopago.com.ar/developers/panel/app> y crear una aplicación (“Pagos online” → Checkout Pro).
2. En **Credenciales de producción** copiar el *Access Token* → `MP_ACCESS_TOKEN`.
   Para probar sin plata real usá las credenciales de prueba.
3. No hace falta configurar el webhook a mano: el sistema lo indica en cada pago.

> Si no cargás `MP_ACCESS_TOKEN`, los turnos se confirman directamente sin seña.

### 4. Publicar — Vercel
1. Crear una cuenta en <https://vercel.com> con GitHub e importar este repositorio.
2. En *Environment Variables* cargar todas las de [`.env.example`](.env.example).
   `NEXT_PUBLIC_SITE_URL` es la URL que te da Vercel (ej: `https://healthy-skin.vercel.app`).
3. Deploy. La base se crea sola (`prisma migrate deploy`).
4. Cargar los datos iniciales una vez desde tu compu: `DATABASE_URL="..." npm run db:seed`.
5. Entrar a `https://<tu-url>/admin` con `ADMIN_PASSWORD` y completar **Configuración**
   (email de la profesional, WhatsApp, Instagram, dirección, video) y los **precios reales**.

Más adelante se puede conectar un dominio propio (ej: `healthyskin.com.ar` en NIC Argentina) desde Vercel.

### Recordatorios
`vercel.json` programa `/api/cron/recordatorios` todos los días a las 10:00 (hora Argentina).
Vercel lo llama con el `CRON_SECRET` configurado.

### Video de presentación
En **Configuración → Video de presentación** pegá un link de YouTube (puede ser “no listado”) o Vimeo.
También podés subir un `.mp4` a la carpeta `public/` (ej: `public/presentacion.mp4`) y poner `/presentacion.mp4`.

---

## Desarrollo local

```bash
cp .env.example .env        # completar DATABASE_URL como mínimo
npm install
npx prisma migrate deploy   # crea las tablas
npm run db:seed             # tratamientos y horarios de ejemplo
npm run dev                 # http://localhost:3000  ·  panel en /admin
```

Sin `SMTP_*` configurado, los mails no se envían y se muestran en la consola.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests (cálculo de horarios, zona horaria, seña) |
| `npm run lint` | Chequeo de tipos |
| `npm run build` | Build de producción |
| `npm run db:seed` | Datos iniciales |

## Estructura

```
prisma/schema.prisma        Modelo de datos (Servicio, Turno, Clienta, Horarios, Bloqueos, Configuración)
src/app/(sitio)/            Web pública: inicio, /reservar, /reserva/[id]
src/app/admin/              Panel de administración
src/app/api/                Disponibilidad, webhook de Mercado Pago, cron de recordatorios
src/lib/turnos.ts           Lógica de reservas, pagos y cancelaciones
src/lib/slots.ts            Cálculo de horarios libres
src/lib/plantillas-email.ts Mails
```

## Licencia
GPL v3.
