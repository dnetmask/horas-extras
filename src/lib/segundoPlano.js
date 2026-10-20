'use strict';

const { waitUntil } = require('@vercel/functions');

/**
 * Ejecuta una tarea despues de responder al usuario (ej. enviar un correo)
 * sin bloquear la respuesta y sin que un fallo tumbe la peticion.
 *
 * - En Docker el proceso vive siempre, asi que la promesa termina sola.
 * - En Vercel la funcion puede congelarse apenas sale la respuesta: waitUntil
 *   le pide a la plataforma que la mantenga viva hasta que la promesa
 *   termine. Fuera de Vercel waitUntil no hace nada (no hay contexto).
 */
function enSegundoPlano(promesa, descripcion) {
  const segura = Promise.resolve(promesa).catch((err) =>
    console.error(`${descripcion}: ${err && err.message ? err.message : err}`)
  );
  waitUntil(segura);
  return segura;
}

module.exports = { enSegundoPlano };
