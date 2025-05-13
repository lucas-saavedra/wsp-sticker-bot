const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
let latestQR = null;
const client = new Client({
    /*   puppeteer: {
          executablePath: '/usr/bin/chromium-browser',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }, */
    authStrategy: new LocalAuth()
});

client.on('ready', () => {
    console.log('Bot listo!');
});

client.on('message_create', async message => {
    const match = message.body.match(/^!sticker(?:\s+(\d+(?:\.\d+)?x))?$/i);
    if (match && message.hasQuotedMsg) {
        const speedMultiplier = match[1] ? parseFloat(match[1].replace('x', '')) : 1;
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
                        '-t 5',
                        '-preset default',
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
client.initialize();