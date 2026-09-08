'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { diasRestantes, HITOS_DIAS } = require('../src/jobs/alertaVencimientoCredenciales');

test('diasRestantes calcula dias enteros hacia una fecha futura', () => {
  const hoy = new Date();
  const enTreintaDias = new Date(hoy.getTime() + 30 * 86400000);
  const fechaISO = enTreintaDias.toISOString().slice(0, 10);
  assert.equal(diasRestantes(fechaISO), 30);
});

test('diasRestantes da 0 el mismo dia y negativo si ya vencio', () => {
  const hoyISO = new Date().toISOString().slice(0, 10);
  assert.equal(diasRestantes(hoyISO), 0);

  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  assert.equal(diasRestantes(ayer), -1);
});

test('HITOS_DIAS incluye los avisos esperados', () => {
  assert.deepEqual(HITOS_DIAS, [30, 14, 7, 3, 1, 0]);
});
