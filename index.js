const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ytdl = require('ytdl-core');
const axios = require('axios');
const TiktokDownloader = require('downloadtiktok');
const { pipeline } = require('stream/promises');

const app = express();
app.use(bodyParser.json());

const TOKEN = '7552419100:AAEih_b7hX4hHoNv_f1iAP-IAoIIOKJTmGE';
const HEROKU_URL = 'https://js-video-getter-e5daa3254ae5.herokuapp.com:443';

const port = Number(process.env.PORT) || 3000;
const bot = new TelegramBot(TOKEN, { webHook: { port } });

bot.setWebHook(`${HEROKU_URL}/bot${TOKEN}`);

// Function to download YouTube videos
async function downloadYouTubeVideo(url, outputFile) {
  return new Promise((resolve, reject) => {
    ytdl(url, { quality: 'highest' })
      .pipe(fs.createWriteStream(outputFile))
      .on('finish', () => resolve(outputFile))
      .on('error', reject);
  });
}

// Function to download TikTok videos
async function downloadTikTokVideo(url, outputFile) {
  try {
    const result = await TiktokDownloader.downloadTiktok(url);
    const videoList = TiktokDownloader.filterNoWatermark(result.medias);
    
    if (videoList && videoList.length > 0) {
      const bestVideo = videoList[0]; // Get the first no watermark video
      const videoBuffer = await TiktokDownloader.getBufferFromURL(bestVideo.url);
      fs.writeFileSync(outputFile, videoBuffer);
      return outputFile;
    }
    throw new Error('No TikTok videos found');
  } catch (error) {
    console.error('TikTok download error:', error);
    throw error;
  }
}

// Function to download Instagram videos (simplified - needs more implementation)
async function downloadInstagramVideo(url, outputFile) {
  try {
    // This is a simplified approach - Instagram has complex protection mechanisms
    // You might need to use a more robust library or service
    // For now, we'll try a basic approach to download direct video links
    const response = await axios.get(url);
    const html = response.data;
    
    // Try to extract video URL from Instagram page
    const videoUrlMatch = html.match(/"video_url":"([^"]+)"/);
    if (videoUrlMatch && videoUrlMatch[1]) {
      const videoUrl = videoUrlMatch[1].replace(/\\u0026/g, '&');
      
      // Download the video
      const videoResponse = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream'
      });
      
      await pipeline(videoResponse.data, fs.createWriteStream(outputFile));
      return outputFile;
    }
    
    throw new Error('Could not extract Instagram video URL');
  } catch (error) {
    console.error('Instagram download error:', error);
    throw error;
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const supportedDomains = ['youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com'];
  
  if (!text || !supportedDomains.some(domain => text.toLowerCase().includes(domain))) {
    return;
  }

  bot.sendMessage(chatId, 'Качаю, чекай блять!');

  try {
    const outputFile = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);
    let downloadedFile;

    // Determine which platform and download accordingly
    if (text.includes('youtube.com') || text.includes('youtu.be')) {
      downloadedFile = await downloadYouTubeVideo(text, outputFile);
    } else if (text.includes('tiktok.com')) {
      downloadedFile = await downloadTikTokVideo(text, outputFile);
    } else if (text.includes('instagram.com')) {
      downloadedFile = await downloadInstagramVideo(text, outputFile);
    }

    // Send the video to the user
    await bot.sendVideo(chatId, downloadedFile);
    
    // Delete the file after sending
    fs.unlink(downloadedFile, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
  } catch (error) {
    console.error('Error downloading or sending video:', error);
    bot.sendMessage(chatId, 'Кіна не буде, блять! Якась хуйня сталась');
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
