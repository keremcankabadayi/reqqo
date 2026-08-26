import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { test, expect, chromium } from '@playwright/test';

// This file straddles two realms: the spec body runs in Node, while the
// page.evaluate callbacks are serialised and executed inside the page. Declare
// the names each realm contributes so no-undef stays useful here.
/* global setTimeout, document, DataTransfer, ClipboardEvent */

// The repo root is the unpacked extension: manifest.json sits beside app/.
const extensionPath = fileURLToPath(new URL('../..', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));

let context;
let extensionId;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  // MV3 registers a service worker; its URL carries the generated extension id.
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  // Closing a persistent context that has an extension loaded can hang on the
  // extension's service worker. The browser dies with the runner either way, so
  // cap the wait rather than let teardown fail an otherwise green suite.
  await Promise.race([
    context?.close(),
    new Promise((resolve) => setTimeout(resolve, 5_000))
  ]);
});

// jsoneditor bundles Ace, whose JSON worker is loaded via importScripts from a
// data: URL. MV3's content security policy blocks that, so the worker never
// starts. Known and non-fatal — the editor renders, it just loses Ace's inline
// JSON annotations. Tracked here so any OTHER console error still fails the run.
const KNOWN_BOOT_ERRORS = [/importScripts.*data:application\/javascript/];

async function openApp() {
  const page = await context.newPage();
  const consoleErrors = [];

  const record = (text) => {
    if (!KNOWN_BOOT_ERRORS.some((pattern) => pattern.test(text))) consoleErrors.push(text);
  };

  page.on('console', (message) => {
    if (message.type() === 'error') record(message.text());
  });
  page.on('pageerror', (error) => record(error.message));

  await page.goto(`chrome-extension://${extensionId}/app/index.html`);
  await expect(page.locator('.logo')).toContainText('Reqqo');

  return { page, consoleErrors };
}

test('boots without console errors', async () => {
  const { page, consoleErrors } = await openApp();

  // Every script in index.html shares one global scope; a missing or renamed
  // file surfaces here as a ReferenceError and nowhere else.
  expect(consoleErrors).toEqual([]);
  await expect(page).toHaveTitle('Reqqo');

  await page.close();
});

test('shows the manifest version in the badge', async () => {
  const { page } = await openApp();

  await expect(page.locator('#versionBadge')).toHaveText(`v${manifest.version}`);

  await page.close();
});

test('opens a new request tab', async () => {
  const { page } = await openApp();

  const tabs = page.locator('#tabsList .tab-item');
  const before = await tabs.count();

  await page.locator('#newTabBtn').click();

  await expect(tabs).toHaveCount(before + 1);

  await page.close();
});

test('imports a pasted curl command into the URL bar', async () => {
  const { page } = await openApp();

  const command = `curl -X POST "10.85.237.78:9200/my-index/_search?pretty" -H 'Content-Type: application/json' -d '{"size": 3}'`;

  // Paste rather than type: the import only runs from the paste handler.
  await page.locator('#requestUrl').focus();
  await page.evaluate((text) => {
    const input = document.getElementById('requestUrl');
    const data = new DataTransfer();
    data.setData('text', text);
    input.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
    );
  }, command);

  await expect(page.locator('#requestUrl')).toHaveValue(
    'http://10.85.237.78:9200/my-index/_search?pretty'
  );
  await expect(page.locator('#requestMethod')).toHaveValue('POST');

  await page.close();
});
