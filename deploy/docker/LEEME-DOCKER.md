# Horas Extra — Despliegue con Docker (hosting interno en Netmask)

Stack propio y aislado (no comparte base de datos ni autenticación con
FieldSight ni con ningún otro proyecto): un contenedor `db` (PostgreSQL) y un
contenedor `app` (Node.js/Express, sirve tanto la API como el frontend
estático).

## 1) Configurar variables de entorno

```bash
cp .env.example .env
```

Completar en `.env`:
- `POSTGRES_PASSWORD`, `SESSION_SECRET`: generar valores aleatorios propios.
- `APP_BASE_URL`: la URL pública final (la que verán los ingenieros, detrás
  del reverse proxy/firewall de Netmask), ej. `https://horas-extras.netmask.co`.
- `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET`: de un **Azure
  App Registration** en el tenant de Netmask (ver más abajo). Requerido para
  el login SSO y para el envío de correo vía Graph.
- `GRAPH_MAIL_FROM`: el buzón de M365 desde el que se enviarán las
  notificaciones (ej. `notificaciones@netmask.co`).
- `ADMIN_EMAIL_INICIAL` (opcional): el primer email que queda precargado como
  admin. Si se deja vacío, la primera persona que inicie sesión por SSO se
  vuelve admin automáticamente.

## 2) Crear el Azure App Registration (una sola vez, en Entra ID)

Alguien con permisos de administrador en el tenant de Netmask debe:
1. Azure Portal → Entra ID → App registrations → New registration.
   - Redirect URI (Web): `{APP_BASE_URL}/auth/callback`.
2. Certificates & secrets → crear un Client secret → copiarlo a
   `AZURE_CLIENT_SECRET` (no se puede volver a ver después).
3. API permissions → Add a permission → Microsoft Graph → **Application
   permissions** → `Mail.Send` → **Grant admin consent**.
4. Copiar el Application (client) ID → `AZURE_CLIENT_ID`, y el Directory
   (tenant) ID → `AZURE_TENANT_ID`.

Si mientras tanto se quiere probar la app sin esto listo, usar
`DEV_AUTH_BYPASS=true` en un entorno de prueba (nunca en producción) — habilita
`/auth/dev-login?email=...` para entrar sin SSO real.

## 3) Construir y correr

```bash
docker compose up --build -d
```

Esto levanta `db`, y `app` corre migraciones de Prisma + el seed (reglas de
recargo vigentes, calendario de festivos, admin inicial) automáticamente al
iniciar (ver `docker-entrypoint.sh`).

La app queda en `http://localhost:8090` (o el host/puerto que mapee quien
administre el servidor). Hay un endpoint `/healthz` para chequeos de salud.

## 4) HTTPS y publicación externa

Igual que FieldSight: el contenedor solo sirve HTTP en el puerto 8090. El
login SSO de Microsoft **exige HTTPS** en la redirect URI — hay que ponerlo
detrás de un reverse proxy que termine TLS (nginx, Traefik, el firewall de
Netmask, etc.) antes de publicarlo fuera de la red local.

## 5) Después de desplegar

- Confirmar que `APP_BASE_URL` en `.env` coincide exactamente con la URL
  pública final (con `https://`) — si no coincide, Azure AD rechaza el login
  ("redirect_uri_mismatch").
- Entrar como el primer admin, ir a Administración y precargar/ajustar
  ingenieros, líderes y gerencia (rol + a quién reporta cada quien).
- Confirmar que llegan los correos de prueba (crear un registro de horas
  extra de prueba y ver si llega la notificación al líder).

## Notas

- La base de datos (`db`) no expone puerto al host — solo es alcanzable
  dentro de la red interna de este `docker-compose.yml`.
- El job de alerta de 45 días corre dentro del mismo contenedor `app`
  (`node-cron`, todos los días 07:00 hora del contenedor) — no hace falta un
  servicio aparte.
- Backups: `docker exec horas-extras-db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`.
