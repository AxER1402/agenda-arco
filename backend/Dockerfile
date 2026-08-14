# syntax=docker/dockerfile:1

# --- Base compartida --------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./

# --- Desarrollo (el que usa docker-compose) --------------------------------
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- Producción -------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY . .
# No ejecutar como root.
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
