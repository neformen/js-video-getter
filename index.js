const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(bodyParser.json());

const TOKEN = '7552419100:AAEih_b7hX4hHoNv_f1iAP-IAoIIOKJTmGE';
const HEROKU_URL = 'https://e68e-194-88-152-40.ngrok-free.app';
const webhookPath = '/webhook';

const bot = new TelegramBot(TOKEN);

bot.deleteWebHook()
  .then(() => bot.setWebHook(`${HEROKU_URL}${webhookPath}`))
  .then(() => {
    return bot.getWebHookInfo();
  })
  .catch(err => {
    console.error('Error setting webhook:', err);
  });

app.post(webhookPath, (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("Error processing update:", err);
    res.sendStatus(500);
  }
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const supportedDomains = ['youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com'];
  
  if (!text || !supportedDomains.some(domain => text.toLowerCase().includes(domain))) {
    return;
  }

  bot.sendMessage(chatId, 'Качаю, чекай блять!');

  const outputFile = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);

  const downloader = spawn('yt-dlp', ['-f', 'mp4', '-o', outputFile, text]);

  downloader.on('error', (err) => {
    console.error('Error starting yt-dlp:', err);
    bot.sendMessage(chatId, 'Кіна не буде, блять! Якась хуйня сталась');
  });

  downloader.stderr.on('data', (data) => {
    console.error(`yt-dlp error: ${data}`);
  });

  downloader.on('close', (code) => {
    if (code === 0) {
      bot.sendVideo(chatId, outputFile)
        .then(() => {
          fs.unlink(outputFile, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        })
        .catch((err) => {
          console.error('Error sending video:', err);
          bot.sendMessage(chatId, 'Кіна не буде, блять! Якась хуйня сталась');
        });
    } else {
      console.error(`yt-dlp process exited with code ${code}`);
      bot.sendMessage(chatId, 'Кіна не буде, блять! Якась хуйня сталась');
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

dsadas