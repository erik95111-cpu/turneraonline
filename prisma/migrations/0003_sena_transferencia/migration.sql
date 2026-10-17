-- AlterTable
ALTER TABLE "Configuracion" DROP COLUMN "minutosParaPagar",
ADD COLUMN     "alias" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "banco" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cbu" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "horasParaSena" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "titularCuenta" TEXT NOT NULL DEFAULT '';

