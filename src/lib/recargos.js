'use strict';

// Motor de clasificación de horas extra en las 4 categorías que exige la
// nomina/ley colombiana:
//   - horas extra diurna ordinaria
//   - horas extra nocturna ordinaria
//   - horas extra diurna dominical/festiva
//   - horas extra nocturna dominical/festiva
//
// A diferencia del Excel original, esto SI maneja bien un turno de horas
// extra que cruza la medianoche (incluso si un lado cae en un día hábil y el
// otro en domingo/festivo): se parte el intervalo por cada cruce de
// medianoche, y cada segmento de un solo día calendario se reparte entre la
// ventana diurna/nocturna vigente ese día.

function parseHM(hm) {
  const [h, m] = hm.split(':').map(Number);
  return { h, m };
}

function combinarFechaHora(fechaISO, horaHM) {
  const [y, mo, d] = fechaISO.split('-').map(Number);
  const { h, m } = parseHM(horaHM);
  return new Date(Date.UTC(y, mo - 1, d, h, m, 0));
}

function fechaISODeDate(date) {
  return date.toISOString().slice(0, 10);
}

function medianocheUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function horasEntre(a, b) {
  return Math.max(0, (b.getTime() - a.getTime()) / 3600000);
}

/**
 * Parte [inicio, fin) en segmentos que no cruzan medianoche.
 * @returns {{fechaISO: string, inicio: Date, fin: Date}[]}
 */
function partirPorDiaCalendario(inicio, fin) {
  const segmentos = [];
  let cursor = inicio;
  while (cursor < fin) {
    const finDelDia = addDays(medianocheUTC(cursor), 1);
    const finSegmento = fin < finDelDia ? fin : finDelDia;
    segmentos.push({ fechaISO: fechaISODeDate(cursor), inicio: cursor, fin: finSegmento });
    cursor = finSegmento;
  }
  return segmentos;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Calcula la superposición en horas entre [aInicio,aFin) y la ventana diurna
 * [horaInicioDiurna, horaFinDiurna) del mismo día calendario que `aInicio`.
 */
function horasDiurnasEnSegmento(segInicio, segFin, horaInicioDiurna, horaFinDiurna) {
  const base = medianocheUTC(segInicio);
  const diurnoInicio = combinarFechaHora(fechaISODeDate(base), horaInicioDiurna);
  const diurnoFin = combinarFechaHora(fechaISODeDate(base), horaFinDiurna);
  const inicioSolape = segInicio > diurnoInicio ? segInicio : diurnoInicio;
  const finSolape = segFin < diurnoFin ? segFin : diurnoFin;
  return horasEntre(inicioSolape, finSolape);
}

/**
 * @param {object} params
 * @param {string} params.fecha - YYYY-MM-DD, fecha en que INICIA el turno de horas extra.
 * @param {string} params.horaInicio - "HH:MM"
 * @param {string} params.horaFin - "HH:MM" (si es <= horaInicio, se asume que cruza medianoche)
 * @param {(fechaISO: string) => {horaInicioDiurna: string, horaFinDiurna: string, pctExtraDiurna: number, pctExtraNocturna: number, pctDominicalFestivo: number}} params.ruleSetParaFecha
 * @param {(fechaISO: string) => boolean} params.esDomingoOFestivo
 * @returns {{horasExtraDiurnaOrd: number, horasExtraNocturnaOrd: number, horasExtraDiurnaDomFest: number, horasExtraNocturnaDomFest: number, horasTotales: number}}
 */
function calcularHorasExtra({ fecha, horaInicio, horaFin, ruleSetParaFecha, esDomingoOFestivo }) {
  const inicio = combinarFechaHora(fecha, horaInicio);
  let fin = combinarFechaHora(fecha, horaFin);
  if (fin <= inicio) fin = addDays(fin, 1); // cruza medianoche

  const resultado = {
    horasExtraDiurnaOrd: 0,
    horasExtraNocturnaOrd: 0,
    horasExtraDiurnaDomFest: 0,
    horasExtraNocturnaDomFest: 0,
  };

  for (const seg of partirPorDiaCalendario(inicio, fin)) {
    const rule = ruleSetParaFecha(seg.fechaISO);
    const esFestivo = esDomingoOFestivo(seg.fechaISO);
    const duracionTotal = horasEntre(seg.inicio, seg.fin);
    const diurnas = horasDiurnasEnSegmento(seg.inicio, seg.fin, rule.horaInicioDiurna, rule.horaFinDiurna);
    const nocturnas = duracionTotal - diurnas;

    if (esFestivo) {
      resultado.horasExtraDiurnaDomFest += diurnas;
      resultado.horasExtraNocturnaDomFest += nocturnas;
    } else {
      resultado.horasExtraDiurnaOrd += diurnas;
      resultado.horasExtraNocturnaOrd += nocturnas;
    }
  }

  const redondear = (n) => Math.round(n * 100) / 100;
  resultado.horasExtraDiurnaOrd = redondear(resultado.horasExtraDiurnaOrd);
  resultado.horasExtraNocturnaOrd = redondear(resultado.horasExtraNocturnaOrd);
  resultado.horasExtraDiurnaDomFest = redondear(resultado.horasExtraDiurnaDomFest);
  resultado.horasExtraNocturnaDomFest = redondear(resultado.horasExtraNocturnaDomFest);
  resultado.horasTotales = redondear(
    resultado.horasExtraDiurnaOrd +
      resultado.horasExtraNocturnaOrd +
      resultado.horasExtraDiurnaDomFest +
      resultado.horasExtraNocturnaDomFest
  );

  return resultado;
}

/**
 * Dado un valor-hora ordinario, calcula el valor pagable/compensable de un
 * resultado de `calcularHorasExtra` según los % de recargo vigentes.
 */
function valorHorasExtra(resultado, ruleSet, valorHoraOrdinaria) {
  const factorDiurnaOrd = 1 + Number(ruleSet.pctExtraDiurna);
  const factorNocturnaOrd = 1 + Number(ruleSet.pctExtraNocturna);
  const factorDiurnaDomFest = 1 + Number(ruleSet.pctExtraDiurna) + Number(ruleSet.pctDominicalFestivo);
  const factorNocturnaDomFest = 1 + Number(ruleSet.pctExtraNocturna) + Number(ruleSet.pctDominicalFestivo);

  return (
    resultado.horasExtraDiurnaOrd * factorDiurnaOrd * valorHoraOrdinaria +
    resultado.horasExtraNocturnaOrd * factorNocturnaOrd * valorHoraOrdinaria +
    resultado.horasExtraDiurnaDomFest * factorDiurnaDomFest * valorHoraOrdinaria +
    resultado.horasExtraNocturnaDomFest * factorNocturnaDomFest * valorHoraOrdinaria
  );
}

/**
 * Selecciona, de una lista de RecargoRuleSet ordenada ascendente por
 * vigenteDesde, la que aplica a `fechaISO` (la última cuya vigencia ya inició).
 */
function ruleSetVigente(ruleSets, fechaISO) {
  let elegido = ruleSets[0];
  for (const rs of ruleSets) {
    if (rs.vigenteDesde <= fechaISO) elegido = rs;
    else break;
  }
  return elegido;
}

module.exports = { calcularHorasExtra, valorHorasExtra, ruleSetVigente };
