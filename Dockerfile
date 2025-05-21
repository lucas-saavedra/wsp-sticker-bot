FROM node:22

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm-dev \
    libxshmfence1 \
    xdg-utils \
    ffmpeg \
    chromium \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Crear un virtualenv para yt-dlp y activar
RUN python3 -m venv /opt/yt-dlp-venv && \
    /opt/yt-dlp-venv/bin/pip install --no-cache-dir --upgrade pip yt-dlp

# Añadir yt-dlp al PATH
ENV PATH="/opt/yt-dlp-venv/bin:$PATH"

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 3000

CMD ["npm", "start"]
