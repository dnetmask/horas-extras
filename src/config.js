'use strict';

require('dotenv').config();

function requerido(nombre, permitirVacioEnDev) {
  const valor = process.env[nombre];
  if (!valor && !permitirVacioEnDev) {
    // No tira error duro al cargar el modulo: varias piezas (SSO real, Graph
    // mail) pueden faltar mientras se prueba localmente con DEV_AUTH_BYPASS.
    // Cada consumidor valida lo que realmente necesita en el momento de usarlo.
  }
  return valor;
}

const config = {
  port: Number(process.env.PORT || 8090),
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 8090}`,
  databaseUrl: requerido('DATABASE_URL'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-cambiar',
  devAuthBypass: String(process.env.DEV_AUTH_BYPASS).toLowerCase() === 'true',
  azure: {
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
  graphMailFrom: process.env.GRAPH_MAIL_FROM,
};

module.exports = config;
