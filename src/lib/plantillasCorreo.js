'use strict';

const config = require('../config');

function filaResumen(h) {
  return `
    <li>${h.fecha.toISOString().slice(0, 10)} · ${h.horaInicio}-${h.horaFin} ·
      trabajado ${h.horasTotales}h (diurna ${h.horasExtraDiurnaOrd}h, nocturna ${h.horasExtraNocturnaOrd}h,
      dominical/festiva diurna ${h.horasExtraDiurnaDomFest}h, nocturna ${h.horasExtraNocturnaDomFest}h)
      · <strong>${h.horasCompensables}h compensables</strong>
      ${h.obra ? ' · ' + h.obra : ''}
    </li>`;
}

function linkRegistro(id) {
  return `${config.appBaseUrl}/#/registro/${id}`;
}

function solicitudAprobacion({ registro, ingenieroNombre, paraQuien }) {
  return {
    asunto: `[Horas extra] ${ingenieroNombre} solicita tu VoBo (${paraQuien})`,
    html: `
      <p><strong>${ingenieroNombre}</strong> registró horas extra que requieren tu aprobación (${paraQuien}):</p>
      <ul>${filaResumen(registro)}</ul>
      <p><a href="${linkRegistro(registro.id)}">Ver y aprobar/rechazar</a></p>
    `,
  };
}

function decisionNotificada({ registro, ingenieroNombre, aprobado, motivo, quienDecidio }) {
  return {
    asunto: aprobado
      ? `[Horas extra] Tu registro del ${registro.fecha.toISOString().slice(0, 10)} fue aprobado`
      : `[Horas extra] Tu registro del ${registro.fecha.toISOString().slice(0, 10)} fue rechazado`,
    html: `
      <p>Hola ${ingenieroNombre}, tu registro de horas extra fue <strong>${aprobado ? 'aprobado' : 'rechazado'}</strong> por ${quienDecidio}.</p>
      <ul>${filaResumen(registro)}</ul>
      ${motivo ? `<p>Motivo: ${motivo}</p>` : ''}
      <p><a href="${linkRegistro(registro.id)}">Ver detalle</a></p>
    `,
  };
}

function alertaVencimiento({ ingenieroNombre, registros }) {
  return {
    asunto: `[Horas extra] ${registros.length} registro(s) de ${ingenieroNombre} llevan más de 45 días sin compensar`,
    html: `
      <p>Los siguientes registros de <strong>${ingenieroNombre}</strong> llevan más de 45 días
      aprobados sin compensación de tiempo registrada:</p>
      <ul>${registros.map(filaResumen).join('')}</ul>
      <p>Por favor coordinen la compensación (tiempo libre) lo antes posible.</p>
    `,
  };
}

module.exports = { solicitudAprobacion, decisionNotificada, alertaVencimiento };
