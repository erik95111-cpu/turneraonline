#!/bin/sh
# Build en Vercel: completa las variables de la base, crea/actualiza tablas,
# carga los datos iniciales (sólo si están vacías) y compila.
set -e
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-$POSTGRES_URL}}"
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
if [ -z "$DATABASE_URL" ]; then
  echo "Falta la base de datos: en Vercel, Storage → crear una base y conectarla al proyecto." >&2
  exit 1
fi
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
npx next build
