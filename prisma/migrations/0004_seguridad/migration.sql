-- Tabla de intentos de ingreso fallidos (freno a la fuerza bruta en el login)
CREATE TABLE "IntentoLogin" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentoLogin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntentoLogin_clave_creadoEn_idx" ON "IntentoLogin"("clave", "creadoEn");

-- ─── Seguridad de la base: RLS (Row Level Security) ──────────────
--
-- Activa RLS en TODAS las tablas del esquema "public" y les saca los permisos
-- al rol PUBLIC (= cualquier otro usuario de la base).
--
-- ¿Qué significa en la práctica?
--  · La app entra a la base con el usuario DUEÑO de las tablas (el de
--    DATABASE_URL). El dueño no queda limitado por RLS, así que la página
--    sigue funcionando igual.
--  · Cualquier OTRO usuario o acceso (por ejemplo si alguien activa la
--    "Data API" de Neon, crea un usuario de sólo lectura o consigue un
--    usuario que no es el dueño) ve las tablas VACÍAS: no hay ninguna
--    política que le permita leer o escribir filas.
--
-- Es seguro correrlo varias veces. Se ejecuta en cada deploy
-- (scripts/vercel-build.sh), así que si en el futuro se agrega una tabla
-- nueva, queda protegida sola.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tableowner = current_user
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t.tablename);
  END LOOP;
END $$;
