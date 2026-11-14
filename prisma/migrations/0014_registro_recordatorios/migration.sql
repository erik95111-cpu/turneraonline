-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "recordatoriosAutoEn" TIMESTAMP(3),
ADD COLUMN     "recordatoriosAutoResultado" TEXT NOT NULL DEFAULT '';
