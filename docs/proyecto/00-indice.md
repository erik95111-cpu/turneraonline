# El proyecto entero, paso a paso

Esta es una guía para entender **todo** el sistema de turnos de MC Healthy Skin, en el mismo orden en que se construye una aplicación así.
Cada capítulo muestra el código real del proyecto. Cada línea tiene al lado, después de `//`, una explicación de qué hace.

> **Antes de empezar:** leé el "mini diccionario" que está al principio de [`../guia-codigo-seguridad.md`](../guia-codigo-seguridad.md).
> Ahí se explican `const`, `async`/`await`, `try`/`catch`, `?.`, `??`, `=>`, etc. Aparecen en todas las líneas.

---

## ¿Qué es este proyecto?

Una página web donde:
- **las clientas** eligen un tratamiento, un día y un horario, y reservan su turno;
- **la profesional** (y quien ella habilite) administra todo desde un **panel** en `/admin`.

## Las piezas (la "receta")

| Pieza | Qué es | Analogía |
|---|---|---|
| **Next.js** | El "armazón" de la página: arma las pantallas y corre el código del servidor | La estructura de la casa |
| **React** | La forma de escribir las pantallas como piezas reutilizables ("componentes") | Los ladrillos |
| **TypeScript** | JavaScript con "tipos": avisa los errores antes de que lleguen a la clienta | El inspector de obra |
| **PostgreSQL (Neon)** | La base de datos: donde se guardan turnos, clientas, tratamientos… | El archivo con fichas |
| **Prisma** | La biblioteca que traduce "dame los turnos de hoy" al idioma de la base | El empleado que busca las fichas |
| **Tailwind CSS** | La forma de darle estilo (colores, tamaños) | La pintura y la decoración |
| **Nodemailer** | La biblioteca que manda los mails por Gmail | El cartero |
| **Vercel** | Donde vive la página publicada en internet | El terreno donde está la casa |

## Servidor y navegador

Esta es la idea más importante para entender el código:

- **El navegador** es el celular o la compu de la clienta. Ahí corre el código que tiene `"use client"` arriba: botones, calendario, formularios. **Cualquiera puede ver ese código**, así que nunca lleva claves.
- **El servidor** es la compu de Vercel. Ahí corre todo lo demás: la base de datos, las contraseñas, los mails. **La clienta nunca ve ese código.**

## Recorrido de una reserva

1. La clienta abre `/reservar`. El **servidor** lee los tratamientos de la base y arma la página.
2. Elige un tratamiento y un día. El **navegador** le pregunta al servidor qué horarios hay libres (`/api/disponibilidad`).
3. Completa sus datos y toca "Confirmar". El **navegador** llama a `reservarTurno` en el **servidor**.
4. El servidor revisa que el horario siga libre, guarda el turno en la base y manda los mails.
5. La clienta ve la página de su turno (`/reserva/…`), con los datos para transferir la seña.

## Los capítulos

Están ordenados como se construye una app: primero los cimientos, después lo de adentro y al final lo que se ve.

| # | Capítulo | Qué vas a aprender |
|---|---|---|
| 1 | [Configuración](01-configuracion.md) | Las piezas que usa el proyecto y cómo se ajustan |
| 2 | [Base de datos](02-base-de-datos.md) | Qué se guarda y cómo: tablas, migraciones, datos iniciales |
| 3 | [Herramientas](03-herramientas.md) | Funciones chiquitas que usa todo el proyecto: fechas, precios, horarios libres |
| 4 | [Reservas y mails](04-reservas-y-mails.md) | El corazón del sistema: reservar, confirmar la seña, cancelar, mandar mails |
| 5 | [Sitio público](05-sitio-publico.md) | Lo que ven las clientas: inicio, reservar, su turno, y los estilos |
| 5b | [Componentes](05b-componentes.md) | Las piezas de pantalla: formulario de reserva, calendario, portada animada… |
| 6 | [Panel: marco y acciones](06-panel.md) | El menú del panel y todo lo que guarda, cancela o modifica |
| 6b | [Panel: pantallas](06b-panel-pantallas.md) | Agenda, turnos, tratamientos, horarios, clientas, estadísticas, configuración, usuarios |
| 7 | [Tests y publicación](07-tests-y-publicacion.md) | Cómo se comprueba que todo funcione y cómo se publica |

La parte de seguridad (login, sesiones, RLS, etiquetas de errores) ya está explicada línea por línea en
[`../guia-codigo-seguridad.md`](../guia-codigo-seguridad.md). Cuando un capítulo llega a esos archivos, te manda ahí.

## Mapa de carpetas

```
turneraonline/
├── package.json            ← lista de piezas (bibliotecas) y comandos
├── next.config.ts          ← ajustes de Next.js (encabezados de seguridad)
├── prisma/
│   ├── schema.prisma       ← el "plano" de la base de datos
│   ├── migrations/         ← los cambios a la base, en orden
│   ├── rls.sql             ← seguridad de la base
│   └── seed.ts             ← datos iniciales (tratamientos, horarios)
├── scripts/                ← pasos automáticos del deploy
├── public/                 ← imágenes que se sirven tal cual (logo)
└── src/
    ├── middleware.ts       ← el "portero" del panel
    ├── lib/                ← la lógica: fechas, turnos, mails, sesiones
    ├── components/         ← piezas de pantalla reutilizables
    └── app/                ← las PÁGINAS. Cada carpeta es una dirección web:
        ├── layout.tsx              → el marco de todo el sitio
        ├── (sitio)/page.tsx        → "/"  (inicio)
        ├── (sitio)/reservar/       → "/reservar"
        ├── (sitio)/reserva/[id]/   → "/reserva/<número de turno>"
        ├── admin/                  → "/admin/…" (el panel)
        └── api/                    → direcciones que devuelven datos, no pantallas
```

> **Dato de Next.js:** una carpeta entre paréntesis, como `(sitio)` o `(panel)`, **no** aparece en la dirección web.
> Sirve solo para agrupar páginas que comparten el mismo marco (layout).
> Una carpeta entre corchetes, como `[id]`, es un dato que cambia: `/reserva/abc123` → `id = "abc123"`.
