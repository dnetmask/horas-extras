'use strict';

const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');
const { registrarAuditoria } = require('../lib/auditLog');
const { enviarCorreo } = require('../lib/mail');
const { solicitudAprobacion, decisionNotificada } = require('../lib/plantillasCorreo');

const router = express.Router();

router.get('/pendientes', requireAuth, requireRole('lider', 'gerencia', 'admin'), async (req, res, next) => {
  try {
    const { id, rol } = req.session.usuario;
    let where;
    if (rol === 'admin') {
      where = { estado: { in: ['pendiente_lider', 'pendiente_gerencia'] } };
    } else if (rol === 'lider') {
      where = { estado: 'pendiente_lider', liderId: id };
    } else {
      where = { estado: 'pendiente_gerencia' };
    }
    const registros = await prisma.horasExtra.findMany({
      where,
      include: {
        ingeniero: { select: { nombre: true, email: true } },
        lider: { select: { nombre: true } },
      },
      orderBy: { fecha: 'asc' },
    });
    res.json(registros);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/decidir', requireAuth, requireRole('lider', 'gerencia', 'admin'), async (req, res, next) => {
  try {
    const { decision, motivo } = req.body; // decision: 'aprobar' | 'rechazar'
    if (!['aprobar', 'rechazar'].includes(decision)) {
      return res.status(400).json({ error: 'decision debe ser "aprobar" o "rechazar"' });
    }

    const registro = await prisma.horasExtra.findUnique({
      where: { id: req.params.id },
      include: { ingeniero: true },
    });
    if (!registro) return res.status(404).json({ error: 'No existe' });

    const { id: uid, rol, nombre } = req.session.usuario;

    if (registro.estado === 'pendiente_lider') {
      if (rol === 'lider' && registro.liderId !== uid) {
        return res.status(403).json({ error: 'No eres el lider elegido para esta solicitud' });
      }
    } else if (registro.estado === 'pendiente_gerencia') {
      if (!['gerencia', 'admin'].includes(rol)) {
        return res.status(403).json({ error: 'Esta etapa requiere rol gerencia' });
      }
    } else {
      return res.status(409).json({ error: `El registro ya esta en estado "${registro.estado}", no admite decision` });
    }

    const etapaLider = registro.estado === 'pendiente_lider';
    const nuevoEstado = decision === 'rechazar' ? 'rechazada' : etapaLider ? 'pendiente_gerencia' : 'aprobada';

    const actualizado = await prisma.$transaction(async (tx) => {
      const nuevo = await tx.horasExtra.update({
        where: { id: registro.id },
        data: etapaLider
          ? {
              estado: nuevoEstado,
              liderRespondidoEn: new Date(),
              motivoRechazo: decision === 'rechazar' ? motivo || null : null,
            }
          : {
              estado: nuevoEstado,
              gerenciaAprobadorId: uid,
              gerenciaRespondidoEn: new Date(),
              motivoRechazo: decision === 'rechazar' ? motivo || null : null,
            },
      });
      await registrarAuditoria(tx, {
        tabla: 'horas_extra',
        registroId: nuevo.id,
        usuarioId: uid,
        accion: decision === 'rechazar' ? 'rechazar' : etapaLider ? 'aprobar_lider' : 'aprobar_gerencia',
        campo: 'estado',
        valorAntes: registro.estado,
        valorDespues: nuevoEstado,
      });
      return nuevo;
    });

    // Notificaciones (no bloquean la respuesta si el envio falla).
    if (decision === 'rechazar') {
      const correo = decisionNotificada({
        registro: actualizado,
        ingenieroNombre: registro.ingeniero.nombre,
        aprobado: false,
        motivo,
        quienDecidio: etapaLider ? 'tu líder' : 'gerencia',
      });
      enviarCorreo({ para: registro.ingeniero.email, ...correo }).catch((e) => console.error(e.message));
    } else if (etapaLider) {
      const gerentes = await prisma.usuario.findMany({ where: { rol: 'gerencia', activo: true } });
      const correo = solicitudAprobacion({ registro: actualizado, ingenieroNombre: registro.ingeniero.nombre, paraQuien: 'gerencia' });
      enviarCorreo({ para: gerentes.map((g) => g.email), ...correo }).catch((e) => console.error(e.message));
    } else {
      const correo = decisionNotificada({
        registro: actualizado,
        ingenieroNombre: registro.ingeniero.nombre,
        aprobado: true,
        quienDecidio: 'gerencia',
      });
      enviarCorreo({ para: registro.ingeniero.email, ...correo }).catch((e) => console.error(e.message));
    }

    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
