'use strict';

const prisma = require('../db');

async function calcularSaldo(ingenieroId) {
  const [aprobadas, compensadas] = await Promise.all([
    prisma.horasExtra.aggregate({
      where: { ingenieroId, estado: 'aprobada' },
      _sum: { horasTotales: true, horasCompensables: true },
    }),
    prisma.compensacion.aggregate({
      where: { ingenieroId },
      _sum: { horas: true },
    }),
  ]);
  const totalHorasTrabajadas = Number(aprobadas._sum.horasTotales || 0);
  // "totalAprobado" son las horas YA con el multiplicador de recargo
  // aplicado (banco de tiempo compensatorio) - Netmask compensa con tiempo,
  // no con dinero, asi que el recargo se traduce en mas horas de descanso.
  const totalAprobado = Number(aprobadas._sum.horasCompensables || 0);
  const totalCompensado = Number(compensadas._sum.horas || 0);
  return { totalHorasTrabajadas, totalAprobado, totalCompensado, saldo: totalAprobado - totalCompensado };
}

/**
 * Saldo de banco de horas de TODOS los usuarios activos, en dos consultas
 * agregadas (no una por usuario) - para el reporte que ve Gerencia con el
 * disponible de todo el equipo.
 */
async function calcularSaldosDeTodos() {
  const [usuarios, aprobadasPorUsuario, compensadasPorUsuario] = await Promise.all([
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, email: true, rol: true, liderId: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.horasExtra.groupBy({
      by: ['ingenieroId'],
      where: { estado: 'aprobada' },
      _sum: { horasTotales: true, horasCompensables: true },
    }),
    prisma.compensacion.groupBy({
      by: ['ingenieroId'],
      _sum: { horas: true },
    }),
  ]);

  const trabajadasPorId = new Map(aprobadasPorUsuario.map((r) => [r.ingenieroId, Number(r._sum.horasTotales || 0)]));
  const aprobadoPorId = new Map(aprobadasPorUsuario.map((r) => [r.ingenieroId, Number(r._sum.horasCompensables || 0)]));
  const compensadoPorId = new Map(compensadasPorUsuario.map((r) => [r.ingenieroId, Number(r._sum.horas || 0)]));

  return usuarios.map((u) => {
    const totalHorasTrabajadas = trabajadasPorId.get(u.id) || 0;
    const totalAprobado = aprobadoPorId.get(u.id) || 0;
    const totalCompensado = compensadoPorId.get(u.id) || 0;
    return { ...u, totalHorasTrabajadas, totalAprobado, totalCompensado, saldo: totalAprobado - totalCompensado };
  });
}

module.exports = { calcularSaldo, calcularSaldosDeTodos };
