'use strict';

const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();

// Config legal (ventanas horarias diurna/nocturna, % de recargo). Consultable
// por cualquiera autenticado (para mostrar en la UI); solo un admin puede
// agregar una nueva vigencia (ej. cuando la ley suba el recargo dominical al
// 100% en 2027-07-01, o si vuelve a cambiar).
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const reglas = await prisma.recargoRuleSet.findMany({ orderBy: { vigenteDesde: 'asc' } });
    res.json(reglas);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { vigenteDesde, horaInicioDiurna, horaFinDiurna, pctExtraDiurna, pctExtraNocturna, pctDominicalFestivo, nota } = req.body;
    if (!vigenteDesde || !horaInicioDiurna || !horaFinDiurna) {
      return res.status(400).json({ error: 'vigenteDesde, horaInicioDiurna y horaFinDiurna son obligatorios' });
    }
    const regla = await prisma.recargoRuleSet.create({
      data: {
        vigenteDesde: new Date(`${vigenteDesde}T00:00:00Z`),
        horaInicioDiurna,
        horaFinDiurna,
        pctExtraDiurna,
        pctExtraNocturna,
        pctDominicalFestivo,
        nota: nota || null,
      },
    });
    res.status(201).json(regla);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
