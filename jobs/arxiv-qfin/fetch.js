const Parser = require('rss-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DATA_DIR = path.join(__dirname, 'data');
const RSS_URL = 'https://rss.arxiv.org/rss/q-fin';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function extractArxivId(link) {
  // Extract ID from URLs like https://arxiv.org/abs/2601.22119v1
  const match = link.match(/arxiv\.org\/abs\/(\d+\.\d+(?:v\d+)?)/);
  return match ? match[1] : null;
}

async function downloadFile(url, filepath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  await fs.writeFile(filepath, Buffer.from(buffer));
}

async function withRetry(fn, maxRetries = 3, baseDelay = 45000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.message.includes('429') && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`  [RETRY] Rate limited, waiting ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

async function convertPdfToMarkdown(pdfPath, title) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  const pdfData = await fs.readFile(pdfPath);
  const base64Pdf = pdfData.toString('base64');

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Pdf
      }
    },
    {
      text: `Convert this arXiv paper to clean, well-formatted markdown.

Requirements:
- Keep the title, authors, abstract, and all sections
- Preserve mathematical notation using LaTeX ($ for inline, $$ for block)
- Keep figures with their captions (describe them if images can't be embedded)
- Format references properly
- Make it readable and well-structured

Paper title: ${title}`
    }
  ]);
  return result.response.text();
}

async function processPaper(arxivId, title) {
  const paperDir = path.join(DATA_DIR, arxivId);

  // Check if already processed
  try {
    await fs.access(path.join(paperDir, 'paper.md'));
    console.log(`[SKIP] ${arxivId} - already processed`);
    return false;
  } catch {
    // Not processed yet, continue
  }

  console.log(`[PROCESSING] ${arxivId}: ${title}`);
  await fs.mkdir(paperDir, { recursive: true });

  // Download PDF
  const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
  const pdfPath = path.join(paperDir, 'paper.pdf');
  try {
    await downloadFile(pdfUrl, pdfPath);
    console.log(`  [OK] Downloaded PDF`);
  } catch (err) {
    console.log(`  [ERROR] PDF download failed: ${err.message}`);
    return false;
  }

  // Convert PDF to markdown with retry
  if (process.env.GEMINI_API_KEY) {
    try {
      const markdown = await withRetry(() => convertPdfToMarkdown(pdfPath, title));
      await fs.writeFile(path.join(paperDir, 'paper.md'), markdown, 'utf-8');
      console.log(`  [OK] Converted to markdown`);
    } catch (err) {
      console.log(`  [ERROR] Markdown conversion failed: ${err.message}`);
    }
  }

  return true;
}

async function main() {
  console.log(`[START] Fetching arXiv q-fin RSS feed...`);

  const parser = new Parser();
  const feed = await parser.parseURL(RSS_URL);

  console.log(`[INFO] Found ${feed.items.length} papers in feed`);

  let processed = 0;
  let skipped = 0;

  for (const item of feed.items) {
    const arxivId = await extractArxivId(item.link);
    if (!arxivId) {
      console.log(`[WARN] Could not extract ID from: ${item.link}`);
      continue;
    }

    const wasProcessed = await processPaper(arxivId, item.title);
    if (wasProcessed) {
      processed++;
      // Rate limit to avoid overwhelming arXiv/Gemini
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      skipped++;
    }
  }

  console.log(`[DONE] Processed: ${processed}, Skipped: ${skipped}`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
