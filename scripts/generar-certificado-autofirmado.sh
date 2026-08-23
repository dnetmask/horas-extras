#!/bin/sh
# Genera un certificado TLS autofirmado para publicar la app por IP publica
# (sin dominio). Requiere openssl.
#
# Uso: ./scripts/generar-certificado-autofirmado.sh <ip-publica> [dias_validez]
#
# IMPORTANTE: el certificado incluye la IP como Subject Alternative Name
# (SAN) - sin esto, navegadores modernos (Chrome/Edge) rechazan el
# certificado por completo (no basta con el Common Name).
set -e

IP="$1"
DIAS="${2:-397}" # Chrome/Safari rechazan certificados con vigencia mayor a ~398 dias

if [ -z "$IP" ]; then
  echo "Uso: $0 <ip-publica> [dias_validez]" >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$DIR"

# MSYS2_ARG_CONV_EXCL evita que Git Bash en Windows "corrija" el -subj (que
# empieza con "/") convirtiendolo en una ruta de archivo, sin afectar la
# conversion normal de -keyout/-out (que si necesitan convertirse a ruta de
# Windows). En Linux/Mac esta variable simplemente no existe y no tiene efecto.
MSYS2_ARG_CONV_EXCL="/CN=" openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$DIR/privkey.pem" \
  -out "$DIR/fullchain.pem" \
  -days "$DIAS" \
  -subj "/CN=$IP/O=Netmask SAS/OU=Horas Extra" \
  -addext "subjectAltName=IP:$IP"

echo "Certificado generado en $DIR (valido $DIAS dias para IP=$IP)."
echo "Recuerda: certs/ esta en .gitignore - nunca subir la clave privada a git."
