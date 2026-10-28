# Capítulo 2 · La base de datos

La base de datos es el **archivo con fichas** del negocio: guarda tratamientos, horarios, clientas, turnos y la configuración.
Antes de escribir pantallas hay que decidir **qué se guarda**. Eso se escribe en el "plano": `prisma/schema.prisma`.

**Palabras nuevas:**
- **Tabla / modelo:** un tipo de ficha (por ejemplo "Turno").
- **Fila / registro:** una ficha concreta (el turno de Lucía del sábado a las 10).
- **Campo / columna:** un dato de la ficha (la hora de inicio).
- **id:** el número de documento de cada ficha. No se repite nunca.
- **Relación:** una ficha que apunta a otra (el turno apunta a la clienta).

---

## `prisma/schema.prisma` — el plano de la base

En este archivo, `//` y `///` son comentarios.

```prisma
generator client {                                       // "Generador": qué código crear a partir de este plano
  provider = "prisma-client-js"                          // Crear el "Prisma Client" para JavaScript/TypeScript (el que usamos como prisma.turno.findMany…)
}                                                        // Fin

datasource db {                                          // "Fuente de datos": a qué base conectarse
  provider = "postgresql"                                // La base es PostgreSQL
  url       = env("DATABASE_URL")                        // Dirección de la base: se lee de la variable DATABASE_URL
  directUrl = env("DATABASE_URL_UNPOOLED")               // Conexión directa, para las migraciones (la versión con "pool" comparte conexiones y no sirve para cambiar tablas)
}                                                        // Fin

model Administrador {                                    // TABLA: personas que entran al panel (la profesional, una secretaria…)
  id            String    @id @default(cuid())           // Identificador único. @id = es el "documento". cuid() = se inventa uno al azar solo (ej: "clx3k9…")
  nombre        String                                   // Nombre. String = texto
  email         String    @unique                        // Email. @unique = no puede haber dos usuarios con el mismo email
  passwordHash  String                                   // La contraseña "picada" (nunca la contraseña real)
  activo        Boolean   @default(true)                 // ¿Puede entrar? Boolean = sí/no. Por defecto, sí
  version       Int       @default(0)                    // Número que sube cada vez que cambia la contraseña. Int = número entero. Sirve para cerrar las sesiones viejas
  ultimoIngreso DateTime?                                // Fecha y hora del último ingreso. "?" = puede estar vacío (si nunca entró)
  createdAt     DateTime  @default(now())                // Cuándo se creó. now() = se completa solo con la hora actual
  updatedAt     DateTime  @updatedAt                     // Cuándo se modificó por última vez (se actualiza solo)
}                                                        // Fin

model IntentoLogin {                                     // TABLA: intentos fallidos de ingreso (freno a la fuerza bruta)
  id       String   @id @default(cuid())                 // Identificador único
  clave    String                                        // "ip:<dirección>" o "usuario:<email>"
  creadoEn DateTime @default(now())                      // Cuándo fue el intento

  @@index([clave, creadoEn])                             // ÍNDICE: como el índice de un libro, hace rápido buscar "intentos de esta clave desde tal hora"
}                                                        // Fin

model Servicio {                                         // TABLA: tratamientos que ofrece la profesional
  id          String   @id @default(cuid())              // Identificador único
  nombre      String                                     // Nombre ("Higiene profunda")
  descripcion String   @default("")                      // Descripción. Por defecto, vacía
  categoria   String   @default("Faciales")              // Categoría. Por defecto "Faciales"
  duracionMin Int                                        // Duración en minutos
  precio      Int                                        // Precio en pesos, sin centavos
  activo      Boolean  @default(true)                    // ¿Se ofrece? Si es false, queda oculto pero no se borra (no se pierde el historial)
  orden       Int      @default(0)                       // Para ordenar la lista (0 primero)
  turnos      Turno[]                                    // RELACIÓN: todos los turnos de este tratamiento. "[]" = una lista. No es una columna: Prisma lo arma solo
  createdAt   DateTime @default(now())                   // Cuándo se creó
  updatedAt   DateTime @updatedAt                        // Última modificación
}                                                        // Fin

model HorarioAtencion {                                  // TABLA: franjas de atención semanales. Puede haber varias por día (mañana y tarde)
  id         String @id @default(cuid())                 // Identificador único
  diaSemana  Int                                         // Día: 0 = domingo, 1 = lunes … 6 = sábado
  horaInicio String                                      // Desde ("09:00"), en hora de Argentina
  horaFin    String                                      // Hasta ("13:00")
}                                                        // Fin

model Bloqueo {                                          // TABLA: períodos sin turnos (vacaciones, feriados, trámites)
  id     String   @id @default(cuid())                   // Identificador único
  desde  DateTime                                        // Desde qué fecha y hora
  hasta  DateTime                                        // Hasta qué fecha y hora
  motivo String   @default("")                           // Motivo (opcional)
}                                                        // Fin

model Clienta {                                          // TABLA: clientas
  id        String   @id @default(cuid())                // Identificador único
  nombre    String                                       // Nombre y apellido
  email     String   @unique                             // Email (único: la misma clienta se reconoce por su email)
  telefono  String                                       // Teléfono o WhatsApp
  tipoPiel  String   @default("")                        // FICHA: tipo de piel (lo completa la profesional)
  alergias  String   @default("")                        // FICHA: alergias
  notas     String   @default("")                        // FICHA: notas privadas
  turnos    Turno[]                                      // RELACIÓN: todos sus turnos
  createdAt DateTime @default(now())                     // Cuándo se creó
  updatedAt DateTime @updatedAt                          // Última modificación
}                                                        // Fin

enum EstadoTurno {                                       // ENUM: lista cerrada de valores posibles para el estado de un turno
  PENDIENTE_PAGO                                         // Reservado, esperando la seña
  CONFIRMADO                                             // Confirmado
  CANCELADO                                              // Cancelado
  COMPLETADO                                             // Ya se hizo
  AUSENTE                                                // La clienta no vino
}                                                        // Fin

model Turno {                                            // TABLA: los turnos. El corazón del sistema
  id                  String      @id @default(cuid())   // Identificador único
  clientaId           String                             // El id de la clienta (la "flecha" hacia su ficha)
  clienta             Clienta     @relation(fields: [clientaId], references: [id])
                                                         // RELACIÓN: "clientaId apunta al id de una Clienta". Permite pedir el turno con los datos de la clienta incluidos
  servicioId          String                             // El id del tratamiento
  servicio            Servicio    @relation(fields: [servicioId], references: [id])
                                                         // RELACIÓN con el tratamiento
  inicio              DateTime                           // Fecha y hora de inicio (guardada en UTC, la hora "universal")
  fin                 DateTime                           // Fecha y hora de fin
  estado              EstadoTurno @default(PENDIENTE_PAGO)
                                                         // Estado (uno de la lista de arriba). Por defecto, esperando la seña
  precio              Int                                // Precio al momento de reservar. "Congelado": si después cambia el precio, este turno no cambia
  montoSena           Int         @default(0)            // Monto de la seña. 0 = sin seña
  expiraEn            DateTime?                          // Si sigue esperando la seña después de esta hora, el horario se libera
  mpPreferenceId      String?                            // Restos de cuando se cobraba con Mercado Pago (hoy no se usan)
  mpPaymentId         String?                            // Ídem
  pagoEstado          String?                            // Cómo se pagó la seña (ej: "transferencia")
  notasClienta        String      @default("")           // Comentarios que dejó la clienta al reservar
  token               String      @unique @default(cuid())
                                                         // "Llave" secreta del turno: va en el link del mail para ver o cancelar sin contraseña
  recordatorioEnviado Boolean     @default(false)        // ¿Ya se mandó el recordatorio del día anterior?
  creadoPorAdmin      Boolean     @default(false)        // ¿Lo cargó la profesional desde el panel?
  createdAt           DateTime    @default(now())        // Cuándo se creó
  updatedAt           DateTime    @updatedAt             // Última modificación

  @@index([inicio])                                      // Índice para buscar rápido por fecha (la agenda lo usa todo el tiempo)
  @@index([estado])                                      // Índice para buscar rápido por estado
}                                                        // Fin

enum TipoSena {                                          // ENUM: tipos de seña
  NINGUNA                                                // No se cobra seña
  PORCENTAJE                                             // Un porcentaje del precio
  FIJO                                                   // Un monto fijo
}                                                        // Fin

model Configuracion {                                    // TABLA: configuración del negocio. Tiene UNA SOLA fila (id = 1)
  id                   Int      @id @default(1)          // Siempre 1
  nombreNegocio        String   @default("MC Healthy Skin")
                                                         // Nombre del negocio
  nombreProfesional    String   @default("")             // Nombre de la profesional
  emailProfesional     String   @default("")             // Email donde le llegan los avisos
  whatsapp             String   @default("")             // Número de WhatsApp
  instagram            String   @default("")             // Usuario de Instagram
  direccion            String   @default("")             // Dirección del consultorio
  sobreMi              String   @default("")             // Texto "Sobre mí"
  videoUrl             String   @default("")             // Link del video de presentación (YouTube, Vimeo o .mp4)
  senaTipo             TipoSena @default(FIJO)           // Tipo de seña. Por defecto, monto fijo
  senaValor            Int      @default(10000)          // Porcentaje (0 a 100) o monto en pesos, según el tipo
  cbu                  String   @default("")             // CBU/CVU para transferir la seña
  alias                String   @default("")             // Alias para transferir
  titularCuenta        String   @default("")             // Titular de la cuenta
  banco                String   @default("")             // Banco
  horasParaSena        Int      @default(24)             // Horas que se guarda el horario esperando el comprobante
  intervaloMin         Int      @default(30)             // Cada cuántos minutos se ofrecen horarios (9:00, 9:30, 10:00…)
  anticipacionMinHoras Int      @default(3)              // No se puede reservar con menos de estas horas de anticipación
  diasMaxReserva       Int      @default(45)             // Hasta cuántos días hacia adelante se puede reservar
  horasParaCancelar    Int      @default(24)             // Hasta cuántas horas antes la clienta puede cancelar online
  politicaCancelacion  String   @default("Podés cancelar sin costo hasta 24 hs antes del turno. Pasado ese plazo la seña no se reintegra.")
                                                         // Texto de la política de cancelación
  updatedAt            DateTime @updatedAt               // Última modificación
}                                                        // Fin
```

---

## Las migraciones — `prisma/migrations/`

El plano dice cómo **tiene que ser** la base. Las **migraciones** son los pasos, en orden, para llevar una base real hasta ese plano.
Prisma las escribe solas en SQL (el idioma de la base) cada vez que se cambia el plano.
Cada una se aplica **una sola vez**: Prisma anota cuáles ya aplicó en una tabla interna, `_prisma_migrations`.

| Carpeta | Qué hace |
|---|---|
| `0001_init` | Crea todas las tablas iniciales: Servicio, HorarioAtencion, Bloqueo, Clienta, Turno, Configuracion, y los enums |
| `0002_administradores` | Crea la tabla Administrador (usuarios del panel con email y contraseña) |
| `0003_sena_transferencia` | Cambia la seña de Mercado Pago a transferencia: agrega alias, CBU, titular, banco y horas para la seña |
| `0004_seguridad` | Crea IntentoLogin y activa RLS en todas las tablas (ver guía de seguridad) |

La `0001` tiene 126 líneas, y todas siguen el mismo patrón. Por eso acá va explicada una tabla completa; las demás son iguales, con las columnas del plano de arriba.

```sql
CREATE SCHEMA IF NOT EXISTS "public";                    -- Crea el "esquema" (la carpeta de tablas) public, si no existe

CREATE TYPE "EstadoTurno" AS ENUM ('PENDIENTE_PAGO', 'CONFIRMADO', 'CANCELADO', 'COMPLETADO', 'AUSENTE');
                                                         -- Crea el tipo "EstadoTurno" con esos 5 valores posibles

CREATE TABLE "Servicio" (                                -- Crea la tabla Servicio con estas columnas:
    "id" TEXT NOT NULL,                                  -- id: texto, obligatorio (NOT NULL = no puede quedar vacío)
    "nombre" TEXT NOT NULL,                              -- nombre: texto, obligatorio
    "descripcion" TEXT NOT NULL DEFAULT '',              -- descripcion: texto, obligatorio, vacío por defecto
    "categoria" TEXT NOT NULL DEFAULT 'Faciales',        -- categoria: por defecto 'Faciales'
    "duracionMin" INTEGER NOT NULL,                      -- duracionMin: número entero
    "precio" INTEGER NOT NULL,                           -- precio: número entero
    "activo" BOOLEAN NOT NULL DEFAULT true,              -- activo: sí/no, por defecto sí
    "orden" INTEGER NOT NULL DEFAULT 0,                  -- orden: número, por defecto 0
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                         -- createdAt: fecha y hora (con milisegundos), por defecto "ahora"
    "updatedAt" TIMESTAMP(3) NOT NULL,                   -- updatedAt: fecha y hora

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")        -- REGLA: "id" es la clave principal (no se repite, identifica la fila)
);                                                       -- Fin de la tabla

CREATE UNIQUE INDEX "Clienta_email_key" ON "Clienta"("email");
                                                         -- Índice ÚNICO: dos clientas no pueden tener el mismo email (es el @unique del plano)

CREATE INDEX "Turno_inicio_idx" ON "Turno"("inicio");    -- Índice común: buscar turnos por fecha rápido (el @@index del plano)

ALTER TABLE "Turno" ADD CONSTRAINT "Turno_clientaId_fkey" FOREIGN KEY ("clientaId") REFERENCES "Clienta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
                                                         -- RELACIÓN ("clave foránea"): Turno.clientaId tiene que ser el id de una Clienta que exista.
                                                         -- RESTRICT = no se puede borrar una clienta que tenga turnos. CASCADE = si cambia el id, se actualiza en sus turnos
```

**`0003_sena_transferencia`**, completa:

```sql
ALTER TABLE "Configuracion" DROP COLUMN "minutosParaPagar",
                                                         -- Modifica la tabla Configuracion: borra la columna "minutosParaPagar" (era de Mercado Pago)
ADD COLUMN     "alias" TEXT NOT NULL DEFAULT '',         -- y agrega la columna alias
ADD COLUMN     "banco" TEXT NOT NULL DEFAULT '',         -- banco
ADD COLUMN     "cbu" TEXT NOT NULL DEFAULT '',           -- cbu
ADD COLUMN     "horasParaSena" INTEGER NOT NULL DEFAULT 24,
                                                         -- horasParaSena (24 por defecto)
ADD COLUMN     "titularCuenta" TEXT NOT NULL DEFAULT '';  -- titularCuenta. El ";" termina la instrucción
```

`migration_lock.toml` solo dice `provider = "postgresql"`: deja anotado que las migraciones están escritas para PostgreSQL.

---

## `prisma/seed.ts` — los datos iniciales

"Seed" = semilla: lo que se planta en una base vacía para que la página arranque con algo.
Corre en cada deploy, pero **solo carga si las tablas están vacías**. Si la profesional ya cambió precios o horarios, no los pisa.

```ts
import { PrismaClient } from "@prisma/client";           // Trae Prisma
import { completarVariablesDB } from "../src/lib/env-db";
                                                         // Trae la función que acomoda las variables de la base

completarVariablesDB();                                  // La ejecuta

const prisma = new PrismaClient();                       // Abre una conexión a la base

const servicios = [                                      // Lista de tratamientos iniciales. Cada { … } es uno:
  { categoria: "Faciales", nombre: "Higiene básica y renovación cutánea", duracionMin: 60, precio: 45000,
    descripcion: "Limpieza, exfoliación e hidratación para renovar la piel y devolverle luminosidad." },
                                                         // Facial, 60 minutos, $45.000, con su descripción
  // … (los demás tratamientos siguen el mismo formato: 6 faciales, 5 corporales y 1 capilar) …
];                                                       // Fin de la lista

async function main() {                                  // La función principal
  await prisma.configuracion.upsert({                    // "upsert" = actualizar si existe, crear si no existe
    where: { id: 1 },                                    // Busca la fila 1 de Configuracion
    update: {},                                          // Si existe: no cambia nada (no pisa lo que configuró la profesional)
    create: { id: 1, senaTipo: "FIJO", senaValor: 10000 },
                                                         // Si no existe: la crea con seña fija de $10.000
  });                                                    // Fin

  if ((await prisma.servicio.count()) === 0) {           // Si no hay ningún tratamiento cargado…
    await prisma.servicio.createMany({ data: servicios.map((s, i) => ({ ...s, orden: i })) });
                                                         // … crea todos los de la lista, cada uno con su número de orden (0, 1, 2…)
    console.log(`✓ ${servicios.length} tratamientos`);   // … y avisa cuántos cargó
  }                                                      // Fin

  if ((await prisma.horarioAtencion.count()) === 0) {    // Si no hay horarios cargados…
    await prisma.horarioAtencion.createMany({            // … crea estos dos:
      data: [                                            //
        { diaSemana: 6, horaInicio: "09:00", horaFin: "13:00" },
                                                         //   sábado (6) de 9 a 13
        { diaSemana: 6, horaInicio: "14:00", horaFin: "18:00" },
                                                         //   sábado de 14 a 18
      ],                                                 //
    });                                                  //
    console.log("✓ Horarios: sábados 9-13 y 14-18");    // … y avisa
  }                                                      // Fin
}                                                        // Fin de main

main()                                                   // Ejecuta main…
  .catch((e) => {                                        // … si falla:
    console.error(e);                                    //   muestra el error
    process.exit(1);                                     //   y termina con error (corta el deploy)
  })                                                     //
  .finally(() => prisma.$disconnect());                  // … y, salga bien o mal, cierra la conexión
```
