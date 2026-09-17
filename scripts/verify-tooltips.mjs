import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const LOCAL_SCREENSHOTS_DIR = path.resolve('assets/screenshots');
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || '';

async function saveScreenshot(page, filename) {
  if (!fs.existsSync(LOCAL_SCREENSHOTS_DIR)) {
    fs.mkdirSync(LOCAL_SCREENSHOTS_DIR, { recursive: true });
  }
  const localPath = path.join(LOCAL_SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  if (ARTIFACTS_DIR && fs.existsSync(ARTIFACTS_DIR)) {
    try {
      fs.copyFileSync(localPath, path.join(ARTIFACTS_DIR, filename));
    } catch {}
  }
  console.log(`[Screenshot] Saved ${filename}`);
}

async function runIconTitleVerification() {
  console.log('=== Verifying Clean Icon-Only Titles (Zero Spam) ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1380, height: 980 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    console.log('[Step 1] Loading dashboard at ' + TARGET_URL);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.base-card', { timeout: 8000 });

    // 1. Verify Icon-Only Buttons have clear titles
    const starTitle = await page.$eval('[data-testid="btn-action-save"]', el => el.getAttribute('title'));
    console.log(`  ✓ Star Icon Button title: "${starTitle}"`);
    if (!starTitle) throw new Error('Star button missing title');

    const writtenTitle = await page.$eval('[data-testid="btn-action-written"]', el => el.getAttribute('title'));
    console.log(`  ✓ Written Icon Button title: "${writtenTitle}"`);
    if (!writtenTitle) throw new Error('Written button missing title');

    const trashTitle = await page.$eval('[data-testid="btn-action-dismiss"]', el => el.getAttribute('title'));
    console.log(`  ✓ Trash Icon Button title: "${trashTitle}"`);
    if (!trashTitle) throw new Error('Trash button missing title');

    // 2. Open drawer and verify Close Icon Button has title
    await page.click('[data-testid="btn-inspect"]');
    await page.waitForSelector('.drawer-panel', { timeout: 5000 });
    const closeTitle = await page.$eval('[data-testid="btn-close-drawer"]', el => el.getAttribute('title'));
    console.log(`  ✓ Drawer Close Icon Button title: "${closeTitle}"`);
    if (!closeTitle) throw new Error('Drawer Close button missing title');
    await page.$eval('[data-testid="btn-close-drawer"]', el => el.click());
    await new Promise(r => setTimeout(r, 400));

    // 3. Verify Text Buttons DO NOT have spammy title attributes
    const inspectTitle = await page.$eval('[data-testid="btn-inspect"]', el => el.getAttribute('title'));
    const ingestTitle = await page.$eval('#btn-trigger-crawl', el => el.getAttribute('title'));
    const processTitle = await page.$eval('#btn-trigger-process', el => el.getAttribute('title'));
    const statusTitle = await page.$eval('#tab-status-ready-lead', el => el.getAttribute('title'));
    const pageNextTitle = await page.$eval('#btn-page-next', el => el.getAttribute('title'));

    console.log(`  ✓ Text buttons title check: Inspect="${inspectTitle}", Ingest="${ingestTitle}", Process="${processTitle}", Status="${statusTitle}", Next="${pageNextTitle}"`);
    if (inspectTitle || ingestTitle || processTitle || statusTitle || pageNextTitle) {
      throw new Error('Spammy title detected on text-labeled button!');
    }

    // 4. Verify ZERO data-tooltip elements in DOM
    const tooltipCount = await page.$$eval('[data-tooltip]', els => els.length);
    console.log(`  ✓ Elements with [data-tooltip] in DOM: ${tooltipCount} (Expected: 0)`);
    if (tooltipCount !== 0) throw new Error(`Found ${tooltipCount} elements with [data-tooltip], expected 0!`);

    await saveScreenshot(page, '37-clean-icon-titles.png');
    console.log('=== All Icon Title Verifications Passed Successfully (Zero Spam) ===');
  } finally {
    await browser.close();
  }
}

runIconTitleVerification().catch((err) => {
  console.error('[Error during icon title verification]', err);
  process.exit(1);
});
