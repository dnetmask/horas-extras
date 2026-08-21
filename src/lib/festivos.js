'use strict';

// Calendario de festivos de Colombia, calculado (no hardcodeado por año) para
// que siga funcionando sin mantenimiento en años futuros. Combina:
//  - Festivos fijos.
//  - Festivos de Ley Emiliani (Ley 51 de 1983): si no caen en lunes, se
//    trasladan al lunes siguiente.
//  - Festivos móviles basados en Domingo de Pascua (Semana Santa, Ascensión,
//    Corpus Christi, Sagrado Corazón), estos últimos tres también trasladados
//    a lunes por Ley Emiliani.

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateUTC(year, month1based, day) {
  return new Date(Date.UTC(year, month1based - 1, day));
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dowUTC(date) {
  return date.getUTCDay(); // 0=domingo ... 6=sabado
}

// Traslada al lunes siguiente si `date` no cae ya en lunes (Ley Emiliani).
function trasladarALunes(date) {
  const dow = dowUTC(date);
  if (dow === 1) return date;
  const diasHastaLunes = (8 - dow) % 7; // domingo(0)->1, martes(2)->6, etc.
  return addDays(date, diasHastaLunes);
}

// Algoritmo de Meeus/Jones/Butcher para el Domingo de Pascua (calendario
// gregoriano). Devuelve una fecha UTC a medianoche.
function domingoDePascua(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toDateUTC(year, month, day);
}

function fechaISO(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/**
 * Devuelve todos los festivos de Colombia para un año dado.
 * @returns {{fecha: string, nombre: string}[]} fecha en formato YYYY-MM-DD
 */
function festivosDelAno(year) {
  const pascua = domingoDePascua(year);
  const festivos = [
    // Fijos
    { fecha: toDateUTC(year, 1, 1), nombre: 'Año Nuevo' },
    { fecha: toDateUTC(year, 5, 1), nombre: 'Día del Trabajo' },
    { fecha: toDateUTC(year, 7, 20), nombre: 'Independencia de Colombia' },
    { fecha: toDateUTC(year, 8, 7), nombre: 'Batalla de Boyacá' },
    { fecha: toDateUTC(year, 12, 8), nombre: 'Inmaculada Concepción' },
    { fecha: toDateUTC(year, 12, 25), nombre: 'Navidad' },
    // Ley Emiliani: trasladados al lunes siguiente
    { fecha: trasladarALunes(toDateUTC(year, 1, 6)), nombre: 'Día de los Reyes Magos' },
    { fecha: trasladarALunes(toDateUTC(year, 3, 19)), nombre: 'Día de San José' },
    { fecha: trasladarALunes(toDateUTC(year, 6, 29)), nombre: 'San Pedro y San Pablo' },
    { fecha: trasladarALunes(toDateUTC(year, 8, 15)), nombre: 'La Asunción de la Virgen' },
    { fecha: trasladarALunes(toDateUTC(year, 10, 12)), nombre: 'Día de la Raza' },
    { fecha: trasladarALunes(toDateUTC(year, 11, 1)), nombre: 'Día de Todos los Santos' },
    { fecha: trasladarALunes(toDateUTC(year, 11, 11)), nombre: 'Independencia de Cartagena' },
    // Móviles basados en Pascua (Jueves y Viernes Santo no se trasladan)
    { fecha: addDays(pascua, -3), nombre: 'Jueves Santo' },
    { fecha: addDays(pascua, -2), nombre: 'Viernes Santo' },
    // Móviles basados en Pascua, trasladados a lunes por Ley Emiliani
    { fecha: trasladarALunes(addDays(pascua, 39)), nombre: 'Ascensión del Señor' },
    { fecha: trasladarALunes(addDays(pascua, 60)), nombre: 'Corpus Christi' },
    { fecha: trasladarALunes(addDays(pascua, 68)), nombre: 'Sagrado Corazón de Jesús' },
  ];

  return festivos.map((f) => ({ fecha: fechaISO(f.fecha), nombre: f.nombre }));
}

module.exports = { festivosDelAno, domingoDePascua };
