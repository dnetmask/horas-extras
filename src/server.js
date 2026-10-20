'use strict';

const express = require('express');
const session = require('express-session');
const path = require('node:path');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);

const config = require('./config');
const { programarJobDiario } = require('./jobs/alertaVencimiento');
const { programarJobVencimientoCredenciales } = require('./jobs/alertaVencimientoCredenciales');

const authRoutes = require('./routes/auth');
const healthzRoutes = require('./routes/healthz');
const horasExtraRoutes = require('./routes/horasExtra');
const aprobacionesRoutes = require('./routes/aprobaciones');
const usuariosRoutes = require('./routes/usuarios');
const compensacionesRoutes = require('./routes/compensaciones');
const reglasRecargoRoutes = require('./routes/reglasRecargo');
const exportarRoutes = require('./routes/exportar');
const cronRoutes = require('./routes/cron');

// Vercel define VERCEL=1 en sus funciones. Ahi la plataforma importa `app`
// (module.exports al final) en vez de que este proceso abra un puerto, y las
// alertas diarias llegan por Vercel Cron (vercel.json) en vez de node-cron.
const EN_VERCEL = Boolean(process.env.VERCEL);

const app = express();
app.disable('x-powered-by');
// Detras de un proxy (nginx en Docker, la red de Vercel en Vercel) - necesario
// para que Express vea la IP real del cliente y el esquema https original en
// X-Forwarded-*, y asi acepte la cookie de sesion "secure".
app.set('trust proxy', 1);
app.use(express.json());

const sessionPool = new Pool({ connectionString: config.databaseUrl });
app.use(
  session({
    store: new pgSession({ pool: sessionPool, tableName: 'session', createTableIfMissing: true }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.appBaseUrl.startsWith('https://'),
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
    },
  })
);

app.use(healthzRoutes);
app.use('/auth', authRoutes);
app.use('/api/horas-extra', horasExtraRoutes);
app.use('/api/aprobaciones', aprobacionesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/compensaciones', compensacionesRoutes);
app.use('/api/reglas-recargo', reglasRecargoRoutes);
app.use('/api/exportar', exportarRoutes);
app.use('/api/cron', cronRoutes);

// En Vercel esto no se usa: la carpeta public/ la sirve directamente su CDN.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Manejador de errores centralizado - evita que cada ruta repita try/catch de logging.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;

if (!EN_VERCEL) {
  // Docker / desarrollo local: proceso persistente con su propio puerto y
  // sus jobs diarios programados en memoria.
  app.listen(config.port, () => {
    console.log(`horas-extras escuchando en el puerto ${config.port} (APP_BASE_URL=${config.appBaseUrl})`);
    if (config.devAuthBypass) {
      console.warn('DEV_AUTH_BYPASS=true: /auth/dev-login esta habilitado. NO usar en produccion.');
    }
    programarJobDiario();
    programarJobVencimientoCredenciales();
  });
} else if (config.devAuthBypass) {
  console.warn('DEV_AUTH_BYPASS=true en Vercel: /auth/dev-login esta habilitado. NO usar en produccion.');
}
