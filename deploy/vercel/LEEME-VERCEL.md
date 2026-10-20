# Despliegue en Vercel + Neon (paso a paso)

Esta guía mueve la app de horas extra del Docker en la infraestructura de
Netmask a **Vercel** (la app) + **Neon** (PostgreSQL administrado). El mismo
código sigue funcionando en Docker: nada de lo que hay en `deploy/docker/`
cambia.

## Qué cambia respecto a Docker

| Pieza | Docker (Netmask) | Vercel |
|---|---|---|
| Servidor web y TLS | nginx + certificado autofirmado | Vercel, con certificado válido y renovación automática |
| URL | `https://161.18.232.231:53395` | `https://<proyecto>.vercel.app` |
| Base de datos | contenedor `db` + `db-backup` | Neon (Marketplace de Vercel) |
| Alertas diarias | node-cron dentro del contenedor | Vercel Cron llama `GET /api/cron/diario` a las 12:00 UTC (07:00 Colombia) |
| Alerta de vencimiento | certificado TLS + secreto de Azure | solo secreto de Azure (el TLS lo gestiona Vercel) |
| Migraciones y seed | `docker-entrypoint.sh` | `npm run vercel-build`, solo en deploys de producción |

## 0. Antes de empezar

1. **Plan de Vercel.** El plan Hobby solo admite uso personal no comercial.
   Una app interna de empresa cuenta como uso comercial, así que el proyecto
   debe vivir en un equipo **Pro** (o Enterprise). Crea el equipo Pro de
   Netmask en vercel.com antes del paso 2.
2. **Datos personales en la nube.** Nombres, correos y horas de los
   empleados pasan a Vercel y Neon (servidores en EE. UU.). Confírmalo con
   la política de tratamiento de datos de Netmask.
3. **Ventana de corte.** Mientras se copian los datos, la app Docker debe
   quedar detenida. Así no quedan dos bases distintas ni alertas duplicadas.
4. **Herramientas en tu equipo:** Node.js 20 o superior, Docker Desktop
   encendido (para `pg_restore`) y acceso SSH al servidor por la VPN.

## 1. Instalar la CLI de Vercel e iniciar sesión

```bash
npm install -g vercel
```

```bash
vercel login
```

## 2. Vincular el proyecto

Desde la carpeta `horas-extras`, en la rama que tiene la adaptación:

```bash
git checkout feature/vercel
```

```bash
vercel link
```

Respuestas sugeridas:

- **Scope:** el equipo Pro de Netmask.
- **Link to existing project?** No.
- **Project name:** `netmask-horas-extras`.
- **Directory:** `./`.

Vercel detecta Express solo. La entrada es `src/server.js`, que exporta la
app; la carpeta `public/` la sirve el CDN de Vercel.

## 3. Crear la base Neon y conectarla al proyecto

En vercel.com, abre el proyecto `netmask-horas-extras`:

1. **Storage → Create Database → Neon (Serverless Postgres).**
2. Región: **AWS us-east-1 (Washington, D.C.)**, la misma de las funciones
   de Vercel (`iad1`) para que cada consulta no cruce el continente.
3. Plan **Free** alcanza para este volumen de datos.
4. En **Connect to project**, marca **Production** y deja el prefijo de
   variables **vacío**. Así se crean `DATABASE_URL` (con pooler) y
   `DATABASE_URL_UNPOOLED` (directa), que es lo que espera la app.

Comprueba que quedaron creadas:

```bash
vercel env ls production
```

## 4. Migrar los datos desde el Docker actual

Si prefieres arrancar con la base vacía, salta al paso 5 y define
`ADMIN_EMAIL_INICIAL`.

### 4.1 En el servidor (SSH por la VPN)

Detén la app, deja arriba solo la base y saca el respaldo. El comando usa
el usuario y la base que ya están definidos dentro del contenedor.

```bash
cd ~/horas-extras && docker compose stop app nginx && docker compose up -d db
```

```bash
docker exec horas-extras-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -Fc' > ~/horas-extras.dump && ls -lh ~/horas-extras.dump
```

### 4.2 En tu equipo (PowerShell)

Copia el respaldo, reemplazando `<servidor>` por la IP con la que entras por
SSH:

```powershell
scp iniadmin@<servidor>:~/horas-extras.dump .
```

Toma la cadena **directa** de Neon: en vercel.com, **Storage → la base →
pestaña `.env.local` → Show secret**, y copia el valor de
`DATABASE_URL_UNPOOLED`. No la pegues en chats ni la guardes en archivos
del repositorio.

```powershell
$env:NEON_URL = Read-Host "Pega DATABASE_URL_UNPOOLED"
```

```powershell
docker run --rm -v "${PWD}:/d" postgres:17-alpine pg_restore --no-owner --no-privileges --clean --if-exists -d $env:NEON_URL /d/horas-extras.dump
```

Verifica los conteos y compáralos con lo que veías en la app:

```powershell
docker run --rm postgres:17-alpine psql $env:NEON_URL -c "select (select count(*) from usuarios) usuarios, (select count(*) from horas_extra) horas_extra, (select count(*) from compensaciones) compensaciones"
```

Cuando el conteo cuadre, borra el respaldo de tu equipo y del servidor.
Contiene datos personales.

```powershell
Remove-Item .\horas-extras.dump; Remove-Item Env:\NEON_URL
```

```bash
rm ~/horas-extras.dump
```

## 5. Variables de entorno (Production)

En vercel.com: **Settings → Environment Variables → Add**, entorno
**Production**. Marca **Sensitive** en las que dicen "secreto".

| Variable | Valor |
|---|---|
| `APP_BASE_URL` | `https://netmask-horas-extras.vercel.app`, o el dominio que muestre **Settings → Domains** |
| `SESSION_SECRET` | secreto nuevo, generado con el comando de abajo |
| `CRON_SECRET` | secreto nuevo, generado con el comando de abajo |
| `AZURE_TENANT_ID` | el mismo del `.env` del servidor |
| `AZURE_CLIENT_ID` | el mismo del `.env` del servidor |
| `AZURE_CLIENT_SECRET` | secreto: el vigente del App Registration |
| `AZURE_CLIENT_SECRET_EXPIRES` | fecha de vencimiento de ese secreto, `YYYY-MM-DD` |
| `GRAPH_MAIL_FROM` | `notificacion@netmask.co` |
| `DEV_AUTH_BYPASS` | `false` |
| `ADMIN_EMAIL_INICIAL` | solo si arrancas con la base vacía |

Genera cada secreto nuevo con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`CRON_SECRET` es el que Vercel Cron envía como `Authorization: Bearer ...`.
Sin él, el endpoint de alertas responde 401 y no se envía ninguna alerta.

## 6. Agregar la URL nueva en Azure (Entra ID)

En **portal.azure.com → App registrations → la app de horas extra →
Authentication → Web → Redirect URIs → Add URI**:

```text
https://netmask-horas-extras.vercel.app/auth/callback
```

Deja también la URI de la IP pública hasta apagar el Docker definitivamente.
El permiso Mail.Send no cambia: el correo sale por Microsoft Graph desde
cualquier servidor.

## 7. Desplegar

```bash
vercel deploy --prod
```

En el log del build debes ver, en este orden: `prisma generate`,
`prisma migrate deploy` ("No pending migrations to apply" si migraste
datos) y los mensajes del seed. Si el dominio final no coincide con
`APP_BASE_URL`, corrige la variable y la URI de Azure y vuelve a desplegar.
Vercel lee las variables al construir, así que cada cambio de variable
necesita un deploy nuevo.

## 8. Verificar

1. `https://<dominio>/healthz` responde `{"ok":true}`.
2. **Iniciar sesión con Microsoft** te devuelve a la app con tu nombre.
3. El banco de horas de un ingeniero conocido muestra el mismo saldo que en
   Docker.
4. Exportar a **Excel** y a **PDF** descarga los archivos.
5. Registra una hora extra de prueba con tu usuario como líder. El correo
   debe llegar desde notificacion@netmask.co. Luego elimínala.
6. En **Settings → Cron Jobs** aparece `/api/cron/diario` con `0 12 * * *`.
   El botón **Run** envía alertas reales: los avisos de 45 días no se
   repiten antes de 7 días, pero úsalo con criterio.
7. Los errores quedan en **Logs** del proyecto.

## 9. Cerrar el Docker

Con todo verificado, avisa a los ingenieros la URL nueva. En el servidor la
app ya quedó detenida en el paso 4.1. Conserva el volumen de la base y la
carpeta `backups/` unas semanas como respaldo. Después se puede retirar la
regla NAT del puerto 53395 en el firewall.

Para volver atrás, ejecuta el comando de abajo en el servidor. Lo que se
haya registrado en Vercel mientras tanto queda solo en Neon.

```bash
cd ~/horas-extras && docker compose start app nginx
```

## 10. Después del primer despliegue

- **Despliegue automático desde GitHub:** en **Settings → Git**, conecta
  `dnetmask/horas-extras` con rama de producción `main`. Desde ahí, cada
  merge a `main` despliega solo. Mantén el flujo de siempre: rama → PR a
  `develop` → PR `develop` → `main`.
- **Previews:** los deploys de otras ramas no migran la base (lo controla
  `scripts/vercel-build.js`). Como las variables solo existen en
  Production, una preview no sirve como ambiente de prueba. Para eso se
  puede crear una rama de Neon y variables de Preview aparte.
- **Respaldos:** Neon permite restaurar a un punto en el tiempo, con una
  ventana que depende del plan (corta en el gratuito). Para retención
  larga, saca un `pg_dump` periódico como en el paso 4.1.
- **Rotación del secreto de Azure:** al rotarlo, actualiza
  `AZURE_CLIENT_SECRET` y `AZURE_CLIENT_SECRET_EXPIRES` en Vercel y
  despliega de nuevo.
