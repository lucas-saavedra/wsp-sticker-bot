#!/bin/bash
set -e

# Limpiar lock de Chromium
rm -rf /root/.config/chromium/Singleton*

# Ejecutar el comando por defecto (npm start)
exec "$@"
