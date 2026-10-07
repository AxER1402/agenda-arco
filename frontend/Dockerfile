# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# --- Desarrollo (el que usa docker-compose): servidor de Vite con recarga ---
FROM base AS development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# --- Compilación de la SPA --------------------------------------------------
FROM base AS build
ENV NODE_ENV=production
# Vite y el resto de herramientas de compilación son devDependencies, y con
# NODE_ENV=production npm ci las salta: hay que pedirlas expresamente.
RUN npm ci --include=dev
COPY . .
# La URL de la API se incrusta en el bundle en tiempo de compilación.
ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Producción: archivos estáticos servidos por nginx ----------------------
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
