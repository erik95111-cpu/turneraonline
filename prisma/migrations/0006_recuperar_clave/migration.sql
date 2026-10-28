-- CreateTable
CREATE TABLE "RecuperacionClave" (
    "id" TEXT NOT NULL,
    "administradorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecuperacionClave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecuperacionClave_tokenHash_key" ON "RecuperacionClave"("tokenHash");

-- CreateIndex
CREATE INDEX "RecuperacionClave_administradorId_createdAt_idx" ON "RecuperacionClave"("administradorId", "createdAt");

-- AddForeignKey
ALTER TABLE "RecuperacionClave" ADD CONSTRAINT "RecuperacionClave_administradorId_fkey" FOREIGN KEY ("administradorId") REFERENCES "Administrador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

