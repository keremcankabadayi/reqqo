'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { installBrowserStub } = require('./helpers/browser-stub');

const { localStorage } = installBrowserStub();
const { TabManager } = require('../app/js/tabs.js');

function freshManager() {
  localStorage.clear();
  return new TabManager();
}

test('a new tab starts with the default request and no response view', () => {
  const manager = freshManager();
  const tab = manager.createTab();

  assert.equal(tab.request.method, 'GET');
  assert.equal(tab.request.url, '');
  assert.equal(tab.responseView, null);
  assert.equal(tab.isDirty, false);
  assert.equal(manager.activeTabId, tab.id);
});

test('updateTab merges responseView so the viewer state survives a switch', () => {
  const manager = freshManager();
  const tab = manager.createTab();

  manager.updateTab(tab.id, { responseView: { mode: 'code', search: 'listings' } });

  assert.deepEqual(manager.getTabById(tab.id).responseView, { mode: 'code', search: 'listings' });
});

test('closing the last tab leaves a fresh one behind', () => {
  const manager = freshManager();
  const tab = manager.createTab();

  assert.equal(manager.closeTab(tab.id), true);
  assert.equal(manager.getAllTabs().length, 1);
  assert.notEqual(manager.getAllTabs()[0].id, tab.id);
});

test('tab names come from the tail of the URL path', () => {
  const manager = freshManager();

  assert.equal(manager.extractNameFromUrl('https://api.example.com/v1/items'), 'v1/items');
  assert.equal(manager.extractNameFromUrl('https://api.example.com/health'), 'health');
  assert.equal(manager.extractNameFromUrl('https://api.example.com'), 'api.example.com');
  assert.equal(manager.extractNameFromUrl('not a url at all'), 'New Request');
});

test('state survives a save/load round trip', () => {
  const manager = freshManager();
  const tab = manager.createTab();

  manager.updateTab(tab.id, {
    request: { url: 'http://10.0.0.5:9200/_search', method: 'POST' },
    responseView: { mode: 'view', search: 'hits' }
  });
  manager.saveToLocalStorage();

  const reloaded = new TabManager();
  assert.equal(reloaded.loadFromLocalStorage(), true);

  const restored = reloaded.getTabById(tab.id);
  assert.equal(restored.request.url, 'http://10.0.0.5:9200/_search');
  assert.equal(restored.request.method, 'POST');
  assert.deepEqual(restored.responseView, { mode: 'view', search: 'hits' });
  assert.equal(reloaded.activeTabId, manager.activeTabId);
});

test('corrupt storage falls back to a usable tab instead of throwing', () => {
  localStorage.clear();
  localStorage.setItem('reqqo_tabs', '{not json');

  const manager = new TabManager();
  assert.equal(manager.loadFromLocalStorage(), false);
  assert.equal(manager.getAllTabs().length, 1);
});
