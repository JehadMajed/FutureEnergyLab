const puppeteer = require('puppeteer');
const fs = require('fs');

// The URL you want to monitor (change this to your Cloudflare Pages URL once deployed)
const TARGET_URL = 'https://digital-twin-lamps-panel.pages.dev/';
const LOG_FILE = 'browser_console.log';

// Helper to format timestamps
function getTimestamp() {
  return new Date().toISOString();
}

async function runSoakTest() {
  console.log(`[${getTimestamp()}] Starting soak test for ${TARGET_URL}...`);
  console.log(`[${getTimestamp()}] Logs will be written to ${LOG_FILE}`);

  // Launch browser in headless mode (running in background)
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  // Listen to all console events (logs, warnings, errors)
  page.on('console', msg => {
    const logLine = `[${getTimestamp()}] [${msg.type().toUpperCase()}] ${msg.text()}\n`;

    // Print to terminal
    process.stdout.write(logLine);

    // Append to log file
    fs.appendFileSync(LOG_FILE, logLine);
  });

  // Listen to page errors (crashes, unhandled exceptions)
  page.on('pageerror', error => {
    const logLine = `[${getTimestamp()}] [PAGE ERROR] ${error.message}\n`;
    process.stdout.write(logLine);
    fs.appendFileSync(LOG_FILE, logLine);
  });

  // Navigate to the dashboard
  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
    console.log(`[${getTimestamp()}] Page loaded successfully. Now monitoring for 7 days...`);
  } catch (e) {
    console.error(`[${getTimestamp()}] Failed to load page:`, e);
    await browser.close();
    process.exit(1);
  }

  // Keep the script running for 7 days (7 * 24 * 60 * 60 * 1000 ms)
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  setTimeout(async () => {
    console.log(`[${getTimestamp()}] Soak test completed (7 days reached). Closing browser.`);
    fs.appendFileSync(LOG_FILE, `[${getTimestamp()}] Soak test completed.\n`);
    await browser.close();
  }, SEVEN_DAYS);
}

runSoakTest().catch(console.error);
