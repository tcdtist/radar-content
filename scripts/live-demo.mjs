import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = 'http://localhost:3000';

async function clearReactInput(page, selector) {
  await page.$eval(selector, (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function runLiveTour() {
  console.log('🚀 Launching visible Google Chrome window on your screen for Live Interactive Tour...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false, // Opens visible Chrome window on desktop
    slowMo: 450,    // Slows down actions so user can see every click live
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--user-data-dir=/tmp/radar-live-demo',
      '--window-size=1380,920',
      '--window-position=80,60',
    ],
  });

  const page = await browser.newPage();

  try {
    console.log('1. Navigating to http://localhost:3000...');
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.glass-panel', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 1200));

    console.log('2. Clicking Topic Pill: #AI');
    await page.click('#pill-topic-AI');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('3. Clicking Topic Pill: #Database');
    await page.click('#pill-topic-Database');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('4. Resetting to: All Topics');
    await page.click('#pill-topic-all');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('5. Typing search query: "DeepSeek"');
    await page.type('#input-card-search', 'DeepSeek', { delay: 100 });
    await new Promise((r) => setTimeout(r, 1200));

    console.log('6. Clearing search query...');
    await clearReactInput(page, '#input-card-search');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('7. Switching to Status: Ready Only');
    await page.click('#tab-status-ready');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('8. Switching back to: Active Leads & Ready');
    await page.click('#tab-status-ready-lead');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('9. Clicking Card Tab: 🛡️ Counter');
    await page.click('[data-testid="tab-counter"]');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('10. Clicking Card Tab: 🌐 Context');
    await page.click('[data-testid="tab-context"]');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('11. Clicking Card Tab: ❓ Verify');
    await page.click('[data-testid="tab-questions"]');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('12. Returning to Card Tab: 📊 Evidence');
    await page.click('[data-testid="tab-evidence"]');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('13. Clicking: 📋 Copy Draft (Markdown)');
    await page.click('[data-testid="btn-copy-draft"]');
    await new Promise((r) => setTimeout(r, 1500));

    console.log('14. Clicking Action: ⭐ Save on first card');
    await page.click('[data-testid="btn-action-save"]');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('15. Switching to tab: ⭐ Saved to view saved card');
    await page.click('#tab-status-saved');
    await new Promise((r) => setTimeout(r, 1500));

    console.log('16. Switching back to: Active Leads & Ready');
    await page.click('#tab-status-ready-lead');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('17. Clicking Action: ✍️ Written on second card');
    await page.click('[data-testid="btn-action-written"]');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('18. Switching to tab: ✍️ Written to view written card');
    await page.click('#tab-status-written');
    await new Promise((r) => setTimeout(r, 1500));

    console.log('19. Switching back to Active Leads & Ready');
    await page.click('#tab-status-ready-lead');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('20. Triggering Crawl Ingest Now in Header');
    await page.click('#btn-trigger-crawl');
    await new Promise((r) => setTimeout(r, 1500));

    console.log('✨ Live Tour Completed! Leaving browser open for your manual inspection...');
  } catch (err) {
    console.error('Error during tour:', err);
  }
}

runLiveTour();
