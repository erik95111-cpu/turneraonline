-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('PENDIENTE_PAGO', 'CONFIRMADO', 'CANCELADO', 'COMPLETADO', 'AUSENTE');

-- CreateEnum
CREATE TYPE "TipoSena" AS ENUM ('NINGUNA', 'PORCENTAJE', 'FIJO');

-- CreateTable
CREATE TABLE "Servicio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL DEFAULT 'Faciales',
    "duracionMin" INTEGER NOT NULL,
    "precio" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioAtencion" (
    "id" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,

    CONSTRAINT "HorarioAtencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloqueo" (
    "id" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Bloqueo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clienta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "tipoPiel" TEXT NOT NULL DEFAULT '',
    "alergias" TEXT NOT NULL DEFAULT '',
    "notas" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clienta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "clientaId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "precio" INTEGER NOT NULL,
    "montoSena" INTEGER NOT NULL DEFAULT 0,
    "expiraEn" TIMESTAMP(3),
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "pagoEstado" TEXT,
    "notasClienta" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false,
    "creadoPorAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombreNegocio" TEXT NOT NULL DEFAULT 'MC Healthy Skin',
    "nombreProfesional" TEXT NOT NULL DEFAULT '',
    "emailProfesional" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "direccion" TEXT NOT NULL DEFAULT '',
    "sobreMi" TEXT NOT NULL DEFAULT '',
    "videoUrl" TEXT NOT NULL DEFAULT '',
    "senaTipo" "TipoSena" NOT NULL DEFAULT 'FIJO',
    "senaValor" INTEGER NOT NULL DEFAULT 10000,
    "intervaloMin" INTEGER NOT NULL DEFAULT 30,
    "anticipacionMinHoras" INTEGER NOT NULL DEFAULT 3,
    "diasMaxReserva" INTEGER NOT NULL DEFAULT 45,
    "minutosParaPagar" INTEGER NOT NULL DEFAULT 20,
    "horasParaCancelar" INTEGER NOT NULL DEFAULT 24,
    "politicaCancelacion" TEXT NOT NULL DEFAULT 'Podés cancelar sin costo hasta 24 hs antes del turno. Pasado ese plazo la seña no se reintegra.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clienta_email_key" ON "Clienta"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Turno_token_key" ON "Turno"("token");

-- CreateIndex
CREATE INDEX "Turno_inicio_idx" ON "Turno"("inicio");

-- CreateIndex
CREATE INDEX "Turno_estado_idx" ON "Turno"("estado");

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_clientaId_fkey" FOREIGN KEY ("clientaId") REFERENCES "Clienta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

