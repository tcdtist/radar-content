import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = 'http://localhost:3000';
const OUT_PATH = path.resolve('assets/screenshots/footer-and-notice-preview.png');

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 1100 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('footer', { timeout: 10000 });
    
    // Scroll down to the bottom to see teaser text notice and footer
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.screenshot({ path: OUT_PATH });
    console.log(`📸 Saved screenshot to ${OUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
