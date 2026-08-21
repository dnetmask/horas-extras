'use strict';

const prisma = require('../db');

async function calcularSaldo(ingenieroId) {
  const [aprobadas, compensadas] = await Promise.all([
    prisma.horasExtra.aggregate({
      where: { ingenieroId, estado: 'aprobada' },
      _sum: { horasTotales: true },
    }),
    prisma.compensacion.aggregate({
      where: { ingenieroId },
      _sum: { horas: true },
    }),
  ]);
  const totalAprobado = Number(aprobadas._sum.horasTotales || 0);
  const totalCompensado = Number(compensadas._sum.horas || 0);
  return { totalAprobado, totalCompensado, saldo: totalAprobado - totalCompensado };
}

module.exports = { calcularSaldo };
