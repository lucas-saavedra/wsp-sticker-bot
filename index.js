const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot listo!');
});

client.on('message_create', async message => {

    if (message.body === '!sticker' && message.hasQuotedMsg) {
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
            console.log('MIME:', mime);

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

                ffmpeg(inputPath)
                    .outputOptions([
                        '-vcodec libwebp',
                        '-vf scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=15',
                        '-loop 0',
                        '-ss 0',
                        '-t 5',
                        '-preset default',
                        '-an',
                        '-vsync 0'
                    ])
                    .output(outputPath)
                    .on('end', () => {
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
client.initialize();