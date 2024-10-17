# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the container
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the project files to the container
COPY . .

# Build the project
RUN npm run build

# Expose the port on which the app will run (if using Vite dev server)
EXPOSE 8090

# Command to start the app
CMD ["npm", "run", "dev"]
