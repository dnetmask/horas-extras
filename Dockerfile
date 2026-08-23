FROM node:20-alpine

# Prisma necesita OpenSSL para su motor de consultas; node:20-alpine no lo trae por defecto.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate

COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 8090

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
