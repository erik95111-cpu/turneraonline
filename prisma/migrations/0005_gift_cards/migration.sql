-- CreateEnum
CREATE TYPE "EstadoGiftCard" AS ENUM ('PENDIENTE_PAGO', 'ACTIVA', 'USADA', 'ANULADA');

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "giftcardMeses" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "giftcardMonto" INTEGER NOT NULL DEFAULT 50000,
ADD COLUMN     "giftcardsActivas" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Turno" ADD COLUMN     "giftCardId" TEXT,
ADD COLUMN     "montoGiftCard" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "servicioId" TEXT,
    "monto" INTEGER NOT NULL,
    "saldo" INTEGER NOT NULL,
    "para" TEXT NOT NULL,
    "de" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL DEFAULT '',
    "compradorEmail" TEXT NOT NULL DEFAULT '',
    "compradorTelefono" TEXT NOT NULL DEFAULT '',
    "estado" "EstadoGiftCard" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "venceEn" TIMESTAMP(3),
    "activadaEn" TIMESTAMP(3),
    "creadaPorAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_codigo_key" ON "GiftCard"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_token_key" ON "GiftCard"("token");

-- CreateIndex
CREATE INDEX "GiftCard_estado_idx" ON "GiftCard"("estado");

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

