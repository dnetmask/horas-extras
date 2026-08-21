'use strict';

const prisma = require('../db');

function toISO(date) {
  return date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
}

async function obtenerRuleSets() {
  const filas = await prisma.recargoRuleSet.findMany({ orderBy: { vigenteDesde: 'asc' } });
  if (filas.length === 0) {
    throw new Error('No hay reglas de recargo configuradas (tabla recargo_rule_sets vacia). Corre el seed.');
  }
  return filas.map((f) => ({
    vigenteDesde: toISO(f.vigenteDesde),
    horaInicioDiurna: f.horaInicioDiurna,
    horaFinDiurna: f.horaFinDiurna,
    pctExtraDiurna: Number(f.pctExtraDiurna),
    pctExtraNocturna: Number(f.pctExtraNocturna),
    pctDominicalFestivo: Number(f.pctDominicalFestivo),
  }));
}

function elegirRuleSet(ruleSets, fechaISO) {
  let elegido = ruleSets[0];
  for (const rs of ruleSets) {
    if (rs.vigenteDesde <= fechaISO) elegido = rs;
    else break;
  }
  return elegido;
}

/**
 * Construye los callbacks que necesita `calcularHorasExtra` (ver
 * src/lib/recargos.js), resolviendo reglas y festivos vigentes desde la BD.
 * Se asume que el rango de fechas cae en años ya sembrados en `festivos`
 * (el seed carga el año actual y el siguiente; ver prisma/seed.js).
 */
async function construirContextoDeCalculo() {
  const [ruleSets, festivos] = await Promise.all([
    obtenerRuleSets(),
    prisma.festivo.findMany(),
  ]);
  const festivosSet = new Set(festivos.map((f) => toISO(f.fecha)));

  return {
    ruleSetParaFecha: (fechaISO) => elegirRuleSet(ruleSets, fechaISO),
    esDomingoOFestivo: (fechaISO) => {
      const [y, m, d] = fechaISO.split('-').map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      return dow === 0 || festivosSet.has(fechaISO);
    },
  };
}

module.exports = { obtenerRuleSets, elegirRuleSet, construirContextoDeCalculo };
