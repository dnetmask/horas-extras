#!/bin/sh
set -e

echo "Aplicando migraciones de Prisma..."
npx prisma migrate deploy

echo "Sembrando reglas de recargo / festivos / admin inicial..."
node prisma/seed.js

exec "$@"
