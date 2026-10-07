# syntax=docker/dockerfile:1
#
# whatsapp-web.js controla un Chromium real mediante Puppeteer, por eso esta
# imagen es distinta a la del backend: necesita el navegador y sus librerías.
# Se instala el Chromium del sistema y se le indica a Puppeteer que no descargue
# el suyo (la descarga no tiene build para todas las arquitecturas).

FROM node:20-bookworm-slim AS base

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libnss3 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
# El postinstall parchea whatsapp-web.js: el script tiene que estar antes de
# instalar.
COPY scripts ./scripts

# --- Desarrollo -------------------------------------------------------------
FROM base AS development
RUN npm install
COPY . .
# La sesión vinculada se guarda en un volumen para no tener que escanear el QR
# cada vez que se reinicia el contenedor.
RUN mkdir -p /app/session && chown -R node:node /app
USER node
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]

# --- Producción -------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/session && chown -R node:node /app
USER node
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
