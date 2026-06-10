# ── KisaanConnect — Production Dockerfile ─────────────────────────────────
# Used by Render when deploying as a Docker container (optional).
# Render can also auto-detect Node.js without Docker — render.yaml handles that.

FROM node:18-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package files first (Docker layer caching)
COPY package*.json ./

# Install ONLY production dependencies
RUN npm install --only=production

# Copy all source files
COPY server.js ./
COPY firebase-db.js ./
COPY otp-mailer.js ./
COPY kisaan-network.js ./
COPY env-config.js ./
COPY build-env.js ./

# Copy HTML/Frontend files
COPY *.html ./

# Copy static assets
COPY logo.png ./
COPY fruits.png ./
COPY veggies.png ./
COPY farmer-mascot.svg ./
COPY manifest.json ./
COPY sw.js ./

# Create uploads directory (for user-uploaded files)
RUN mkdir -p ./uploads

# Expose port (Render sets PORT env var automatically)
EXPOSE 3000

# Health check — Render uses this to verify the container is healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT||3000) + '/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "server.js"]
