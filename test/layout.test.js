'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { installBrowserStub } = require('./helpers/browser-stub');

const { localStorage } = installBrowserStub();
const { App } = require('../app/js/app.js');

const app = new App();

test('clampNumber keeps a value inside the drag bounds', () => {
  assert.equal(app.clampNumber(280, 200, 500), 280);
  assert.equal(app.clampNumber(40, 200, 500), 200);
  assert.equal(app.clampNumber(9000, 200, 500), 500);
});

test('saveLayout round trips through storage', () => {
  localStorage.clear();

  app.saveLayout({ sidebarWidth: 320 });
  app.saveLayout({ requestWidthPercent: 45 });

  assert.deepEqual(app.readLayout(), { sidebarWidth: 320, requestWidthPercent: 45 });
});

test('a stray click cannot wipe a saved size', () => {
  localStorage.clear();
  app.saveLayout({ sidebarWidth: 320 });

  // parseFloat('') on an untouched style.width — what a click without a drag produces
  app.saveLayout({ sidebarWidth: NaN });

  assert.equal(app.readLayout().sidebarWidth, 320);
});

test('corrupt layout storage reads as empty rather than throwing', () => {
  localStorage.clear();
  localStorage.setItem('reqqo_layout', 'not json at all');

  assert.deepEqual(app.readLayout(), {});
});
