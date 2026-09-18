'use strict';

const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');
const { calcularHorasExtra, horasCompensablesDe } = require('../lib/recargos');
const { construirContextoDeCalculo } = require('../lib/reglas');
const { registrarAuditoria } = require('../lib/auditLog');
const { enviarCorreo } = require('../lib/mail');
const { solicitudAprobacion } = require('../lib/plantillasCorreo');
const { calcularSaldo } = require('../lib/saldoHoras');

const router = express.Router();

const CAMPOS_EDITABLES = ['fecha', 'horaInicio', 'horaFin', 'caso', 'ot', 'obra', 'liderId'];

function validarEntrada(body) {
  const { fecha, horaInicio, horaFin, caso, ot } = body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return 'fecha invalida (usar YYYY-MM-DD)';
  if (!/^\d{2}:\d{2}$/.test(horaInicio || '')) return 'horaInicio invalida (usar HH:MM)';
  if (!/^\d{2}:\d{2}$/.test(horaFin || '')) return 'horaFin invalida (usar HH:MM)';
  if (horaInicio === horaFin) return 'horaInicio y horaFin no pueden ser iguales';
  if (!String(caso || '').trim()) return '# Caso es obligatorio';
  if (!String(ot || '').trim()) return '# OT es obligatorio';
  return null;
}

async function calcular(body) {
  const ctx = await construirContextoDeCalculo();
  const resultado = calcularHorasExtra({
    fecha: body.fecha,
    horaInicio: body.horaInicio,
    horaFin: body.horaFin,
    ...ctx,
  });
  // Horas acreditadas al banco de tiempo compensatorio: cada categoria
  // multiplicada por su factor de recargo (ver src/lib/recargos.js). Se usa
  // la regla vigente en la fecha de inicio del turno - un turno que cruza
  // justo la medianoche de un cambio de ley es un caso extremo que no se
  // modela con precision, igual que ya pasaba con la clasificacion en horas.
  const ruleSet = ctx.ruleSetParaFecha(body.fecha);
  resultado.horasCompensables = horasCompensablesDe(resultado, ruleSet);
  return resultado;
}

// Puede quedar como "lider" de una solicitud cualquiera con rol lider,
// gerencia o admin - Gerencia a veces tambien cumple ese papel para
// ingenieros que le reportan directo a ella.
const ROLES_PUEDEN_SER_LIDER = ['lider', 'gerencia', 'admin'];

async function buscarLiderValido(liderId) {
  if (!liderId) return null;
  const lider = await prisma.usuario.findUnique({ where: { id: liderId } });
  if (!lider || !ROLES_PUEDEN_SER_LIDER.includes(lider.rol) || !lider.activo) return null;
  return lider;
}

router.get('/mios', requireAuth, async (req, res, next) => {
  try {
    const registros = await prisma.horasExtra.findMany({
      where: { ingenieroId: req.session.usuario.id },
      include: { lider: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
    });
    res.json(registros);
  } catch (err) {
    next(err);
  }
});

// Detalle granular de un usuario puntual (todas sus horas extra +
// compensaciones + saldo). Un admin puede revisar a cualquiera; un lider
// solo a quien lo tiene como "lider asignado" (su equipo) - para eso no
// hace falta depender de que esa persona comparta pantalla.
router.get('/de/:usuarioId', requireAuth, requireRole('lider', 'admin'), async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.params.usuarioId } });
    if (!usuario) return res.status(404).json({ error: 'No existe' });

    const { rol, id: uid } = req.session.usuario;
    if (rol === 'lider' && usuario.liderId !== uid) {
      return res.status(403).json({ error: 'Esa persona no tiene tu usuario como líder asignado' });
    }

    const [registros, compensaciones, saldo] = await Promise.all([
      prisma.horasExtra.findMany({
        where: { ingenieroId: usuario.id },
        include: { lider: { select: { nombre: true } } },
        orderBy: { fecha: 'desc' },
      }),
      prisma.compensacion.findMany({
        where: { ingenieroId: usuario.id },
        orderBy: { fechaCompensacion: 'desc' },
      }),
      calcularSaldo(usuario.id),
    ]);

    res.json({
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
      registros,
      compensaciones,
      ...saldo,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const error = validarEntrada(req.body);
    if (error) return res.status(400).json({ error });

    const lider = await buscarLiderValido(req.body.liderId);
    if (!lider) return res.status(400).json({ error: 'Debes elegir un líder válido para la pre-aprobación' });

    const calculo = await calcular(req.body);
    const usuario = await prisma.usuario.findUnique({ where: { id: req.session.usuario.id } });

    const registro = await prisma.$transaction(async (tx) => {
      const creado = await tx.horasExtra.create({
        data: {
          ingenieroId: usuario.id,
          liderId: lider.id,
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
          horasCompensables: calculo.horasCompensables,
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

    // Pre-aprobacion: le llega al lider elegido en el formulario. Cuando el
    // lider apruebe, la aprobacion final le llega a todos los usuarios con
    // rol "gerencia" (el Gerente de Ingenieria) - ver src/routes/aprobaciones.js.
    if (lider.email) {
      const correo = solicitudAprobacion({ registro, ingenieroNombre: usuario.nombre, paraQuien: 'líder' });
      enviarCorreo({ para: lider.email, ...correo }).catch((err) =>
        console.error('No se pudo notificar al lider:', err.message)
      );
    }

    res.status(201).json(registro);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const registro = await prisma.horasExtra.findUnique({ where: { id: req.params.id } });
    if (!registro) return res.status(404).json({ error: 'No existe' });
    const { id: uid, rol } = req.session.usuario;
    const puedeVer = registro.ingenieroId === uid || registro.liderId === uid || ['lider', 'gerencia', 'admin'].includes(rol);
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
      return res.status(409).json({ error: 'Solo se puede editar mientras está pendiente de pre-aprobación del líder' });
    }

    const datosNuevos = { ...req.body };
    const merge = {
      fecha: datosNuevos.fecha || registro.fecha.toISOString().slice(0, 10),
      horaInicio: datosNuevos.horaInicio || registro.horaInicio,
      horaFin: datosNuevos.horaFin || registro.horaFin,
      caso: datosNuevos.caso ?? registro.caso,
      ot: datosNuevos.ot ?? registro.ot,
    };
    const error = validarEntrada(merge);
    if (error) return res.status(400).json({ error });

    let liderId = registro.liderId;
    if (datosNuevos.liderId && datosNuevos.liderId !== registro.liderId) {
      const lider = await buscarLiderValido(datosNuevos.liderId);
      if (!lider) return res.status(400).json({ error: 'Líder inválido' });
      liderId = lider.id;
    }

    const calculo = await calcular(merge);

    const actualizado = await prisma.$transaction(async (tx) => {
      const previo = registro;
      const nuevo = await tx.horasExtra.update({
        where: { id: registro.id },
        data: {
          fecha: new Date(`${merge.fecha}T00:00:00Z`),
          horaInicio: merge.horaInicio,
          horaFin: merge.horaFin,
          caso: merge.caso,
          ot: merge.ot,
          obra: datosNuevos.obra ?? registro.obra,
          liderId,
          horasExtraDiurnaOrd: calculo.horasExtraDiurnaOrd,
          horasExtraNocturnaOrd: calculo.horasExtraNocturnaOrd,
          horasExtraDiurnaDomFest: calculo.horasExtraDiurnaDomFest,
          horasExtraNocturnaDomFest: calculo.horasExtraNocturnaDomFest,
          horasTotales: calculo.horasTotales,
          horasCompensables: calculo.horasCompensables,
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

// Retirar una solicitud creada por error - mismas condiciones que editar
// (solo el dueño, solo mientras nadie la ha empezado a aprobar). No hay
// "deshacer": si ya paso a pendiente_gerencia, hay que pedir que la
// rechacen primero.
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const registro = await prisma.horasExtra.findUnique({ where: { id: req.params.id } });
    if (!registro) return res.status(404).json({ error: 'No existe' });
    if (registro.ingenieroId !== req.session.usuario.id) {
      return res.status(403).json({ error: 'Solo puedes eliminar tus propios registros' });
    }
    if (registro.estado !== 'pendiente_lider') {
      return res.status(409).json({ error: 'Solo se puede eliminar mientras está pendiente de pre-aprobación del líder' });
    }

    await prisma.$transaction(async (tx) => {
      // El registro de auditoria queda aunque el registro se borre despues -
      // es la constancia de que existio y quien lo elimino.
      await registrarAuditoria(tx, {
        tabla: 'horas_extra',
        registroId: registro.id,
        usuarioId: req.session.usuario.id,
        accion: 'eliminar',
        valorAntes: `${registro.fecha.toISOString().slice(0, 10)} ${registro.horaInicio}-${registro.horaFin} (${registro.horasTotales}h)`,
      });
      await tx.horasExtra.delete({ where: { id: registro.id } });
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
