'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const cron = require('node-cron');
const prisma = require('../db');
const config = require('../config');
const { enviarCorreo } = require('../lib/mail');
const { alertaVencimientoCredencial } = require('../lib/plantillasCorreo');

// Hitos en los que se re-avisa a medida que se acerca la fecha, para no
// mandar un correo distinto cada dia durante todo el ultimo mes mientras
// tampoco se deje pasar la fecha sin ningun aviso.
const HITOS_DIAS = [30, 14, 7, 3, 1, 0];

function diasRestantes(fechaISO) {
  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const [y, m, d] = fechaISO.split('-').map(Number);
  const fechaUTC = Date.UTC(y, m - 1, d);
  return Math.round((fechaUTC - hoyUTC) / 86400000);
}

function fechaVencimientoCertificado() {
  try {
    const pem = fs.readFileSync(config.certPath, 'utf8');
    const cert = new crypto.X509Certificate(pem);
    return cert.validTo ? new Date(cert.validTo).toISOString().slice(0, 10) : null;
  } catch (err) {
    console.error('No se pudo leer el certificado para revisar su vencimiento:', err.message);
    return null;
  }
}

async function avisarSiAplica(tipo, fechaVencimiento) {
  if (!fechaVencimiento) return;
  const restantes = diasRestantes(fechaVencimiento);
  if (restantes < 0 || !HITOS_DIAS.includes(restantes)) return;

  const admins = await prisma.usuario.findMany({ where: { rol: 'admin', activo: true } });
  if (admins.length === 0) return;

  const correo = alertaVencimientoCredencial({ tipo, fechaVencimiento, diasRestantes: restantes });
  try {
    await enviarCorreo({ para: admins.map((a) => a.email), ...correo });
  } catch (err) {
    console.error(`No se pudo enviar la alerta de vencimiento de ${tipo}:`, err.message);
  }
}

async function ejecutarAlertaVencimientoCredenciales() {
  await avisarSiAplica('certificado', fechaVencimientoCertificado());
  await avisarSiAplica('secreto_azure', config.azure.clientSecretExpira || null);
}

function programarJobVencimientoCredenciales() {
  // Todos los dias a las 07:15 (poco despues de la alerta de 45 dias).
  cron.schedule('15 7 * * *', () => {
    ejecutarAlertaVencimientoCredenciales().catch((err) =>
      console.error('Fallo el job de alerta de vencimiento de credenciales:', err)
    );
  });
}

module.exports = {
  ejecutarAlertaVencimientoCredenciales,
  programarJobVencimientoCredenciales,
  diasRestantes,
  HITOS_DIAS,
};
