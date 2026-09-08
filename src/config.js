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
    // Fecha (YYYY-MM-DD) en que vence el Client Secret de arriba - Azure no
    // expone esto por una API simple, así que se anota a mano al crearlo o
    // rotarlo (ver deploy/docker/LEEME-DOCKER.md). Sin esto, no se puede
    // avisar antes de que venza.
    clientSecretExpira: process.env.AZURE_CLIENT_SECRET_EXPIRES,
  },
  graphMailFrom: process.env.GRAPH_MAIL_FROM,
  certPath: process.env.CERT_PATH || '/app/certs/fullchain.pem',
};

module.exports = config;
