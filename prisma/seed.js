'use strict';

const { PrismaClient } = require('@prisma/client');
const { festivosDelAno } = require('../src/lib/festivos');

const prisma = new PrismaClient();

// Reglas de recargo vigentes segun la reforma laboral colombiana (Ley
// 2101/2021 + Ley 2466/2025). Ver el plan/README para las fuentes. Si la ley
// vuelve a cambiar, agregar una fila nueva via POST /api/reglas-recargo (rol
// admin) en vez de editar este seed.
const REGLAS_RECARGO = [
  {
    vigenteDesde: '2000-01-01', // piso historico, cubre cualquier fecha anterior a la reforma
    horaInicioDiurna: '06:00',
    horaFinDiurna: '21:00',
    pctExtraDiurna: 0.25,
    pctExtraNocturna: 0.75,
    pctDominicalFestivo: 0.75,
    nota: 'Regimen previo a la Ley 2466/2025 (Ley 789/2002): recargo dominical/festivo 75%, jornada nocturna 21:00-06:00.',
  },
  {
    vigenteDesde: '2025-07-01', // Ley 2466/2025: sube el recargo dominical/festivo (la jornada nocturna todavia no cambiaba)
    horaInicioDiurna: '06:00',
    horaFinDiurna: '21:00',
    pctExtraDiurna: 0.25,
    pctExtraNocturna: 0.75,
    pctDominicalFestivo: 0.8,
    nota: 'Ley 2466/2025: recargo dominical/festivo sube a 80%. La jornada nocturna todavia es 21:00-06:00 (cambia el 2025-12-25).',
  },
  {
    vigenteDesde: '2025-12-25', // entrada en vigor de la jornada nocturna 19:00-06:00 (Ley 2466/2025)
    horaInicioDiurna: '06:00',
    horaFinDiurna: '19:00',
    pctExtraDiurna: 0.25,
    pctExtraNocturna: 0.75,
    pctDominicalFestivo: 0.8, // vigente hasta 2026-06-30
    nota: 'Ley 2466/2025: jornada nocturna 19:00-06:00. Recargo dominical/festivo 80% (tramo 2025-07-01 a 2026-06-30).',
  },
  {
    vigenteDesde: '2026-07-01',
    horaInicioDiurna: '06:00',
    horaFinDiurna: '19:00',
    pctExtraDiurna: 0.25,
    pctExtraNocturna: 0.75,
    pctDominicalFestivo: 0.9,
    nota: 'Recargo dominical/festivo sube a 90% (Ley 2466/2025).',
  },
  {
    vigenteDesde: '2027-07-01',
    horaInicioDiurna: '06:00',
    horaFinDiurna: '19:00',
    pctExtraDiurna: 0.25,
    pctExtraNocturna: 0.75,
    pctDominicalFestivo: 1.0,
    nota: 'Recargo dominical/festivo llega a su valor pleno de 100% (Ley 2466/2025).',
  },
];

async function seedReglasRecargo() {
  for (const regla of REGLAS_RECARGO) {
    const existente = await prisma.recargoRuleSet.findFirst({
      where: { vigenteDesde: new Date(`${regla.vigenteDesde}T00:00:00Z`) },
    });
    if (existente) continue;
    await prisma.recargoRuleSet.create({
      data: { ...regla, vigenteDesde: new Date(`${regla.vigenteDesde}T00:00:00Z`) },
    });
    console.log(`Regla de recargo sembrada: vigente desde ${regla.vigenteDesde}`);
  }
}

async function seedFestivos() {
  const anoActual = new Date().getUTCFullYear();
  // 2024 en adelante: cubre con margen cualquier registro historico migrado
  // (el mas antiguo conocido es de marzo 2025), ademas de actual+2 a futuro.
  const anos = [];
  for (let a = 2024; a <= anoActual + 2; a++) anos.push(a);
  for (const ano of anos) {
    for (const f of festivosDelAno(ano)) {
      await prisma.festivo.upsert({
        where: { fecha: new Date(`${f.fecha}T00:00:00Z`) },
        update: {},
        create: { fecha: new Date(`${f.fecha}T00:00:00Z`), nombre: f.nombre },
      });
    }
    console.log(`Festivos de ${ano} sembrados/verificados.`);
  }
}

async function seedAdminInicial() {
  const email = process.env.ADMIN_EMAIL_INICIAL;
  if (!email) return;
  const existente = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
  if (existente) return;
  await prisma.usuario.create({
    data: { email: email.toLowerCase(), nombre: email, rol: 'admin' },
  });
  console.log(`Usuario admin inicial precargado: ${email} (rol se confirma al primer login SSO)`);
}

async function main() {
  await seedReglasRecargo();
  await seedFestivos();
  await seedAdminInicial();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
