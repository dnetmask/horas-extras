'use strict';

// Migra las horas extra historicas del Excel "Horas Compensatorias Netmask
// V5.xlsx" (hoja Registro) hacia la base de datos nueva. Los datos ya vienen
// pre-extraidos y emparejados contra correos reales en
// prisma/datos-migracion-excel.json (ver conversacion de migracion - se
// excluyeron personas que ya no trabajan en Netmask, un registro duplicado y
// uno incompleto).
//
// Cada fila se recalcula con el MISMO motor que usa la app en vivo
// (src/lib/recargos.js + src/lib/reglas.js), no se copian los totales del
// Excel (varias formulas ahi estaban rotas/desalineadas). Los registros
// quedan directamente en estado "aprobada" (ya sucedieron), y si tenian
// "Horas Consumidas" > 0 se crea tambien una Compensacion para que el saldo
// disponible de cada persona en la app sea el saldo REAL de hoy.
//
// Uso: docker compose exec app node scripts/migrar-horas-excel.js
// Seguro de correr mas de una vez: no vuelve a crear una fila si ya existe
// una HorasExtra con el mismo ingeniero+fecha+horaInicio+horaFin.

const prisma = require('../src/db');
const { calcularHorasExtra } = require('../src/lib/recargos');
const { construirContextoDeCalculo } = require('../src/lib/reglas');
const datos = require('../prisma/datos-migracion-excel.json');

async function resolverUsuario(cache, email) {
  if (!email) return null;
  if (cache.has(email)) return cache.get(email);
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  cache.set(email, usuario);
  return usuario;
}

async function main() {
  const cacheUsuarios = new Map();
  const ctx = await construirContextoDeCalculo();

  let migradas = 0;
  let yaExistian = 0;
  let saltadasSinUsuario = 0;
  let compensacionesCreadas = 0;

  for (const fila of datos) {
    const ingeniero = await resolverUsuario(cacheUsuarios, fila.ingenieroEmail);
    if (!ingeniero) {
      console.warn(`SALTADA (sin usuario ingeniero): ${fila.ingenieroEmail} - ${fila.fecha}`);
      saltadasSinUsuario++;
      continue;
    }
    const lider = await resolverUsuario(cacheUsuarios, fila.liderEmail);
    if (!lider) {
      console.warn(`SALTADA (sin usuario lider): ${fila.liderEmail} - ${fila.fecha} (${fila.ingenieroEmail})`);
      saltadasSinUsuario++;
      continue;
    }
    const gerencia = await resolverUsuario(cacheUsuarios, fila.gerenciaEmail);

    const existente = await prisma.horasExtra.findFirst({
      where: {
        ingenieroId: ingeniero.id,
        fecha: new Date(`${fila.fecha}T00:00:00Z`),
        horaInicio: fila.horaInicio,
        horaFin: fila.horaFin,
      },
    });
    if (existente) {
      yaExistian++;
      continue;
    }

    const calculo = calcularHorasExtra({
      fecha: fila.fecha,
      horaInicio: fila.horaInicio,
      horaFin: fila.horaFin,
      ...ctx,
    });

    const registro = await prisma.horasExtra.create({
      data: {
        ingenieroId: ingeniero.id,
        liderId: lider.id,
        fecha: new Date(`${fila.fecha}T00:00:00Z`),
        horaInicio: fila.horaInicio,
        horaFin: fila.horaFin,
        caso: fila.caso,
        ot: fila.ot,
        obra: fila.obra,
        estado: 'aprobada',
        liderRespondidoEn: new Date(`${fila.fecha}T00:00:00Z`),
        gerenciaAprobadorId: gerencia ? gerencia.id : null,
        gerenciaRespondidoEn: gerencia ? new Date(`${fila.fecha}T00:00:00Z`) : null,
        horasExtraDiurnaOrd: calculo.horasExtraDiurnaOrd,
        horasExtraNocturnaOrd: calculo.horasExtraNocturnaOrd,
        horasExtraDiurnaDomFest: calculo.horasExtraDiurnaDomFest,
        horasExtraNocturnaDomFest: calculo.horasExtraNocturnaDomFest,
        horasTotales: calculo.horasTotales,
      },
    });
    migradas++;
    console.log(`+ migrada: ${fila.ingenieroEmail} ${fila.fecha} ${fila.horaInicio}-${fila.horaFin} (${calculo.horasTotales}h)`);

    if (fila.horasConsumidas > 0) {
      const horaFinConsumo = `${String(Math.min(23, Math.floor(fila.horasConsumidas))).padStart(2, '0')}:${
        fila.horasConsumidas % 1 ? '30' : '00'
      }`;
      await prisma.compensacion.create({
        data: {
          ingenieroId: ingeniero.id,
          horasExtraId: registro.id,
          fechaCompensacion: new Date(`${fila.fecha}T00:00:00Z`),
          horaInicio: '00:00',
          horaFin: horaFinConsumo,
          horas: fila.horasConsumidas,
          registradoPorId: lider.id,
        },
      });
      compensacionesCreadas++;
    }
  }

  console.log(
    `\nListo. Migradas: ${migradas}. Ya existian: ${yaExistian}. Saltadas (usuario no encontrado): ${saltadasSinUsuario}. Compensaciones creadas: ${compensacionesCreadas}.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
