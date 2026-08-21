'use strict';

const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../auth/middleware');
const { calcularHorasExtra } = require('../lib/recargos');
const { construirContextoDeCalculo } = require('../lib/reglas');
const { registrarAuditoria } = require('../lib/auditLog');
const { enviarCorreo } = require('../lib/mail');
const { solicitudAprobacion } = require('../lib/plantillasCorreo');

const router = express.Router();

const CAMPOS_EDITABLES = ['fecha', 'horaInicio', 'horaFin', 'caso', 'ot', 'obra'];

function validarEntrada(body) {
  const { fecha, horaInicio, horaFin } = body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return 'fecha invalida (usar YYYY-MM-DD)';
  if (!/^\d{2}:\d{2}$/.test(horaInicio || '')) return 'horaInicio invalida (usar HH:MM)';
  if (!/^\d{2}:\d{2}$/.test(horaFin || '')) return 'horaFin invalida (usar HH:MM)';
  if (horaInicio === horaFin) return 'horaInicio y horaFin no pueden ser iguales';
  return null;
}

async function calcular(body) {
  const ctx = await construirContextoDeCalculo();
  return calcularHorasExtra({
    fecha: body.fecha,
    horaInicio: body.horaInicio,
    horaFin: body.horaFin,
    ...ctx,
  });
}

router.get('/mios', requireAuth, async (req, res, next) => {
  try {
    const registros = await prisma.horasExtra.findMany({
      where: { ingenieroId: req.session.usuario.id },
      orderBy: { fecha: 'desc' },
    });
    res.json(registros);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const error = validarEntrada(req.body);
    if (error) return res.status(400).json({ error });

    const calculo = await calcular(req.body);
    const usuario = await prisma.usuario.findUnique({ where: { id: req.session.usuario.id } });

    const registro = await prisma.$transaction(async (tx) => {
      const creado = await tx.horasExtra.create({
        data: {
          ingenieroId: usuario.id,
          fecha: new Date(`${req.body.fecha}T00:00:00Z`),
          horaInicio: req.body.horaInicio,
          horaFin: req.body.horaFin,
          caso: req.body.caso || null,
          ot: req.body.ot || null,
          obra: req.body.obra || null,
          horasExtraDiurnaOrd: calculo.horasExtraDiurnaOrd,
          horasExtraNocturnaOrd: calculo.horasExtraNocturnaOrd,
          horasExtraDiurnaDomFest: calculo.horasExtraDiurnaDomFest,
          horasExtraNocturnaDomFest: calculo.horasExtraNocturnaDomFest,
          horasTotales: calculo.horasTotales,
        },
      });
      await registrarAuditoria(tx, {
        tabla: 'horas_extra',
        registroId: creado.id,
        usuarioId: usuario.id,
        accion: 'crear',
      });
      return creado;
    });

    if (usuario.liderId) {
      const lider = await prisma.usuario.findUnique({ where: { id: usuario.liderId } });
      if (lider?.email) {
        const correo = solicitudAprobacion({ registro, ingenieroNombre: usuario.nombre, paraQuien: 'líder' });
        enviarCorreo({ para: lider.email, ...correo }).catch((err) =>
          console.error('No se pudo notificar al lider:', err.message)
        );
      }
    }

    res.status(201).json({
      ...registro,
      aviso: usuario.liderId ? undefined : 'No tienes un lider asignado - pide a un admin que lo configure para que tu solicitud pueda avanzar.',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const registro = await prisma.horasExtra.findUnique({ where: { id: req.params.id } });
    if (!registro) return res.status(404).json({ error: 'No existe' });
    const { id: uid, rol } = req.session.usuario;
    const puedeVer =
      registro.ingenieroId === uid ||
      registro.liderAprobadorId === uid ||
      ['lider', 'gerencia', 'admin'].includes(rol);
    if (!puedeVer) return res.status(403).json({ error: 'No autorizado' });
    res.json(registro);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const registro = await prisma.horasExtra.findUnique({ where: { id: req.params.id } });
    if (!registro) return res.status(404).json({ error: 'No existe' });
    if (registro.ingenieroId !== req.session.usuario.id) {
      return res.status(403).json({ error: 'Solo puedes editar tus propios registros' });
    }
    if (registro.estado !== 'pendiente_lider') {
      return res.status(409).json({ error: 'Solo se puede editar mientras esta pendiente de aprobacion del lider' });
    }

    const datosNuevos = { ...req.body };
    const merge = {
      fecha: datosNuevos.fecha || registro.fecha.toISOString().slice(0, 10),
      horaInicio: datosNuevos.horaInicio || registro.horaInicio,
      horaFin: datosNuevos.horaFin || registro.horaFin,
    };
    const error = validarEntrada(merge);
    if (error) return res.status(400).json({ error });

    const calculo = await calcular(merge);

    const actualizado = await prisma.$transaction(async (tx) => {
      const previo = registro;
      const nuevo = await tx.horasExtra.update({
        where: { id: registro.id },
        data: {
          fecha: new Date(`${merge.fecha}T00:00:00Z`),
          horaInicio: merge.horaInicio,
          horaFin: merge.horaFin,
          caso: datosNuevos.caso ?? registro.caso,
          ot: datosNuevos.ot ?? registro.ot,
          obra: datosNuevos.obra ?? registro.obra,
          horasExtraDiurnaOrd: calculo.horasExtraDiurnaOrd,
          horasExtraNocturnaOrd: calculo.horasExtraNocturnaOrd,
          horasExtraDiurnaDomFest: calculo.horasExtraDiurnaDomFest,
          horasExtraNocturnaDomFest: calculo.horasExtraNocturnaDomFest,
          horasTotales: calculo.horasTotales,
        },
      });
      for (const campo of CAMPOS_EDITABLES) {
        const antes = campo === 'fecha' ? previo.fecha.toISOString().slice(0, 10) : previo[campo];
        const despues = campo === 'fecha' ? merge.fecha : nuevo[campo];
        if (antes !== despues) {
          await registrarAuditoria(tx, {
            tabla: 'horas_extra',
            registroId: nuevo.id,
            usuarioId: req.session.usuario.id,
            accion: 'editar',
            campo,
            valorAntes: antes,
            valorDespues: despues,
          });
        }
      }
      return nuevo;
    });

    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
