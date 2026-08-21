'use strict';

const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');
const { registrarAuditoria } = require('../lib/auditLog');
const { calcularSaldo, calcularSaldosDeTodos } = require('../lib/saldoHoras');

const router = express.Router();

function horasEntreHorarios(horaInicio, horaFin) {
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFin.split(':').map(Number);
  return (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
}

router.get('/mias', requireAuth, async (req, res, next) => {
  try {
    const saldo = await calcularSaldo(req.session.usuario.id);
    const historial = await prisma.compensacion.findMany({
      where: { ingenieroId: req.session.usuario.id },
      orderBy: { fechaCompensacion: 'desc' },
    });
    res.json({ ...saldo, historial });
  } catch (err) {
    next(err);
  }
});

// Vista de Gerencia (y Admin): saldo de banco de horas de TODO el equipo,
// no solo el propio. Cualquiera con estos roles la ve completa - no hace
// falta ser el lider directo de cada persona.
router.get('/todas', requireAuth, requireRole('gerencia', 'admin'), async (req, res, next) => {
  try {
    const saldos = await calcularSaldosDeTodos();
    res.json(saldos);
  } catch (err) {
    next(err);
  }
});

// Solicitud de un ingeniero para usar (tomar como permiso) horas de su banco
// de horas compensatorias. Requiere fecha + horario del permiso; las horas
// se calculan del horario y se descuentan del saldo disponible.
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { fechaCompensacion, horaInicio, horaFin, horasExtraId, ingenieroId: ingenieroIdBody } = req.body;
    const esGestor = ['lider', 'gerencia', 'admin'].includes(req.session.usuario.rol);
    const ingenieroId = esGestor && ingenieroIdBody ? ingenieroIdBody : req.session.usuario.id;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCompensacion || '')) {
      return res.status(400).json({ error: 'fechaCompensacion invalida (YYYY-MM-DD)' });
    }
    if (!/^\d{2}:\d{2}$/.test(horaInicio || '') || !/^\d{2}:\d{2}$/.test(horaFin || '')) {
      return res.status(400).json({ error: 'horaInicio y horaFin son obligatorios (HH:MM)' });
    }
    const horas = horasEntreHorarios(horaInicio, horaFin);
    if (horas <= 0) {
      return res.status(400).json({ error: 'horaFin debe ser posterior a horaInicio (el permiso no puede cruzar medianoche)' });
    }

    const { saldo } = await calcularSaldo(ingenieroId);
    if (horas > saldo) {
      return res.status(409).json({ error: `Saldo insuficiente (saldo actual: ${saldo}h, solicitadas: ${horas}h)` });
    }

    const compensacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.compensacion.create({
        data: {
          ingenieroId,
          horasExtraId: horasExtraId || null,
          fechaCompensacion: new Date(`${fechaCompensacion}T00:00:00Z`),
          horaInicio,
          horaFin,
          horas,
          registradoPorId: req.session.usuario.id,
        },
      });
      await registrarAuditoria(tx, {
        tabla: 'compensaciones',
        registroId: creada.id,
        usuarioId: req.session.usuario.id,
        accion: 'crear',
        valorDespues: `${horas}h (${horaInicio}-${horaFin}) el ${fechaCompensacion} para ingeniero ${ingenieroId}`,
      });
      return creada;
    });

    res.status(201).json(compensacion);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
