'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularHorasExtra, ruleSetVigente } = require('../src/lib/recargos');
const { festivosDelAno } = require('../src/lib/festivos');

const REGLA_2026 = {
  horaInicioDiurna: '06:00',
  horaFinDiurna: '19:00',
  pctExtraDiurna: 0.25,
  pctExtraNocturna: 0.75,
  pctDominicalFestivo: 0.9,
};

const sinFestivos = () => false;
const reglaFija = () => REGLA_2026;

test('turno simple dentro del mismo día, parte en diurna y nocturna', () => {
  // Jueves 2026-08-20, 18:00 a 21:00 -> 1h diurna (18-19) + 2h nocturna (19-21)
  const r = calcularHorasExtra({
    fecha: '2026-08-20',
    horaInicio: '18:00',
    horaFin: '21:00',
    ruleSetParaFecha: reglaFija,
    esDomingoOFestivo: sinFestivos,
  });
  assert.equal(r.horasExtraDiurnaOrd, 1);
  assert.equal(r.horasExtraNocturnaOrd, 2);
  assert.equal(r.horasExtraDiurnaDomFest, 0);
  assert.equal(r.horasExtraNocturnaDomFest, 0);
  assert.equal(r.horasTotales, 3);
});

test('turno todo diurno', () => {
  const r = calcularHorasExtra({
    fecha: '2026-08-20',
    horaInicio: '09:00',
    horaFin: '11:00',
    ruleSetParaFecha: reglaFija,
    esDomingoOFestivo: sinFestivos,
  });
  assert.equal(r.horasExtraDiurnaOrd, 2);
  assert.equal(r.horasTotales, 2);
});

test('turno que cruza medianoche de un sábado (ordinario) a un domingo (festivo)', () => {
  // Sábado 2026-08-22 22:00 -> domingo 2026-08-23 02:00
  const esFestivo = (fechaISO) => fechaISO === '2026-08-23'; // domingo
  const r = calcularHorasExtra({
    fecha: '2026-08-22',
    horaInicio: '22:00',
    horaFin: '02:00',
    ruleSetParaFecha: reglaFija,
    esDomingoOFestivo: esFestivo,
  });
  // 22:00-24:00 sabado -> 2h nocturna ordinaria
  // 00:00-02:00 domingo -> 2h nocturna dominical/festiva
  assert.equal(r.horasExtraNocturnaOrd, 2);
  assert.equal(r.horasExtraNocturnaDomFest, 2);
  assert.equal(r.horasExtraDiurnaOrd, 0);
  assert.equal(r.horasExtraDiurnaDomFest, 0);
  assert.equal(r.horasTotales, 4);
});

test('turno de 2h que cruza la frontera diurna/nocturna un domingo', () => {
  const esFestivo = () => true;
  const r = calcularHorasExtra({
    fecha: '2026-08-23',
    horaInicio: '18:00',
    horaFin: '20:00',
    ruleSetParaFecha: reglaFija,
    esDomingoOFestivo: esFestivo,
  });
  assert.equal(r.horasExtraDiurnaDomFest, 1); // 18-19
  assert.equal(r.horasExtraNocturnaDomFest, 1); // 19-20
  assert.equal(r.horasExtraDiurnaOrd, 0);
  assert.equal(r.horasExtraNocturnaOrd, 0);
});

test('ruleSetVigente elige la regla correcta segun la fecha', () => {
  const reglas = [
    { vigenteDesde: '2026-01-01', pctDominicalFestivo: 0.9 },
    { vigenteDesde: '2027-07-01', pctDominicalFestivo: 1.0 },
  ];
  assert.equal(ruleSetVigente(reglas, '2026-08-20').pctDominicalFestivo, 0.9);
  assert.equal(ruleSetVigente(reglas, '2027-07-01').pctDominicalFestivo, 1.0);
  assert.equal(ruleSetVigente(reglas, '2027-06-30').pctDominicalFestivo, 0.9);
});

test('festivosDelAno incluye festivos fijos y moviles esperados para 2026', () => {
  const festivos = festivosDelAno(2026);
  const porNombre = Object.fromEntries(festivos.map((f) => [f.nombre, f.fecha]));
  assert.equal(porNombre['Año Nuevo'], '2026-01-01');
  assert.equal(porNombre['Día del Trabajo'], '2026-05-01');
  assert.equal(porNombre['Independencia de Colombia'], '2026-07-20');
  assert.equal(porNombre['Navidad'], '2026-12-25');
  // Reyes Magos (6 enero 2026 es martes) se traslada al lunes siguiente (12 enero)
  assert.equal(porNombre['Día de los Reyes Magos'], '2026-01-12');
});
