'use strict';

const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../auth/middleware');
const { registrarAuditoria } = require('../lib/auditLog');

const router = express.Router();

// Lista basica para llenar selects (asignar lider, ver nombres) - cualquier
// usuario autenticado la necesita, no solo admin.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nombre: true, email: true, rol: true, liderId: true, activo: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(usuarios);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { email, nombre, rol, liderId } = req.body;
    if (!email || !nombre) return res.status(400).json({ error: 'email y nombre son obligatorios' });
    // Precarga por email: la persona queda vinculada a su cuenta de Azure AD
    // automaticamente la primera vez que inicie sesion (ver buscarOCrearUsuario en auth.js).
    const usuario = await prisma.usuario.create({
      data: { email: email.toLowerCase(), nombre, rol: rol || 'ingeniero', liderId: liderId || null },
    });
    res.status(201).json(usuario);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    next(err);
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const antes = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!antes) return res.status(404).json({ error: 'No existe' });

    const cambios = {};
    for (const campo of ['rol', 'liderId', 'activo', 'nombre']) {
      if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
    }

    const despues = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuario.update({ where: { id: antes.id }, data: cambios });
      for (const campo of Object.keys(cambios)) {
        await registrarAuditoria(tx, {
          tabla: 'usuarios',
          registroId: antes.id,
          usuarioId: req.session.usuario.id,
          accion: 'editar',
          campo,
          valorAntes: antes[campo],
          valorDespues: actualizado[campo],
        });
      }
      return actualizado;
    });

    res.json(despues);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
