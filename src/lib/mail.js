'use strict';

const msal = require('@azure/msal-node');
const config = require('../config');

let cca = null;
function getClientApp() {
  if (!config.azure.tenantId || !config.azure.clientId || !config.azure.clientSecret) {
    throw new Error(
      'Faltan credenciales de Azure (AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET) para enviar correo via Graph.'
    );
  }
  if (!cca) {
    cca = new msal.ConfidentialClientApplication({
      auth: {
        clientId: config.azure.clientId,
        authority: `https://login.microsoftonline.com/${config.azure.tenantId}`,
        clientSecret: config.azure.clientSecret,
      },
    });
  }
  return cca;
}

async function obtenerTokenGraph() {
  const app = getClientApp();
  const resultado = await app.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  return resultado.accessToken;
}

/**
 * Envia un correo usando Microsoft Graph (`sendMail`) desde el buzon
 * configurado en GRAPH_MAIL_FROM, autenticado por client credentials con el
 * mismo App Registration usado para el SSO. Requiere el permiso de
 * aplicacion "Mail.Send" consentido por un admin del tenant.
 */
async function enviarCorreo({ para, asunto, html }) {
  if (!config.graphMailFrom) {
    throw new Error('Falta GRAPH_MAIL_FROM (buzon remitente) en la configuracion.');
  }
  const destinatarios = (Array.isArray(para) ? para : [para]).filter(Boolean);
  if (destinatarios.length === 0) return;

  const token = await obtenerTokenGraph();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.graphMailFrom)}/sendMail`;

  const body = {
    message: {
      subject: asunto,
      body: { contentType: 'HTML', content: html },
      toRecipients: destinatarios.map((email) => ({ emailAddress: { address: email } })),
    },
    saveToSentItems: true,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Graph sendMail fallo (${resp.status}): ${texto}`);
  }
}

module.exports = { enviarCorreo };
