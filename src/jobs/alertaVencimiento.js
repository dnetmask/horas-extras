'use strict';

const cron = require('node-cron');
const prisma = require('../db');
const { calcularSaldo } = require('../lib/saldoHoras');
const { enviarCorreo } = require('../lib/mail');
const { alertaVencimiento } = require('../lib/plantillasCorreo');

const DIAS_LIMITE = 45;
const DIAS_ENTRE_REENVIOS = 7;

/**
 * Por cada ingeniero con horas extra aprobadas y saldo pendiente de
 * compensar, si la mas antigua sin compensar ya paso los 45 dias y no se le
 * ha avisado en los ultimos 7 dias, envia un correo al ingeniero + su lider +
 * gerencia (requisito 5 del pedido original).
 */
async function ejecutarAlertaVencimiento() {
  const limite = new Date();
  limite.setUTCDate(limite.getUTCDate() - DIAS_LIMITE);

  const ingenieros = await prisma.usuario.findMany({
    where: { rol: 'ingeniero', activo: true },
    include: { lider: true },
  });

  for (const ingeniero of ingenieros) {
    const { saldo } = await calcularSaldo(ingeniero.id);
    if (saldo <= 0) continue;

    const vencidos = await prisma.horasExtra.findMany({
      where: { ingenieroId: ingeniero.id, estado: 'aprobada', fecha: { lt: limite } },
      orderBy: { fecha: 'asc' },
    });
    if (vencidos.length === 0) continue;

    const yaAvisadoReciente = await prisma.notificacionEnviada.findFirst({
      where: {
        tipo: 'alerta_45_dias',
        horasExtraId: { in: vencidos.map((v) => v.id) },
        enviadaEn: { gt: new Date(Date.now() - DIAS_ENTRE_REENVIOS * 86400000) },
      },
    });
    if (yaAvisadoReciente) continue;

    const gerentes = await prisma.usuario.findMany({ where: { rol: 'gerencia', activo: true } });
    const destinatarios = [ingeniero.email, ingeniero.lider?.email, ...gerentes.map((g) => g.email)].filter(Boolean);

    const correo = alertaVencimiento({ ingenieroNombre: ingeniero.nombre, registros: vencidos });
    try {
      await enviarCorreo({ para: destinatarios, ...correo });
      await prisma.notificacionEnviada.createMany({
        data: vencidos.map((v) => ({ horasExtraId: v.id, tipo: 'alerta_45_dias' })),
      });
    } catch (err) {
      console.error(`No se pudo enviar la alerta de vencimiento para ${ingeniero.email}:`, err.message);
    }
  }
}

function programarJobDiario() {
  // Todos los dias a las 07:00 hora del servidor.
  cron.schedule('0 7 * * *', () => {
    ejecutarAlertaVencimiento().catch((err) => console.error('Fallo el job de alerta de vencimiento:', err));
  });
}

module.exports = { ejecutarAlertaVencimiento, programarJobDiario };
