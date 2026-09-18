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

const app = express();
app.disable('x-powered-by');
// Detras de nginx (ver docker-compose.yml) - necesario para que Express vea
// la IP real del cliente y el esquema https original en X-Forwarded-*.
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

app.use(express.static(path.join(__dirname, '..', 'public')));

// Manejador de errores centralizado - evita que cada ruta repita try/catch de logging.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(config.port, () => {
  console.log(`horas-extras escuchando en el puerto ${config.port} (APP_BASE_URL=${config.appBaseUrl})`);
  if (config.devAuthBypass) {
    console.warn('DEV_AUTH_BYPASS=true: /auth/dev-login esta habilitado. NO usar en produccion.');
  }
  programarJobDiario();
  programarJobVencimientoCredenciales();
});
