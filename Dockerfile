FROM node:18-alpine

# Set the working directory for the frontend
WORKDIR /app/frontend

# Copy frontend package.json and package-lock.json to the container
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy the rest of the frontend files to the container
COPY frontend ./

# Build the frontend project
RUN npm run build

# Set the working directory for the backend
WORKDIR /app/backend

# Copy backend package.json and package-lock.json to the container
COPY backend/package*.json ./

# Install backend dependencies
RUN npm install

# Copy the rest of the backend files to the container
COPY backend ./

# Build the backend TypeScript files (you might want to add a build step here if you have it)
RUN npm run build

# Expose the ports for frontend and backend
EXPOSE 8090
EXPOSE 8091

# Command to start the backend application
CMD ["node", "dist/app.js"]
