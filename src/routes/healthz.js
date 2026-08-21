'use strict';

const express = require('express');
const prisma = require('../db');

const router = express.Router();

router.get('/healthz', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'DB no disponible' });
  }
});

module.exports = router;
