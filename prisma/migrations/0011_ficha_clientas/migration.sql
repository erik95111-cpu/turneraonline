-- AlterTable
ALTER TABLE "Clienta" ADD COLUMN     "direccion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fechaNacimiento" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "NotaClienta" (
    "id" TEXT NOT NULL,
    "clientaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autor" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaClienta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotaClienta_clientaId_createdAt_idx" ON "NotaClienta"("clientaId", "createdAt");

-- AddForeignKey
ALTER TABLE "NotaClienta" ADD CONSTRAINT "NotaClienta_clientaId_fkey" FOREIGN KEY ("clientaId") REFERENCES "Clienta"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Las notas privadas que ya había pasan a ser la primera nota del registro
INSERT INTO "NotaClienta" ("id", "clientaId", "texto", "autor", "createdAt")
SELECT 'nota_' || c."id", c."id", c."notas", '', c."updatedAt"
FROM "Clienta" c WHERE btrim(c."notas") <> '';
