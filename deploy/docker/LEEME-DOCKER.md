# Horas Extra — Despliegue con Docker (hosting interno en Netmask)

Stack propio y aislado (no comparte base de datos ni autenticación con
FieldSight ni con ningún otro proyecto): `db` (PostgreSQL, sin exponer),
`app` (Node.js/Express, API + frontend estático, sin exponer) y `nginx`
(termina el HTTPS con el certificado autofirmado y es lo único que se
publica al host/firewall).

Se publica por la **IP pública del firewall de Netmask + un puerto**, sin
subdominio propio — por eso el certificado es autofirmado (Let's Encrypt no
emite certificados para IPs, solo para dominios).

## 0) Requisitos antes de empezar

- **IP pública estática**: si la IP cambia, el certificado y el Redirect URI
  de Azure AD registrado quedan desactualizados y el login deja de
  funcionar. Confirmar con quien administre el firewall que es fija.
- **El puerto elegido para publicar la app** (el que el firewall va a
  reenviar hacia este servidor). Este LEEME usa `8443` de ejemplo.

Generar el certificado autofirmado (necesita `openssl`, viene instalado en
casi cualquier Linux/WSL/Git Bash):

```bash
./scripts/generar-certificado-autofirmado.sh <ip-publica>
```

Esto crea `certs/fullchain.pem` y `certs/privkey.pem` (ninguno de los dos se
sube a git). El certificado incluye la IP como Subject Alternative Name -
sin eso, Chrome/Edge lo rechazan por completo, no solo con advertencia.
Vence en ~397 días (el máximo que aceptan los navegadores) - hay que
regenerarlo antes de esa fecha y reiniciar `nginx` (`docker compose restart nginx`).

**Advertencia real, no solo estética:** como el certificado no lo emite una
autoridad reconocida, los navegadores van a mostrar "conexión no segura" la
primera vez. En equipos personales el usuario solo hace clic en "Continuar".
En equipos **administrados por TI de Netmask** (políticas de Chrome/Edge vía
Intune/GPO), algunas configuraciones bloquean por completo sitios con
certificado no confiable en vez de solo advertir. **Probar en un equipo real
administrado antes de anunciarlo a todo el equipo** — si eso pasa, la única
salida sería conseguir un subdominio para poder usar un certificado real
(gratis con Let's Encrypt).

## 1) Configurar variables de entorno

```bash
cp .env.example .env
```

Completar en `.env`:
- `POSTGRES_PASSWORD`, `SESSION_SECRET`: generar valores aleatorios propios.
- `APP_BASE_URL`: `https://<ip-publica>:<puerto-elegido>` (ej.
  `https://203.0.113.10:8443`) — debe coincidir EXACTO (mismo puerto) con lo
  que el firewall publica hacia afuera.
- `NGINX_HTTPS_PORT` (default `8443`): puerto que este `docker-compose`
  expone en el host para HTTPS. El firewall reenvía su puerto público hacia
  este.
- `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET`: de un **Azure
  App Registration** en el tenant de Netmask (ver más abajo). Requerido para
  el login SSO y para el envío de correo vía Graph.
- `GRAPH_MAIL_FROM`: el buzón de M365 desde el que se enviarán las
  notificaciones (ej. `notificacion@netmask.co`).
- `ADMIN_EMAIL_INICIAL` (opcional): el primer email que queda precargado como
  admin. Si se deja vacío, la primera persona que inicie sesión por SSO se
  vuelve admin automáticamente.

## 2) Crear el Azure App Registration (una sola vez, en Entra ID)

Alguien con permisos de administrador en el tenant de Netmask debe:
1. Azure Portal → Entra ID → App registrations → New registration.
   - Redirect URI (Web): `{APP_BASE_URL}/auth/callback`, ej.
     `https://203.0.113.10:8443/auth/callback`.

   > Nota: no hay garantía de que el portal de Azure AD acepte una IP
   > literal como Redirect URI (es un caso poco común, pensado
   > normalmente para dominios). Si al guardarlo el portal lo rechaza, la
   > única alternativa es conseguir un subdominio para usar en su lugar.
2. Certificates & secrets → crear un Client secret → copiarlo a
   `AZURE_CLIENT_SECRET` (no se puede volver a ver después).
3. API permissions → Add a permission → Microsoft Graph → **Application
   permissions** → `Mail.Send` → **Grant admin consent**.
4. Copiar el Application (client) ID → `AZURE_CLIENT_ID`, y el Directory
   (tenant) ID → `AZURE_TENANT_ID`.

Crear este App Registration y darle consentimiento **no afecta a ningún otro
usuario ni sistema de Netmask** — es un objeto nuevo e independiente en el
directorio, no toca otras apps, sesiones activas ni políticas existentes.

**Importante — acotar el alcance de `Mail.Send`:** tal como queda configurado
arriba, el permiso es de tipo *Application*, lo que por defecto le permite a
esta app enviar correo **haciéndose pasar por cualquier buzón del tenant**,
no solo por el de `GRAPH_MAIL_FROM`. Para que solo pueda enviar como el buzón
de notificaciones, un admin de Exchange Online debe correr (una sola vez,
con el Client ID del paso 4 y el buzón real):

```powershell
Connect-ExchangeOnline
New-ApplicationAccessPolicy `
  -AppId "<AZURE_CLIENT_ID>" `
  -PolicyScopeGroupId "notificacion@netmask.co" `
  -AccessRight RestrictAccess `
  -Description "Horas Extra - solo puede enviar como notificacion@netmask.co"
# Verificar que quedo bien:
Test-ApplicationAccessPolicy -AppId "<AZURE_CLIENT_ID>" -Identity "notificacion@netmask.co"   # debe decir "Granted"
Test-ApplicationAccessPolicy -AppId "<AZURE_CLIENT_ID>" -Identity "cualquier-otro@netmask.co"    # debe decir "Denied"
```

Sin este paso el permiso sigue siendo válido (la app funciona igual), solo
queda más amplio de lo necesario.

**Si el buzón `notificacion@netmask.co` ya lo comparten otras apps**: no
hay conflicto. Cada app tiene su propio Client ID y su propia política — la
de arriba solo declara "esta app puede enviar como este buzón", sin afectar
las políticas que ya tengan las demás apps sobre el mismo buzón.

Si mientras tanto se quiere probar la app sin esto listo, usar
`DEV_AUTH_BYPASS=true` en un entorno de prueba (nunca en producción) — habilita
`/auth/dev-login?email=...` para entrar sin SSO real.

## 3) Construir y correr

```bash
docker compose up --build -d
```

Esto levanta `db`, `app` (corre migraciones de Prisma + el seed
automáticamente, ver `docker-entrypoint.sh`) y `nginx` (termina TLS con el
certificado de `certs/`).

La app queda en `https://localhost:8443` (o el host/puerto que se haya
configurado). Hay un endpoint `/healthz` para chequeos de salud
(alcanzable como `https://.../healthz`, a través de nginx).

## 4) Publicar en el firewall

En el firewall de Netmask, crear la regla de NAT/port-forward: puerto
público elegido → IP interna de este servidor : `NGINX_HTTPS_PORT` (8443 por
defecto). `nginx` es el único contenedor que necesita quedar alcanzable
desde afuera — `app` y `db` nunca se exponen.

## 5) Después de desplegar

- Confirmar que `APP_BASE_URL` en `.env` coincide EXACTO (mismo puerto) con
  la URL pública final — si no coincide, Azure AD rechaza el login
  ("redirect_uri_mismatch").
- **Probar el login desde un equipo real administrado por Netmask** (no solo
  el propio) para confirmar que la advertencia de certificado no bloquea el
  acceso (ver advertencia en el paso 0).
- Entrar como el primer admin, ir a Administración y precargar/ajustar
  ingenieros, líderes y gerencia (rol + a quién reporta cada quien).
- Confirmar que llegan los correos de prueba (crear un registro de horas
  extra de prueba y ver si llega la notificación al líder elegido).

## Notas

- La base de datos (`db`) y la app (`app`) no exponen puerto al host — solo
  `nginx` lo hace. Todo el tráfico entre ellos va por la red interna de este
  `docker-compose.yml`.
- El job de alerta de 45 días corre dentro del mismo contenedor `app`
  (`node-cron`, todos los días 07:00 hora del contenedor) — no hace falta un
  servicio aparte.
- Backups: `docker exec horas-extras-db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`.
- Renovar el certificado: volver a correr
  `./scripts/generar-certificado-autofirmado.sh <ip-publica>` y
  `docker compose restart nginx`.
