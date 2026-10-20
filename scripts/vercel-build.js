'use strict';

// Build de Vercel (lo invoca "npm run vercel-build", ver vercel.json).
//
// 1. Siempre: genera el cliente de Prisma para el sistema operativo del build.
// 2. Solo en produccion: aplica migraciones y el seed (idempotente) a la base
//    de Neon. En deploys de preview NO se toca la base, para que una rama en
//    prueba no migre la base de produccion.
//
// Las migraciones van por la conexion DIRECTA de Neon (DATABASE_URL_UNPOOLED):
// Prisma Migrate usa bloqueos que no funcionan a traves del pooler.

const { execSync } = require('node:child_process');

function correr(comando, env) {
  console.log(`> ${comando}`);
  execSync(comando, { stdio: 'inherit', env: { ...process.env, ...env } });
}

correr('npx prisma generate');

if (process.env.VERCEL_ENV !== 'production') {
  console.log(`VERCEL_ENV=${process.env.VERCEL_ENV || '(vacio)'}: se omiten migraciones y seed.`);
  process.exit(0);
}

const urlDirecta =
  process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

if (!urlDirecta) {
  console.error(
    'Falta DATABASE_URL en el proyecto de Vercel. Conecta la base Neon al proyecto ' +
      '(Storage > Neon) antes de desplegar a produccion. Ver deploy/vercel/LEEME-VERCEL.md.'
  );
  process.exit(1);
}

correr('npx prisma migrate deploy', { DATABASE_URL: urlDirecta });
correr('node prisma/seed.js', { DATABASE_URL: urlDirecta });
