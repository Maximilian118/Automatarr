# ----------------------------
# Base image (for build and runtime)
# ----------------------------
FROM node:18-bullseye-slim AS base

# Install required system dependencies for mongodb-memory-server + serve
RUN apt-get update && apt-get install -y \
  curl \
  libcurl4 \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ----------------------------
# Frontend Build Stage
# ----------------------------
FROM base AS frontend-build

WORKDIR /app/frontend

# Install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source and build
COPY frontend ./
RUN npm run build

# ----------------------------
# Backend Build Stage
# ----------------------------
FROM base AS backend-build

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend ./
RUN npm run build

# ----------------------------
# Runtime Stage
# ----------------------------
FROM base AS runtime

WORKDIR /app

# Install tools
RUN npm install -g concurrently serve

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY --from=frontend-build /app/frontend/package*.json ./frontend/

# Copy built backend
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package*.json ./backend/

# Install frontend prod deps
WORKDIR /app/frontend
RUN npm install --omit=dev

# Install backend prod deps
WORKDIR /app/backend
RUN npm install --omit=dev

# Expose ports
EXPOSE 8090
EXPOSE 8091

# Start both services
CMD ["concurrently", \
  "serve -s /app/frontend/dist -l 8090 > /dev/null 2>&1", \
  "npm run --prefix /app/backend start:prod"]
