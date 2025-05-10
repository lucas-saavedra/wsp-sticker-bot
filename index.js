const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot listo!');
});

client.on('message', async message => {
    if (message.body === '!sticker' && message.hasQuotedMsg) {
        const quotedMsg = await message.getQuotedMessage();

        if (quotedMsg.hasMedia) {
            const media = await quotedMsg.downloadMedia();
            const mime = media.mimetype;

            const extension = mime.includes('gif') ? '.gif' : '.mp4';
            const inputPath = './input' + extension;
            const outputPath = './sticker.webp';

            fs.writeFileSync(inputPath, media.data, 'base64');

            ffmpeg(inputPath)
                .outputOptions([
                    '-vcodec libwebp',
                    '-vf scale=512:512:force_original_aspect_ratio=decrease,fps=15',
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
                    console.error('Error al convertir:', err);
                    message.reply('Hubo un error al generar el sticker.');
                })
                .run();
        } else {
            message.reply('Responde a un video o gif con !sticker');
        }
    }
});
client.initialize();