'use strict';

function requireAuth(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesión en /auth/login.' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.usuario) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    if (!roles.includes(req.session.usuario.rol)) {
      return res.status(403).json({ error: `Esta accion requiere uno de estos roles: ${roles.join(', ')}.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
