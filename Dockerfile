FROM node:22

# Instala dependencias necesarias
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    curl \
    python3 \
    python3-pip \
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
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Instalación de yt-dlp
RUN pip3 install --no-cache-dir yt-dlp

# Symlink para Puppeteer (opcional)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Crea carpeta de trabajo
WORKDIR /app

# Copia el código fuente al contenedor
COPY . .

# Instala dependencias Node.js
RUN npm install

# Expone el puerto 3000 para QR o interfaz web
EXPOSE 3000

# Comando por defecto al iniciar el contenedor
CMD ["npm", "start"]