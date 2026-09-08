'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularHorasExtra, ruleSetVigente, horasCompensablesDe } = require('../src/lib/recargos');
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

test('horasCompensablesDe multiplica cada categoria por su factor de recargo (1 + %)', () => {
  // Sabado 21:00 -> domingo 03:00: 3h nocturna ordinaria + 3h nocturna dom/fest
  // (ver el caso real reportado: 2026-04-11 21:00-03:00, domingo 2026-04-12).
  const regla2026abril = {
    horaInicioDiurna: '06:00',
    horaFinDiurna: '19:00',
    pctExtraDiurna: 0.25,
    pctExtraNocturna: 0.75,
    pctDominicalFestivo: 0.8, // vigente entre 2025-12-25 y 2026-06-30
  };
  const esFestivo = (fechaISO) => fechaISO === '2026-04-12';
  const resultado = calcularHorasExtra({
    fecha: '2026-04-11',
    horaInicio: '21:00',
    horaFin: '03:00',
    ruleSetParaFecha: () => regla2026abril,
    esDomingoOFestivo: esFestivo,
  });
  assert.equal(resultado.horasExtraNocturnaOrd, 3);
  assert.equal(resultado.horasExtraNocturnaDomFest, 3);
  assert.equal(resultado.horasTotales, 6);

  const compensables = horasCompensablesDe(resultado, regla2026abril);
  // 3h * 1.75 (nocturna ordinaria) + 3h * 2.55 (nocturna dom/fest: 1+0.75+0.8) = 5.25 + 7.65
  assert.equal(compensables, 12.9);
});

test('horasCompensablesDe con solo horas diurnas ordinarias usa el factor 1+%extraDiurna', () => {
  const regla = {
    pctExtraDiurna: 0.25,
    pctExtraNocturna: 0.75,
    pctDominicalFestivo: 0.9,
  };
  const resultado = {
    horasExtraDiurnaOrd: 4,
    horasExtraNocturnaOrd: 0,
    horasExtraDiurnaDomFest: 0,
    horasExtraNocturnaDomFest: 0,
  };
  assert.equal(horasCompensablesDe(resultado, regla), 5); // 4 * 1.25
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
