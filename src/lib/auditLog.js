'use strict';

/**
 * Registra un evento de auditoria dentro de la misma transaccion que el
 * cambio que lo origina (pasar `tx` = el cliente de Prisma dentro de un
 * `prisma.$transaction`). Requisito: "control de cambio segun el usuario" -
 * toda alta/edicion/aprobacion queda con quien la hizo, cuando, y el valor
 * antes/despues.
 */
async function registrarAuditoria(tx, { tabla, registroId, usuarioId, accion, campo = null, valorAntes = null, valorDespues = null }) {
  await tx.auditLog.create({
    data: {
      tabla,
      registroId,
      usuarioId,
      accion,
      campo,
      valorAntes: valorAntes === null || valorAntes === undefined ? null : String(valorAntes),
      valorDespues: valorDespues === null || valorDespues === undefined ? null : String(valorDespues),
    },
  });
}

module.exports = { registrarAuditoria };
