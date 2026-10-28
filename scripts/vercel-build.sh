#!/bin/sh
# Build en Vercel: completa las variables de la base, crea/actualiza tablas,
# activa la seguridad de la base (RLS), carga los datos iniciales (sólo si
# están vacías), compila y verifica que ninguna clave llegue al navegador.
set -e
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-$POSTGRES_URL}}"
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
if [ -z "$DATABASE_URL" ]; then
  echo "Falta la base de datos: en Vercel, Storage → crear una base y conectarla al proyecto." >&2
  exit 1
fi
npx prisma generate
npx prisma migrate deploy
# RLS en todas las tablas (también en las que se agreguen en el futuro).
# La migración 0004 ya lo activó; esto es un refuerzo, por eso si falla sólo avisa.
npx prisma db execute --schema prisma/schema.prisma --file prisma/rls.sql \
  || echo "[LIB:prisma][WARN] no se pudo re-aplicar prisma/rls.sql (la migración 0004 ya activó RLS)" >&2
npx tsx prisma/seed.ts
npx next build
# Corta el deploy si alguna clave quedó en los archivos que baja el navegador
node scripts/verificar-secretos.mjs
