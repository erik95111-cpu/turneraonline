-- AlterTable
ALTER TABLE "Clienta" ADD COLUMN     "whatsapp" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Turno" ADD COLUMN     "avisarMail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "avisarWhatsapp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "confirmacionWaEn" TIMESTAMP(3),
ADD COLUMN     "recordatorioWaEn" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Clienta_whatsapp_idx" ON "Clienta"("whatsapp");

