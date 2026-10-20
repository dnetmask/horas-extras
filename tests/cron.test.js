'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { autorizado } = require('../src/routes/cron');

test('cron: acepta solo el encabezado Bearer exacto', () => {
  assert.equal(autorizado('Bearer s3creto', 's3creto'), true);
  assert.equal(autorizado('Bearer otro', 's3creto'), false);
  assert.equal(autorizado('s3creto', 's3creto'), false);
  assert.equal(autorizado(undefined, 's3creto'), false);
});

test('cron: sin CRON_SECRET configurado el endpoint queda cerrado', () => {
  assert.equal(autorizado('Bearer ', ''), false);
  assert.equal(autorizado('Bearer undefined', undefined), false);
});
