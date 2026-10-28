-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "esCombo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "_Combo" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Combo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_Combo_B_index" ON "_Combo"("B");

-- AddForeignKey
ALTER TABLE "_Combo" ADD CONSTRAINT "_Combo_A_fkey" FOREIGN KEY ("A") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Combo" ADD CONSTRAINT "_Combo_B_fkey" FOREIGN KEY ("B") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

