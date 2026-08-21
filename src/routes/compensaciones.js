'use strict';

const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../auth/middleware');
const { registrarAuditoria } = require('../lib/auditLog');
const { calcularSaldo } = require('../lib/saldoHoras');

const router = express.Router();

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

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { horas, fechaCompensacion, horasExtraId, ingenieroId: ingenieroIdBody } = req.body;
    const esGestor = ['lider', 'gerencia', 'admin'].includes(req.session.usuario.rol);
    const ingenieroId = esGestor && ingenieroIdBody ? ingenieroIdBody : req.session.usuario.id;

    if (!horas || Number(horas) <= 0) return res.status(400).json({ error: 'horas debe ser mayor a 0' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCompensacion || '')) {
      return res.status(400).json({ error: 'fechaCompensacion invalida (YYYY-MM-DD)' });
    }

    const { saldo } = await calcularSaldo(ingenieroId);
    if (Number(horas) > saldo) {
      return res.status(409).json({ error: `Saldo insuficiente (saldo actual: ${saldo}h)` });
    }

    const compensacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.compensacion.create({
        data: {
          ingenieroId,
          horasExtraId: horasExtraId || null,
          horas,
          fechaCompensacion: new Date(`${fechaCompensacion}T00:00:00Z`),
          registradoPorId: req.session.usuario.id,
        },
      });
      await registrarAuditoria(tx, {
        tabla: 'compensaciones',
        registroId: creada.id,
        usuarioId: req.session.usuario.id,
        accion: 'crear',
        valorDespues: `${horas}h el ${fechaCompensacion} para ingeniero ${ingenieroId}`,
      });
      return creada;
    });

    res.status(201).json(compensacion);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
