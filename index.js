const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const { exec } = require('child_process');
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
let latestQR = null;

const fs = require('fs');
const path = require('path');

// Directorio exclusivo para el perfil del navegador
const userDataDir = '/app/.wwebjs_auth/default';

// Elimina el archivo de bloqueo si quedó colgado
const lockfile = path.join(userDataDir, 'SingletonLock');
if (fs.existsSync(lockfile)) {
  console.warn('Eliminando archivo de bloqueo de Chromium...');
  fs.unlinkSync(lockfile);
}
const client = new Client({
    puppeteer: {
        executablePath:  process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        args: ['--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--user-data-dir=/app/.wwebjs_auth/default', // <--- Directorio exclusivo
            '--remote-debugging-port=9222'               // <--- Evita conflictos internos
        ],
    },
    authStrategy: new LocalAuth({ clientId: 'default' })
});
client.on('ready', () => {
    console.log('Bot listo!');
});

client.on('message_create', async message => {
    //if !sticker --help
    if (message.body === '!sticker --help') {
        message.reply(
            '¡Hola! Soy un bot de stickers.\n' +
            'Uso:\n' +
            '- `!sticker` - Responde a un video o imagen para convertirlo en sticker.\n\n' +
            '- `!sticker <multiplicador>` - Responde a un video o GIF y ajusta la velocidad del sticker (ej: `!sticker 2x`).\n\n' +
            '- `!stickerlink` - Responde a un enlace de Twitter o Instagram para convertirlo en sticker.\n\n' +
            '- `!stickerlink <multiplicador>` - Responde a un enlace de Twitter o Instagram y ajusta la velocidad del sticker (ej: `!stickerlink 2x`).\n\n' +
            '- `!stickerlink --download` - Responde a un enlace de Twitter o Instagram para descargar el video.\n\n' +
            '- `!stickerlink <multiplicador> --download` - Responde a un enlace de Twitter o Instagram y ajusta la velocidad del sticker (ej: `!stickerlink 2x --download`).\n' +
            'Nota: El multiplicador debe ser un número positivo y menor o igual a 10.\n\n' +
            'La duración por defecto del sticker es de 5 segundos.\n' +
            '- `!sticker <multiplicador> -t <duración>` - Responde a un video o GIF y ajusta la velocidad y duración del sticker (ej: `!sticker 2x -t 3`).\n\n' +
            '- `!stickerlink <multiplicador> -t <duración>` - Responde a un enlace de Twitter o Instagram y ajusta la velocidad y duración del sticker (ej: `!stickerlink 2x -t 3`).\n\n' +
            '¡Disfruta creando stickers! \n'
        );
        return;
    }
    // Permite: !sticker [multiplicador] [-t duración]
    // Ejemplo: !sticker 2x -t 3
    const match = message.body.match(/^!sticker(?:\s+(\d+(?:\.\d+)?x))?(?:\s+-t\s+(\d+))?$/i);
    if (match && message.hasQuotedMsg) {
        const speedMultiplier = match[1] ? parseFloat(match[1].replace('x', '')) : 1;
        const duration = match[2] ? parseInt(match[2], 10) : 5; // Duración por defecto de 5 segundos
        if (isNaN(speedMultiplier) || speedMultiplier <= 0 || speedMultiplier > 10) {
            console.warn('❌ El multiplicador debe ser un número positivo y menor o igual a 10:', speedMultiplier);
            message.reply('❌ El multiplicador debe ser un número positivo y menor o igual a 10.');
            return;
        }
        const quotedMsg = await message.getQuotedMessage();
        if (quotedMsg.hasMedia) {
            const media = await quotedMsg.downloadMedia();

            if (!media || !media.mimetype) {
                console.warn('No se pudo obtener el tipo de media o el mimetype:', media);
                message.reply(
                    '⚠️ No pude procesar ese archivo.\nPor favor, reenvía el video o GIF como *documento* y vuelve a intentar con `!sticker`.'
                );
                return;
            }
            const mime = media.mimetype;
            // Si es imagen (png o jpeg)
            if (mime.startsWith('image/')) {
                const ext = mime.split('/')[1];
                const filePath = `./image.${ext}`;
                fs.writeFileSync(filePath, media.data, 'base64');

                const sticker = MessageMedia.fromFilePath(filePath);
                await message.reply(sticker, undefined, { sendMediaAsSticker: true });

                fs.unlinkSync(filePath);
                return;
            }

            // Si es gif o video
            if (mime.includes('gif') || mime.includes('video')) {
                const extension = mime.includes('gif') ? '.gif' : '.mp4';
                const inputPath = './input' + extension;
                const outputPath = './sticker.webp';
                fs.writeFileSync(inputPath, media.data, 'base64');
                const speedFilter = `setpts=${1 / speedMultiplier}*PTS`;
                ffmpeg(inputPath)
                    .outputOptions([
                        '-vcodec libwebp',
                        `-vf scale=512:512:force_original_aspect_ratio=increase,crop=480:480,${speedFilter},fps=15`,
                        '-loop 0',
                        '-ss 0',
                        `-t ${duration}`, // Duración del sticker
                        '-preset default',
                        `-qscale 30`,
                        '-an',
                        '-vsync 0'
                    ])
                    .output(outputPath)
                    .on('end', () => {
                        const stats = fs.statSync(outputPath);
                        if (stats.size > 1024 * 1024) { // Mayor a 1 MB
                            console.warn('⚠️ El sticker es demasiado grande:', stats.size / 1024, 'KB');
                            message.reply('El sticker es demasiado grande. Probá con un video o GIF más corto.');
                            fs.unlinkSync(outputPath);
                            fs.unlinkSync(inputPath);
                            return;
                        }
                        const sticker = MessageMedia.fromFilePath(outputPath);
                        message.reply(sticker, undefined, { sendMediaAsSticker: true });
                        fs.unlinkSync(inputPath);
                        fs.unlinkSync(outputPath);
                    })
                    .on('error', err => {
                        console.error('❌ Error al convertir:', err);
                        message.reply('Hubo un error al generar el sticker.');
                    })
                    .run();
            } else {
                message.reply('📄 Tipo de archivo no soportado para stickers.');
            }
        } else {
            message.reply('Responde a un video o gif con !sticker');
        }
    }
    // Permite: !stickerlink [multiplicador] [-t duración] [--download]
    // Ejemplo: !stickerlink 2x -t 3 --download
    const matchLink = message.body.match(/^!stickerlink(?:\s+(\d+(?:\.\d+)?x))?(?:\s+-t\s+(\d+))?(?:\s+--download)?$/i);
    const wantsDownload = message.body.includes('--download');
    if (matchLink && message.hasQuotedMsg) {
        const speedMultiplier = matchLink[1] ? parseFloat(matchLink[1].replace('x', '')) : 1;
        const duration = matchLink[2] ? parseInt(matchLink[2], 10) : 5; // Duración por defecto de 5 segundos
        if (isNaN(speedMultiplier) || speedMultiplier <= 0 || speedMultiplier > 10) {
            console.warn('❌ El multiplicador debe ser un número positivo y menor o igual a 10:', speedMultiplier);
            message.reply('❌ El multiplicador debe ser un número positivo y menor o igual a 10.');
            return;
        }
        const quotedMsg = await message.getQuotedMessage();
        const url = quotedMsg.body.trim();

        if (!url.startsWith('http')) {
            message.reply('❌ El mensaje citado no parece tener un enlace válido.');
            return;
        }

        // Validar si es URL de Twitter o Instagram
        const isTwitter = url.includes('x.com');
        const isInstagram = url.includes('instagram.com') || url.includes('instagr.am');

        if (!isTwitter && !isInstagram) {
            message.reply('❌ Solo puedo procesar enlaces de Twitter o Instagram.');
            return;
        }

        const inputPath = './downloaded.mp4';
        const outputPath = './sticker.webp';

        if (wantsDownload) {
            descargarVideo(url, message, speedMultiplier);
            return;
        }

        exec(`yt-dlp -f mp4 "${url}" -o "${inputPath}"`, (err, stdout, stderr) => {
            if (err) {
                console.error('❌ yt-dlp error:', err);
                message.reply('❌ No pude descargar el video. ¿Es un enlace público y válido de Twitter o Instagram?');
                return;
            }
            const speedFilter = `setpts=${1 / speedMultiplier}*PTS`;
            ffmpeg(inputPath)
                .outputOptions([
                    '-vcodec libwebp',
                    `-vf scale=512:512:force_original_aspect_ratio=increase,crop=480:480,${speedFilter},fps=15`,
                    '-loop 0',
                    '-ss 0',
                    '-t ' + duration, // Duración del sticker
                    '-preset default',
                    `-qscale 30`,
                    '-an',
                    '-vsync 0'
                ])
                .output(outputPath)
                .on('end', () => {
                    const stats = fs.statSync(outputPath);
                    if (stats.size > 1024 * 1024) {
                        message.reply('⚠️ El sticker generado es demasiado grande. Probá con otro video.');
                        fs.unlinkSync(inputPath);
                        fs.unlinkSync(outputPath);
                        return;
                    }

                    const sticker = MessageMedia.fromFilePath(outputPath);
                    message.reply(sticker, undefined, { sendMediaAsSticker: true });

                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                })
                .on('error', err => {
                    console.error('❌ Error al convertir a sticker:', err);
                    message.reply('Hubo un error al generar el sticker.');
                })
                .run();
        });
    }

});
client.on('qr', (qr) => {
    console.log('QR recibido');
    latestQR = qr;
});

app.get('/', async (req, res) => {
    if (!latestQR) {
        return res.send('<h2>Esperando QR...</h2>');
    }
    const qrImage = await qrcode.toDataURL(latestQR, { errorCorrectionLevel: 'H' });
    res.send(`
    <html>
      <body style="text-align: center; font-family: sans-serif;">
        <h2>Escanea este QR para iniciar sesión</h2>
        <img src="${qrImage}" alt="QR de WhatsApp"/>
      </body>
    </html>
  `);
});

app.listen(3000, () => {
    console.log('QR disponible en http://localhost:3000');
});

function descargarVideo(url, message, speedMultiplier) {
    function buildAtempoFilters(speed) {
        const filters = [];
        while (speed > 2.0) {
            filters.push("2.0");
            speed /= 2.0;
        }
        while (speed < 0.5) {
            filters.push("0.5");
            speed /= 0.5;
        }
        filters.push(speed.toFixed(2));
        return filters.join(',');
    }
    const inputPath = './d.mp4';
    const outputPath = './video.mp4';
    console.log('Descargando video de:', url);
    try {
        exec(`yt-dlp -f mp4 "${url}" -o "${inputPath}"`, (err) => {
            if (err) {
                message.reply('❌ No pude descargar el video.');
                return;
            }
            ffmpeg(inputPath)
                .outputOptions([
                    `-vf setpts=${1 / speedMultiplier}*PTS`,
                    `-filter:a atempo=${buildAtempoFilters(speedMultiplier)}`
                ])
                .output(outputPath)
                .on('end', () => {

                    const video = MessageMedia.fromFilePath(outputPath);
                    message.reply(video);

                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                })
                .on('error', err => {
                    console.error('❌ Error al convertir a sticker:', err);
                    message.reply('Hubo un error al generar el sticker.');
                })
                .run();

        });
    } catch (error) {
        console.log('Error al descargar el video:', error);
    }

}

client.initialize();