#!/usr/bin/env node
/**
 * Captures authenticated frontend screenshots for docs/features.md.
 *
 * Required:
 *   SCREENSHOT_AUTH_TOKEN  Auth cookie / JWT value accepted by the frontend proxy
 *
 * Optional:
 *   SCREENSHOT_BASE_URL    Default http://localhost:4200
 *   SCREENSHOT_OUTPUT_DIR  Default docs/.vitepress/static/images/features
 */
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { featureScreenshots } from './feature-screenshots.manifest.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, '..');

const baseUrl = (
  process.env.SCREENSHOT_BASE_URL || 'http://localhost:4200'
).replace(/\/$/, '');
const authToken = process.env.SCREENSHOT_AUTH_TOKEN;
const outputDir = path.resolve(
  repoDir,
  process.env.SCREENSHOT_OUTPUT_DIR || 'docs/.vitepress/static/images/features'
);

const VIEWPORT = { width: 1440, height: 900 };
const NAV_TIMEOUT_MS = 45_000;
const SETTLE_MS = 1_500;

/**
 * @param {string} message
 * @returns {never}
 */
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

/**
 * @param {string} url
 */
const assertFrontendReachable = async (url) => {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    if (response.status === 0) {
      fail(
        `Frontend at ${url} did not respond. Start it with \`pnpm dev:frontend\` and retry.`
      );
    }
  } catch (error) {
    fail(
      `Frontend at ${url} is unreachable (${
        error instanceof Error ? error.message : error
      }). Start it with \`pnpm dev:frontend\` and retry.`
    );
  }
};

/**
 * @param {import('playwright').Page} page
 * @param {string} route
 */
const assertAuthenticated = async (page, route) => {
  const currentUrl = page.url();
  if (currentUrl.includes('/auth')) {
    fail(
      `Navigating to ${route} redirected to login (${currentUrl}). Check SCREENSHOT_AUTH_TOKEN.`
    );
  }
};

const main = async () => {
  if (!authToken) {
    fail(
      [
        'SCREENSHOT_AUTH_TOKEN is required.',
        'Export a valid auth cookie/JWT for a deterministic demo account, then re-run:',
        '  SCREENSHOT_AUTH_TOKEN=<token> pnpm docs:screenshots',
      ].join('\n')
    );
  }

  await assertFrontendReachable(baseUrl);
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });

  const base = new URL(baseUrl);
  await context.addCookies([
    {
      name: 'auth',
      value: authToken,
      domain: base.hostname,
      path: '/',
      httpOnly: true,
      secure: base.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  try {
    for (const shot of featureScreenshots) {
      const targetUrl = new URL(shot.route, `${baseUrl}/`);
      console.log(`Capturing ${shot.title} -> ${shot.route}`);

      await page.goto(targetUrl.toString(), {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT_MS,
      });
      await assertAuthenticated(page, shot.route);

      if (shot.waitSelector) {
        await page.waitForSelector(shot.waitSelector, {
          state: 'visible',
          timeout: NAV_TIMEOUT_MS,
        });
      }

      // Give client-side data a moment to paint without waiting for long-lived
      // websocket/polling connections that prevent networkidle.
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

      const outPath = path.join(outputDir, shot.file);
      await page.screenshot({
        path: outPath,
        fullPage: false,
        type: 'png',
      });

      await access(outPath);
      console.log(`  wrote ${path.relative(repoDir, outPath)}`);
    }
  } finally {
    await browser.close();
  }

  console.log(
    `Done. Captured ${
      featureScreenshots.length
    } screenshots into ${path.relative(repoDir, outputDir)}`
  );
};

main().catch((error) => {
  fail(error instanceof Error ? error.stack || error.message : String(error));
});
