# Checklist de despliegue en el servidor real de Netmask

Para quien tenga acceso al servidor de producción (distinto del usado para
desarrollar esto). Sigue `LEEME-DOCKER.md` para el detalle de cada paso; esto
es el resumen ejecutable, ya con los valores reales que se definieron:

- IP pública / puerto: `161.18.232.231:53395`
- Azure Tenant ID: `8cad3d70-facd-4b74-a95e-08458c90d001`
- Azure Client ID: `8a8cedab-e7cd-49a5-81dc-4fecdcda288d`
- Redirect URI ya registrado en Azure AD: `https://161.18.232.231:53395/auth/callback`

## Pasos

- [ ] El servidor tiene Docker + Docker Compose instalados y acceso saliente
      a internet (necesita llegar a `login.microsoftonline.com` y
      `graph.microsoft.com`).
- [ ] Clonar el repo: `git clone https://github.com/dnetmask/horas-extras.git`
- [ ] `cp .env.example .env` y completar:
  - `POSTGRES_PASSWORD`: generar uno nuevo (`openssl rand -hex 16`), no
    reusar el de pruebas.
  - `SESSION_SECRET`: generar uno nuevo (`openssl rand -hex 32`).
  - `APP_BASE_URL=https://161.18.232.231:53395`
  - `NGINX_HTTPS_PORT=53395`
  - `AZURE_TENANT_ID=8cad3d70-facd-4b74-a95e-08458c90d001`
  - `AZURE_CLIENT_ID=8a8cedab-e7cd-49a5-81dc-4fecdcda288d`
  - `AZURE_CLIENT_SECRET=` **el secreto NUEVO** generado en Azure (rotar el
    que se compartió por chat durante las pruebas — no reusarlo).
  - `GRAPH_MAIL_FROM=` el buzón real activado para esto.
  - `DEV_AUTH_BYPASS=false` — **importante**, en producción real debe quedar
    en `false` para que nadie entre sin pasar por el SSO de Microsoft.
  - `ADMIN_EMAIL_INICIAL=` (opcional) el correo de quien debe quedar como
    admin desde el primer login.
- [ ] Generar el certificado con la IP real:
      `./scripts/generar-certificado-autofirmado.sh 161.18.232.231`
- [ ] `docker compose up --build -d`
- [ ] Verificar localmente en el servidor: `curl -k https://localhost:53395/healthz`
      debe responder `{"ok":true}`.
- [ ] Pedir al equipo de firewall que reenvíe el puerto público `53395` hacia
      la IP interna de este servidor, puerto `53395`.
- [ ] Correr la **Application Access Policy** en Exchange Online (ver
      `LEEME-DOCKER.md`, sección 2) usando el Client ID de arriba.
- [ ] Probar `https://161.18.232.231:53395/auth/login` desde un navegador
      real con una cuenta de Netmask — **idealmente desde un equipo
      administrado por TI**, para confirmar que el certificado autofirmado no
      bloquea el acceso.
- [ ] Entrar como el primer admin → Administración → precargar ingenieros,
      líderes y gerencia reales (hoy la app no tiene datos reales, solo lo
      que se cargue aquí).
- [ ] Crear un registro de horas extra de prueba y confirmar que el correo de
      pre-aprobación llega de verdad al líder elegido.
