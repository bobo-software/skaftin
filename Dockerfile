# Stage 1: Build Stage (Uses full Alpine with required build tools)
FROM node:22-alpine AS builder

# Install dependencies for native modules (bcrypt, mysql2, etc.)
RUN apk add --no-cache python3 g++ make

WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install all dependencies, including devDependencies for TypeScript
RUN npm install

# Copy the rest of the source code
COPY . .

# Build TypeScript project
RUN npx tsc

# Stage 2: Production Stage (Uses a minimal Alpine image)
FROM node:22-alpine

WORKDIR /app

# Copy only built files and production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 4006

# Run the server
CMD ["node", "dist/Server.js"]
