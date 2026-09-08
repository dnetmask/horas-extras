'use strict';

// Recalcula "horasCompensables" (horas ya con el multiplicador de recargo,
// que es lo que se acredita al banco de tiempo compensatorio) para TODOS
// los registros de horas_extra que ya existian antes de que este campo se
// agregara al modelo. Necesario una sola vez despues de desplegar la
// migracion "horas_compensables" - antes de correrlo, todos esos registros
// quedan con horas_compensables=0 (el default de la migracion), lo que
// dejaria el saldo de banco de horas de todo el mundo en cero.
//
// Uso (dentro del contenedor, ya con la imagen construida):
//   docker compose exec app node scripts/recalcular-horas-compensables.js

const { PrismaClient } = require('@prisma/client');
const { horasCompensablesDe } = require('../src/lib/recargos');
const { obtenerRuleSets, elegirRuleSet } = require('../src/lib/reglas');

const prisma = new PrismaClient();

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const ruleSets = await obtenerRuleSets();
  const registros = await prisma.horasExtra.findMany();

  let actualizados = 0;
  for (const r of registros) {
    const ruleSet = elegirRuleSet(ruleSets, toISO(r.fecha));
    const resultado = {
      horasExtraDiurnaOrd: Number(r.horasExtraDiurnaOrd),
      horasExtraNocturnaOrd: Number(r.horasExtraNocturnaOrd),
      horasExtraDiurnaDomFest: Number(r.horasExtraDiurnaDomFest),
      horasExtraNocturnaDomFest: Number(r.horasExtraNocturnaDomFest),
    };
    const horasCompensables = horasCompensablesDe(resultado, ruleSet);

    if (Number(r.horasCompensables) !== horasCompensables) {
      await prisma.horasExtra.update({
        where: { id: r.id },
        data: { horasCompensables },
      });
      actualizados++;
      console.log(`= ${toISO(r.fecha)} ${r.horaInicio}-${r.horaFin}: ${r.horasTotales}h trabajadas -> ${horasCompensables}h compensables`);
    }
  }

  console.log(`\nListo. ${actualizados} de ${registros.length} registros actualizados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
