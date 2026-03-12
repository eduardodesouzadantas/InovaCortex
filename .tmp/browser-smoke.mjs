import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadDotEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ORG_SLUG = process.env.AGENCY_ORG_SLUG || 'inovacortex';
const REPORT_PATH = path.resolve('.tmp/browser-smoke-report.json');
const LOG_PATH = path.resolve('.tmp/browser-smoke-run.log');

const agencyRoutes = [
  '/agency/dashboard',
  '/agency/command-center',
  '/agency/war-room',
  '/agency/executive-pack',
  '/agency/builder',
  '/agency/pipeline',
  '/agency/sales',
  '/agency/marketing/publishing',
  '/agency/outreach'
];

const orgRoutes = [
  `/org/${ORG_SLUG}/admin`,
  `/org/${ORG_SLUG}/admin/command-center`,
  `/org/${ORG_SLUG}/admin/cockpit`,
  `/org/${ORG_SLUG}/admin/sales`,
  `/org/${ORG_SLUG}/admin/deals`,
  `/org/${ORG_SLUG}/admin/marketing`,
  `/org/${ORG_SLUG}/admin/content`,
  `/org/${ORG_SLUG}/admin/whatsapp`,
  `/org/${ORG_SLUG}/admin/executive-pack`
];

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  fs.appendFileSync(LOG_PATH, `${msg}\n`, 'utf8');
  console.log(msg);
}

async function openRoute(context, route) {
  const perRouteTimeoutMs = 30000;

  const runner = async () => {
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

    let status = null;
    let finalUrl = '';
    let loadError = null;

    try {
      const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      status = res?.status() ?? null;
      await sleep(300);
      finalUrl = page.url();

      const title = await page.title().catch(() => '');
      const bodyPreview = await page.evaluate(() => document.body?.innerText?.slice(0, 400) || '').catch(() => '');

      await page.close();

      return {
        route,
        status,
        finalUrl,
        title,
        loadError,
        consoleErrors,
        pageErrors,
        failedRequests,
        bodyPreview,
      };
    } catch (err) {
      loadError = String(err);
      finalUrl = page.url();
      const bodyPreview = await page.evaluate(() => document.body?.innerText?.slice(0, 300) || '').catch(() => '');
      await page.close().catch(() => null);
      return {
        route,
        status,
        finalUrl,
        title: '',
        loadError,
        consoleErrors,
        pageErrors,
        failedRequests,
        bodyPreview,
      };
    }
  };

  const timeoutResult = sleep(perRouteTimeoutMs).then(() => ({
    route,
    status: null,
    finalUrl: '',
    title: '',
    loadError: `timeout_after_${perRouteTimeoutMs}ms`,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    bodyPreview: '',
  }));

  return Promise.race([runner(), timeoutResult]);
}

async function submitLogin(context, loginUrl, expectedFragment) {
  const page = await context.newPage();
  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', ADMIN_EMAIL, { delay: 4 });
    await page.type('input[type="password"]', ADMIN_PASSWORD, { delay: 4 });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null),
    ]);

    await sleep(400);
    const url = page.url();
    const body = await page.evaluate(() => document.body?.innerText?.slice(0, 250) || '').catch(() => '');

    await page.close();
    return { ok: url.includes(expectedFragment), url, body };
  } catch (err) {
    const url = page.url();
    await page.close().catch(() => null);
    return { ok: false, url, error: String(err) };
  }
}

async function run() {
  fs.writeFileSync(LOG_PATH, '', 'utf8');
  const report = {
    baseUrl: BASE_URL,
    orgSlug: ORG_SLUG,
    startedAt: new Date().toISOString(),
    agencyLogin: null,
    orgLogin: null,
    agency: [],
    org: [],
  };

  log('Launching browser');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.createBrowserContext();

  try {
    log('Agency login start');
    report.agencyLogin = await submitLogin(context, `${BASE_URL}/agency/login`, '/agency/');
    log(`Agency login end ok=${report.agencyLogin?.ok}`);

    for (const route of agencyRoutes) {
      log(`Visit agency route ${route}`);
      const result = await openRoute(context, route);
      report.agency.push(result);
      log(`Visited ${route} status=${result.status} error=${result.loadError ? 'yes' : 'no'}`);
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    }

    log('Org login start');
    report.orgLogin = await submitLogin(context, `${BASE_URL}/org/${ORG_SLUG}/admin/login`, `/org/${ORG_SLUG}/admin`);
    log(`Org login end ok=${report.orgLogin?.ok}`);

    for (const route of orgRoutes) {
      log(`Visit org route ${route}`);
      const result = await openRoute(context, route);
      report.org.push(result);
      log(`Visited ${route} status=${result.status} error=${result.loadError ? 'yes' : 'no'}`);
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    await browser.close().catch(() => null);
    log('Browser closed');
  }
}

run().catch((err) => {
  fs.appendFileSync(LOG_PATH, `FATAL ${String(err)}\n`, 'utf8');
  console.error(err);
  process.exitCode = 1;
});
