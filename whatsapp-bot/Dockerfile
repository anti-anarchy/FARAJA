FROM node:20-slim

# Tell Puppeteer not to download its own Chromium — we use the system one
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install Chromium and the shared libraries it needs for headless operation
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./

# Persist WhatsApp session across container restarts via a named volume
RUN mkdir -p /app/.wwebjs_auth

EXPOSE 3001

CMD ["node", "index.js"]
