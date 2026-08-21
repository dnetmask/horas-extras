'use strict';

const express = require('express');
const prisma = require('../db');
const config = require('../config');
const { nuevoEstadoPkce, urlDeAutorizacion, manejarCallback } = require('../auth/oidc');

const router = express.Router();

function usuarioParaSesion(u) {
  return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol };
}

async function buscarOCrearUsuario({ azureObjectId, email, nombre }) {
  let usuario = await prisma.usuario.findFirst({
    where: { OR: [{ azureObjectId }, { email }] },
  });
  if (usuario) {
    // Vincula el azureObjectId si el usuario fue precargado solo con email
    // (ej. por un admin, antes de que esa persona iniciara sesion la primera vez).
    if (!usuario.azureObjectId) {
      usuario = await prisma.usuario.update({ where: { id: usuario.id }, data: { azureObjectId } });
    }
    return usuario;
  }

  const hayAdmin = await prisma.usuario.findFirst({ where: { rol: 'admin' } });
  return prisma.usuario.create({
    data: {
      azureObjectId,
      email,
      nombre,
      // Bootstrap: si todavia no existe ningun admin, el primer usuario que
      // inicia sesion queda como admin para poder configurar roles/lideres.
      rol: hayAdmin ? 'ingeniero' : 'admin',
    },
  });
}

router.get('/login', async (req, res, next) => {
  try {
    const pkce = nuevoEstadoPkce();
    req.session.pkce = pkce;
    const url = await urlDeAutorizacion(pkce);
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

router.get('/callback', async (req, res, next) => {
  try {
    const pkce = req.session.pkce;
    if (!pkce) return res.status(400).send('Sesion de login expirada, intenta de nuevo desde /auth/login.');
    const { azureObjectId, email, nombre } = await manejarCallback(req, pkce);
    delete req.session.pkce;

    if (!email) return res.status(400).send('La cuenta de Microsoft no devolvio un correo utilizable.');

    const usuario = await buscarOCrearUsuario({ azureObjectId, email, nombre });
    if (!usuario.activo) return res.status(403).send('Tu usuario esta desactivado. Contacta a un administrador.');

    req.session.usuario = usuarioParaSesion(usuario);
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

// Solo para desarrollo local sin credenciales de Azure todavia. Nunca se
// registra esta ruta si DEV_AUTH_BYPASS no es exactamente "true".
if (config.devAuthBypass) {
  router.get('/dev-login', async (req, res, next) => {
    try {
      const email = String(req.query.email || '').toLowerCase();
      if (!email) return res.status(400).send('Usa /auth/dev-login?email=alguien@netmask.co');
      const usuario = await buscarOCrearUsuario({ azureObjectId: `dev-${email}`, email, nombre: email });
      req.session.usuario = usuarioParaSesion(usuario);
      res.redirect('/');
    } catch (err) {
      next(err);
    }
  });
}

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.get('/yo', (req, res) => {
  res.json({ usuario: req.session.usuario || null, devAuthBypass: config.devAuthBypass });
});

module.exports = router;
