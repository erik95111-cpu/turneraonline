-- CreateTable
CREATE TABLE "TurnoTratamiento" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "duracionMin" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TurnoTratamiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TurnoTratamiento_turnoId_idx" ON "TurnoTratamiento"("turnoId");

-- CreateIndex
CREATE INDEX "TurnoTratamiento_servicioId_idx" ON "TurnoTratamiento"("servicioId");

-- AddForeignKey
ALTER TABLE "TurnoTratamiento" ADD CONSTRAINT "TurnoTratamiento_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoTratamiento" ADD CONSTRAINT "TurnoTratamiento_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Los turnos que ya existían pasan a tener su único tratamiento en la lista
INSERT INTO "TurnoTratamiento" ("id", "turnoId", "servicioId", "nombre", "precio", "duracionMin", "orden")
SELECT 'tt_' || t."id", t."id", t."servicioId", s."nombre", t."precio",
       GREATEST(1, ROUND(EXTRACT(EPOCH FROM (t."fin" - t."inicio")) / 60))::int, 0
FROM "Turno" t JOIN "Servicio" s ON s."id" = t."servicioId";
