FROM node:22

# Instalar dependencias necesarias
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

# Crear enlace simbólico para chromium-browser (requerido por Puppeteer)
RUN ln -s /usr/bin/chromium /usr/bin/chromium-browser || true

# Crear entorno virtual para yt-dlp e instalarlo
RUN python3 -m venv /opt/yt-dlp-venv && \
    /opt/yt-dlp-venv/bin/pip install --no-cache-dir --upgrade pip yt-dlp

# Añadir yt-dlp al PATH
ENV PATH="/opt/yt-dlp-venv/bin:$PATH"

# Configurar Puppeteer para no descargar Chromium y usar el instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crear carpeta de trabajo
WORKDIR /app

# Copiar código fuente
COPY . .

# Instalar dependencias Node.js
RUN npm install

# Exponer puerto (ejemplo: 3000)
EXPOSE 3000

# Comando por defecto
CMD ["npm", "start"]
