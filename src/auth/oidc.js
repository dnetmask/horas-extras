'use strict';

const { Issuer, generators } = require('openid-client');
const config = require('../config');

let clientPromise = null;

/**
 * Descubre el emisor OIDC de Entra ID (Azure AD) para el tenant configurado
 * y arma el cliente. Se hace una sola vez (cacheado) y de forma perezosa,
 * para que la app pueda arrancar aunque las credenciales de Azure todavia no
 * esten listas (util mientras se prueba localmente con DEV_AUTH_BYPASS).
 */
function getClient() {
  if (!config.azure.tenantId || !config.azure.clientId || !config.azure.clientSecret) {
    throw new Error(
      'Faltan credenciales de Azure (AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET). ' +
        'Sin ellas no se puede iniciar sesion via SSO (usa DEV_AUTH_BYPASS=true solo en desarrollo).'
    );
  }
  if (!clientPromise) {
    clientPromise = Issuer.discover(`https://login.microsoftonline.com/${config.azure.tenantId}/v2.0`).then(
      (issuer) =>
        new issuer.Client({
          client_id: config.azure.clientId,
          client_secret: config.azure.clientSecret,
          redirect_uris: [`${config.appBaseUrl}/auth/callback`],
          response_types: ['code'],
        })
    );
  }
  return clientPromise;
}

function nuevoEstadoPkce() {
  return {
    state: generators.state(),
    nonce: generators.nonce(),
    codeVerifier: generators.codeVerifier(),
  };
}

async function urlDeAutorizacion({ state, nonce, codeVerifier }) {
  const client = await getClient();
  return client.authorizationUrl({
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: generators.codeChallenge(codeVerifier),
    code_challenge_method: 'S256',
  });
}

async function manejarCallback(req, { state, nonce, codeVerifier }) {
  const client = await getClient();
  const params = client.callbackParams(req);
  const tokenSet = await client.callback(`${config.appBaseUrl}/auth/callback`, params, {
    state,
    nonce,
    code_verifier: codeVerifier,
  });
  const claims = tokenSet.claims();
  return {
    azureObjectId: claims.oid || claims.sub,
    email: (claims.email || claims.preferred_username || '').toLowerCase(),
    nombre: claims.name || claims.email || claims.preferred_username,
  };
}

module.exports = { nuevoEstadoPkce, urlDeAutorizacion, manejarCallback };
