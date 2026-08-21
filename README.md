# Horas Extra — Netmask

App interna para que los ingenieros de Netmask reporten sus horas extra,
sean aprobadas por su líder y por gerencia, se calculen los recargos según la
ley colombiana vigente, se lleve un banco de horas compensatorias y se
alerte automáticamente si pasan 45 días sin compensar. Reemplaza el Excel
`Horas Compensatorias Netmask V5.xlsx`.

Proyecto **independiente** de FieldSight: repo propio, base de datos propia,
autenticación propia (SSO con Microsoft Entra ID), despliegue propio.

## Stack

- Backend: Node.js + Express + Prisma (PostgreSQL).
- Frontend: HTML/CSS/JS vanilla sin build step (`public/`), consumiendo la
  API propia del mismo origen.
- Auth: SSO con Microsoft Entra ID (OIDC + PKCE).
- Correo: Microsoft Graph API (`sendMail`), mismo App Registration del SSO.
- Alertas: `node-cron` dentro del propio contenedor.

## Desarrollo local

```bash
cp .env.example .env
# completar DATABASE_URL apuntando a un Postgres local, o levantar solo "db":
docker compose up db -d

npm install
npx prisma migrate dev
npm run seed

# Sin credenciales de Azure todavia: activar en .env
#   DEV_AUTH_BYPASS=true
npm run dev
# abrir http://localhost:8090 y usar "Modo desarrollo" para entrar como
# cualquier email de prueba sin SSO real.
```

Pruebas del motor de cálculo de recargos (no requieren base de datos):

```bash
npm test
```

## Despliegue en Netmask (Docker)

Ver [`deploy/docker/LEEME-DOCKER.md`](deploy/docker/LEEME-DOCKER.md) —
incluye cómo crear el Azure App Registration necesario para el SSO y el
envío de correo.

## Modelo de datos y motor de recargos

- `prisma/schema.prisma`: fuente de verdad del modelo de datos.
- `src/lib/recargos.js`: clasifica cada registro en horas extra
  diurna/nocturna ordinaria y diurna/nocturna dominical-festiva, manejando
  turnos que cruzan medianoche.
- `src/lib/festivos.js`: calendario de festivos de Colombia, calculado
  (Ley Emiliani + Semana Santa vía algoritmo de Pascua) — no depende de una
  lista hardcodeada por año.
- `recargo_rule_sets` (tabla, sembrada en `prisma/seed.js`): porcentajes de
  recargo y ventana horaria diurna/nocturna, versionados por fecha de
  vigencia — así absorben cambios futuros de la ley (ej. el recargo
  dominical/festivo sube a 100% el 2027-07-01) sin necesidad de un
  despliegue nuevo. Un admin puede agregar una vigencia nueva desde
  `POST /api/reglas-recargo`.

## Control de cambios

Toda alta/edición/aprobación de un registro de horas extra o de un usuario
queda en `audit_log` (tabla `AuditLog`): quién, cuándo, qué campo, valor
antes/después. Un ingeniero solo puede crear/editar sus propios registros, y
solo mientras están `pendiente_lider` (una vez que entra a aprobación, ya no
se puede editar en silencio).
