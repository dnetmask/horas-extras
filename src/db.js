'use strict';

const { PrismaClient } = require('@prisma/client');

// Cliente unico compartido por toda la app (evita agotar el pool de
// conexiones de Postgres si cada modulo creara el suyo).
const prisma = new PrismaClient();

module.exports = prisma;
