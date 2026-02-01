import express from 'express';
import { readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECORDINGS_DIR = join(__dirname, '../radiko-recorder/recordings');
const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || `http://localhost:${PORT}`;

const app = express();

// Show metadata (customize as needed)
const SHOWS = {
  audrey: { title: 'オードリーのオールナイトニッポン', author: 'ニッポン放送' },
  audrey_classic: { title: 'オードリー 2009-2012 傑作トーク', author: 'ニッポン放送' },
  bananamoon: { title: 'バナナムーンGOLD', author: 'TBSラジオ' },
  shimohuriann: { title: '霜降り明星のオールナイトニッポン', author: 'ニッポン放送' },
  shimofuri_damashiuchi: { title: '霜降り明星のだましうち！', author: 'MBSラジオ' },
  milkboy: { title: 'ミルクボーイの煩悩の塊', author: 'ABCラジオ' },
  haraichi: { title: 'ハライチのターン', author: 'TBSラジオ' },
  fuwachan: { title: 'フワちゃんのオールナイトニッポン0', author: 'ニッポン放送' },
  yoshioka: { title: 'UR LIFESTYLE COLLEGE', author: 'J-WAVE' },
  hinatazaka: { title: '日向坂46の「ひ」', author: 'ニッポン放送' },
  hoshinogen: { title: '星野源のオールナイトニッポン', author: 'ニッポン放送' },
  ichinose: { title: 'DRAMA QUEEN', author: '市野瀬瞳' },
};

// Serve audio files
app.use('/audio', express.static(RECORDINGS_DIR));

// List all shows
app.get('/', async (req, res) => {
  try {
    const entries = await readdir(RECORDINGS_DIR, { withFileTypes: true });
    const shows = entries.filter(e => e.isDirectory()).map(e => e.name);

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Private Podcast</title></head>
<body>
<h1>Private Podcast Feeds</h1>
<ul>
${shows.map(show => `<li>
  <strong>${SHOWS[show]?.title || show}</strong><br>
  <a href="/feed/${show}">RSS Feed</a> |
  <code>${HOST}/feed/${show}</code>
</li>`).join('\n')}
</ul>
<p>Copy the RSS feed URL to your podcast app (Apple Podcasts, Pocket Casts, Overcast, etc.)</p>
</body></html>`;

    res.type('html').send(html);
  } catch (err) {
    res.status(500).send('Error reading recordings directory');
  }
});

// Generate RSS feed for a show
app.get('/feed/:show', async (req, res) => {
  const { show } = req.params;
  const showDir = join(RECORDINGS_DIR, show);

  try {
    const files = await readdir(showDir);
    const audioFiles = files.filter(f => f.endsWith('.m4a') || f.endsWith('.mp3'));

    // Get file stats for dates and sizes
    const episodes = await Promise.all(
      audioFiles.map(async (file) => {
        const filePath = join(showDir, file);
        const stats = await stat(filePath);
        const dateMatch = file.match(/(\d{8})/);
        const date = dateMatch
          ? new Date(dateMatch[1].slice(0,4), dateMatch[1].slice(4,6)-1, dateMatch[1].slice(6,8))
          : stats.mtime;
        return { file, date, size: stats.size };
      })
    );

    // Sort by date descending
    episodes.sort((a, b) => b.date - a.date);

    const showMeta = SHOWS[show] || { title: show, author: 'Unknown' };

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>${escapeXml(showMeta.title)}</title>
  <link>${HOST}/feed/${show}</link>
  <description>${escapeXml(showMeta.title)} - Private Podcast Feed</description>
  <language>ja</language>
  <itunes:author>${escapeXml(showMeta.author)}</itunes:author>
  <itunes:explicit>false</itunes:explicit>
${episodes.map(ep => {
    const y = ep.date.getFullYear();
    const m = ep.date.getMonth() + 1;
    const d = ep.date.getDate();
    const dateStr = `${y}年${m}月${d}日放送`;
    return `  <item>
    <title>${escapeXml(showMeta.title)} ${dateStr}</title>
    <enclosure url="${HOST}/audio/${show}/${encodeURIComponent(ep.file)}" length="${ep.size}" type="audio/mp4"/>
    <pubDate>${ep.date.toUTCString()}</pubDate>
    <guid>${HOST}/audio/${show}/${encodeURIComponent(ep.file)}</guid>
  </item>`;
  }).join('\n')}
</channel>
</rss>`;

    res.type('application/rss+xml').send(rss);
  } catch (err) {
    res.status(404).send('Show not found');
  }
});

function escapeXml(str) {
  return str.replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c]));
}

app.listen(PORT, () => {
  console.log(`Podcast server running at ${HOST}`);
  console.log(`Serving recordings from: ${RECORDINGS_DIR}`);
});
