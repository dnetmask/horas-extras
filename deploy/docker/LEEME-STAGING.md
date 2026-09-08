# Ambiente de prueba (staging)

Un checkout **separado** del repo, en su propia carpeta, apuntando a la rama
`develop` en vez de `main` - corre en el mismo servidor que producción, con
su propia base de datos/contenedores/puerto, sin tocar nada de lo real.

## Flujo de ramas (igual al de FieldSight)

- `develop`: donde aterrizan los cambios en revisión. Cada cambio en **su
  propia rama** (`feature/nombre-del-cambio`) con su propio Pull Request
  hacia `develop`.
- `main`: lo que corre en producción. Cuando un lote de cambios ya se probó
  en staging (rama `develop`), se abre un PR `develop → main`, y ese merge
  es la señal de "listo para producción" (ver paso 3 más abajo).

## 1) Crear el checkout de staging (una sola vez)

```bash
cd ~
git clone -b develop https://github.com/dnetmask/horas-extras.git horas-extras-staging
cd horas-extras-staging
```

Si `develop` todavía no existe en el remoto, créala primero desde `main` (una
sola vez): `git checkout -b develop && git push -u origin develop`.

## 2) Configurar `.env` de staging

```bash
cp .env.staging.example .env
```

Ajustar si hace falta (contraseñas, puertos `53396`/`8082` si ya están
ocupados - revisar con `docker ps` antes). Generar su propio certificado
(misma IP pública, la del servidor):

```bash
./scripts/generar-certificado-autofirmado.sh 161.18.232.231
```

**Agregar la Redirect URI de staging al App Registration de Azure**
(Authentication → Add a platform/URI): `https://161.18.232.231:53396/auth/callback`
— se usa el mismo App Registration que producción, solo se le suma esta URI
adicional. No afecta el login de producción.

## 3) Levantar

```bash
docker compose up --build -d
docker compose ps   # deben verse *-staging junto a los de produccion, sin chocar
```

Queda en `https://161.18.232.231:53396`. Como `DEV_AUTH_BYPASS=true`, se
puede entrar directo con `/auth/dev-login?email=cualquiera@netmask.co` sin
depender del SSO real mientras se prueba.

## 4) Actualizar staging con los últimos cambios de `develop`

```bash
cd ~/horas-extras-staging
git pull
docker compose up --build -d
```

## 5) Promover a producción

Cuando lo probado en staging ya está listo:
1. Abrir el PR `develop → main` en GitHub y mergearlo.
2. En el checkout de **producción** (`~/horas-extras`, no este):
   ```bash
   cd ~/horas-extras
   git pull
   docker compose up --build -d
   ```

## Notas

- Los dos ambientes comparten el mismo `AZURE_CLIENT_ID`/`AZURE_TENANT_ID`
  (mismo App Registration, dos Redirect URIs) pero tienen su propia base de
  datos — usuarios, horas extra y todo lo demás son independientes entre
  producción y staging.
- `GRAPH_MAIL_FROM` vacío en staging es intencional: evita mandar correos
  reales a líderes/gerencia mientras se prueba. Si algún día se necesita
  probar el envío de correo de verdad, usar un buzón de pruebas aparte, no
  `notificacion@netmask.co`.
- Para borrar staging por completo (no borra producción):
  `docker compose down -v` dentro de `~/horas-extras-staging`.
