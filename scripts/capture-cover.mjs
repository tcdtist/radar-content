import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getExecutablePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  switch (process.platform) {
    case 'darwin':
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    case 'linux':
      return '/usr/bin/google-chrome';
    case 'win32':
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    default:
      throw new Error(`Unsupported platform: ${process.platform}. Please set CHROME_PATH env var.`);
  }
}

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:5173';
const OUTPUT_PATH = path.resolve(__dirname, '../assets/cover.png');

async function captureCover() {
  const executablePath = getExecutablePath();

  if (!fs.existsSync(executablePath)) {
    console.error(`❌ Chrome binary not found at: ${executablePath}. Please set CHROME_PATH.`);
    process.exit(1);
  }

  console.log('🚀 Launching Chrome to capture web app dark theme screenshot...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,900',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  try {
    console.log(`Navigating to ${TARGET_URL}...`);
    // Pre-set localStorage to dark mode before navigating
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('theme', 'dark');
    });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for intelligence cards to load
    console.log('Waiting for intelligence cards to render...');
    await page.waitForSelector('[data-testid="intelligence-card"]', { timeout: 25000 });

    // Ensure dark class on html root and fonts are loaded
    await page.evaluate(() => {
      document.documentElement.className = 'dark';
    });
    await page.evaluate(() => document.fonts?.ready);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log(`Taking screenshot to ${OUTPUT_PATH}...`);
    await page.screenshot({
      path: OUTPUT_PATH,
      type: 'png',
    });

    console.log('✨ Screenshot saved successfully to assets/cover.png');
  } catch (err) {
    console.error('Failed to capture cover:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

captureCover();
