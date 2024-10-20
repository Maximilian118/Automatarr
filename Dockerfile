FROM node:18-bullseye-slim

# Install necessary packages for mongodb-memory-server
RUN apt-get update && apt-get install -y \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Set working directory for the application
WORKDIR /app

# Install concurrently to run both servers simultaneously
RUN npm install -g concurrently

# --------------------
# Build Frontend (Vite)
# --------------------
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

# --------------------
# Build Backend (Express/GraphQL)
# --------------------
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend ./
RUN npm run build

# --------------------
# Expose necessary ports
# --------------------
# Frontend (Vite)
EXPOSE 8090
# Backend (GraphQL/Express)
EXPOSE 8091

# --------------------
# Run both Frontend and Backend with concurrently
# --------------------
CMD concurrently \
  "npm run --prefix /app/frontend start" \
  "node /app/backend/dist/app.js"
