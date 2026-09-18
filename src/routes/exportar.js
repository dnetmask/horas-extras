'use strict';

const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../auth/middleware');
const { generarExcel, generarPdf } = require('../lib/exportar');

const router = express.Router();

function validarFecha(valor) {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

// Historial completo de horas extra (todas las columnas, no solo el
// resumen). El alcance depende del rol de quien exporta:
//  - admin/gerencia: todo el mundo.
//  - lider: solo los ingenieros que lo tienen como lider asignado.
//  - ingeniero: solo sus propios registros.
router.get('/horas-extra', requireAuth, async (req, res, next) => {
  try {
    const { rol, id } = req.session.usuario;
    const formato = req.query.formato === 'pdf' ? 'pdf' : 'excel';
    const desde = validarFecha(req.query.desde);
    const hasta = validarFecha(req.query.hasta);

    let where = {};
    if (rol === 'ingeniero') {
      where.ingenieroId = id;
    } else if (rol === 'lider') {
      where.ingeniero = { liderId: id };
    }
    // gerencia y admin: sin filtro de persona, ven todo.

    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(`${desde}T00:00:00Z`);
      if (hasta) where.fecha.lte = new Date(`${hasta}T00:00:00Z`);
    }

    const registros = await prisma.horasExtra.findMany({
      where,
      include: {
        ingeniero: { select: { nombre: true } },
        lider: { select: { nombre: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    const nombreArchivo = `horas-extra_${desde || 'inicio'}_${hasta || 'hoy'}`;

    if (formato === 'pdf') {
      const buffer = await generarPdf(registros, { titulo: 'Historial de Horas Extra - Netmask' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.pdf"`);
      res.send(buffer);
    } else {
      const buffer = await generarExcel(registros);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`);
      res.send(buffer);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
