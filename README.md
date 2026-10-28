# MC Healthy Skin · Turnos online

Sistema de turnos online para **MC Healthy Skin – Dermatocosmiatría**.
Las clientas eligen tratamiento, día y horario, transfieren la seña (alias/CBU) y mandan el comprobante por **WhatsApp**, y
reciben la confirmación por **mail** (la profesional también recibe un aviso).

> El sistema anterior (CakePHP 2, 2013-2014) quedó guardado en la rama `legacy-cakephp`.

## Funcionalidades

**Web pública**
- Página de inicio con el logo, tratamientos (por categoría, con duración y precio), “cómo funciona”, “sobre mí” y **video de presentación** al final.
- Reserva en 3 pasos: tratamiento → día y horario (sólo muestra horarios libres) → datos.
- Seña por transferencia (monto fijo o porcentaje): la clienta ve alias/CBU con botón para copiar y un botón para mandar el comprobante por WhatsApp. El horario queda apartado (24 h por defecto) hasta que la profesional marca **“Seña recibida”** en el panel.
- Mail de confirmación a la clienta (con archivo para agregar al calendario) y aviso a la profesional.
- Link en el mail para ver o **cancelar** el turno (hasta X horas antes).
- Recordatorio automático por mail el día anterior.
- **Gift cards** (`/gift-cards`): de monto ($50.000, con saldo) o de un tratamiento. Se pagan por WhatsApp; al marcar “Pago recibido” en el panel se mandan por mail con su código (vencen a los 2 meses). Al reservar se ingresa el código y el turno queda confirmado sin seña. Si se cancela el turno, la gift card recupera el saldo.

**Panel (`/admin`)**
- Ingreso con **email y contraseña** por persona (la profesional, una secretaria…). Pantalla **Usuarios** para crear, desactivar o cambiar contraseñas, y **Mi cuenta** para cambiar la propia.
- Acceso de emergencia: usuario `admin` + la contraseña `ADMIN_PASSWORD` de Vercel.
- **Turnos**: lista de todos los turnos (próximos, pasados), con búsqueda y filtro por estado.
- Agenda semanal: marcar turnos como realizados / no vino / cancelar, botón de WhatsApp.
- Cargar turnos a mano (los que llegan por WhatsApp).
- Tratamientos: alta, edición, precios, duración, ocultar.
- Horarios de atención (varias franjas por día) y días bloqueados (vacaciones, feriados).
- Clientas: ficha con tipo de piel, alergias, notas privadas e historial.
- Gift cards: pedidos, “Pago recibido”, anular, saldo, en qué turno se usó y venta en persona.
- Estadísticas mensuales: ingresos, turnos, ausencias, tratamientos más pedidos.
- Configuración: datos de contacto, video, seña, reglas de reserva, política de cancelación.

## Tecnología

Next.js 15 (App Router, TypeScript) · PostgreSQL + Prisma · Tailwind CSS 4 · Nodemailer.

---

## Puesta en marcha (gratis, sin dominio propio)

Todo se hace desde el navegador; no hace falta instalar nada.

### 1. Mails — contraseña de aplicación de Gmail
1. En la cuenta de Gmail que va a enviar los mails, activar la **verificación en 2 pasos**.
2. Entrar a <https://myaccount.google.com/apppasswords>, crear una contraseña (nombre: "Turnos") y copiar las 16 letras.

### 2. Publicar — Vercel
1. Entrar a <https://vercel.com> con la cuenta de GitHub → **Add New → Project** → importar este repositorio.
2. Antes de tocar *Deploy*, en **Environment Variables** cargar:

   | Variable | Valor |
   |---|---|
   | `ADMIN_PASSWORD` | La contraseña para entrar al panel |
   | `AUTH_SECRET` | Una cadena larga al azar (mín. 32 caracteres) |
   | `CRON_SECRET` | Otra cadena larga al azar |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | La cuenta de Gmail |
   | `SMTP_PASS` | La contraseña de aplicación (16 letras) |
   | `EMAIL_FROM` | `MC Healthy Skin <la-cuenta@gmail.com>` |

3. Tocar **Deploy**. El primer intento puede fallar porque falta la base: es normal.
4. En el proyecto: **Storage → Create Database → Neon** (plan gratis) → conectarla al proyecto.
   Esto agrega solo `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.
5. **Deployments → ⋯ → Redeploy**. Al publicar se crean las tablas y se cargan los tratamientos y horarios.
6. Entrar a `https://<tu-proyecto>.vercel.app/admin` con `ADMIN_PASSWORD` y completar **Configuración**
   (email de la profesional, WhatsApp, alias/CBU para la seña, Instagram, dirección, "Sobre mí", video).
7. En **Configuración → Probar el envío de mails** mandar un mail de prueba, y hacer una reserva de prueba.

Más adelante se puede conectar un dominio propio (ej: `healthyskin.com.ar` en NIC Argentina) desde Vercel → Settings → Domains.

### Recordatorios
`vercel.json` programa `/api/cron/recordatorios` todos los días a las 10:00 (hora Argentina).
Vercel lo llama con el `CRON_SECRET` configurado.

### Video de presentación
En **Configuración → Video de presentación** pegá un link de YouTube (puede ser “no listado”) o Vimeo.
También podés subir un `.mp4` a la carpeta `public/` (ej: `public/presentacion.mp4`) y poner `/presentacion.mp4`.

---

## Desarrollo local

```bash
cp .env.example .env        # completar DATABASE_URL y DATABASE_URL_UNPOOLED como mínimo
npm install
npx prisma migrate deploy   # crea las tablas
npm run db:seed             # tratamientos y horarios de ejemplo
npm run dev                 # http://localhost:3000  ·  panel en /admin
```

Sin `SMTP_*` configurado, los mails no se envían y se muestran en la consola.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests unitarios. Con `TEST_DATABASE_URL` (una base **vacía y descartable**) corre también los de reservas, pagos y cancelaciones |
| `npm run lint` | Chequeo de tipos |
| `npm run build` | Build de producción |
| `npm run db:seed` | Datos iniciales |

## Estructura

```
prisma/schema.prisma        Modelo de datos (Servicio, Turno, Clienta, Horarios, Bloqueos, Configuración)
src/app/(sitio)/            Web pública: inicio, /reservar, /reserva/[id]
src/app/admin/              Panel de administración
src/app/api/                Disponibilidad y cron de recordatorios
src/lib/turnos.ts           Lógica de reservas, pagos y cancelaciones
src/lib/slots.ts            Cálculo de horarios libres
src/lib/plantillas-email.ts Mails
```

## Licencia
GPL v3.
