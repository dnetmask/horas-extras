Certificado TLS que usa nginx (`docker-compose.yml`) para publicar la app.

Generar con:

```bash
./scripts/generar-certificado-autofirmado.sh <ip-publica>
```

Esto crea `fullchain.pem` y `privkey.pem` en esta carpeta. **Ninguno de los
dos se sube a git** (`.gitignore` los excluye) - son credenciales del
servidor donde se despliegue, no del repositorio.
