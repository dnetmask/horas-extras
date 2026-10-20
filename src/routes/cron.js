'use strict';

const crypto = require('node:crypto');
const express = require('express');
const { ejecutarAlertaVencimiento } = require('../jobs/alertaVencimiento');
const { ejecutarAlertaVencimientoCredenciales } = require('../jobs/alertaVencimientoCredenciales');

const router = express.Router();

/**
 * Vercel Cron llama este endpoint con "Authorization: Bearer <CRON_SECRET>"
 * (ver vercel.json). Sin CRON_SECRET configurado el endpoint queda cerrado:
 * en Docker no se usa, porque ahi los mismos jobs corren con node-cron.
 */
function autorizado(encabezado, secreto) {
  if (!secreto) return false;
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(String(encabezado || ''));
  return recibido.length === esperado.length && crypto.timingSafeEqual(recibido, esperado);
}

router.get('/diario', async (req, res) => {
  if (!autorizado(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Mismo orden que en Docker: primero la alerta de 45 dias, despues la de
  // credenciales. Cada job maneja sus propios errores de envio por persona;
  // aqui solo se reporta si alguno fallo por completo.
  const resultado = {};
  for (const [nombre, job] of [
    ['alerta45Dias', ejecutarAlertaVencimiento],
    ['alertaCredenciales', ejecutarAlertaVencimientoCredenciales],
  ]) {
    try {
      await job();
      resultado[nombre] = 'ok';
    } catch (err) {
      console.error(`Fallo el job ${nombre}:`, err);
      resultado[nombre] = 'error';
    }
  }

  const huboError = Object.values(resultado).includes('error');
  res.status(huboError ? 500 : 200).json(resultado);
});

module.exports = router;
module.exports.autorizado = autorizado;
