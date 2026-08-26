'use strict';

// app/js files are classic scripts written against the browser. The pure logic
// worth unit-testing (curl parsing, layout clamping, tab bookkeeping) only needs
// window/localStorage to exist, not to behave like a real DOM — so this stubs
// the smallest surface those modules touch at require time.

function createLocalStorage() {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    }
  };
}

function installBrowserStub() {
  const localStorage = createLocalStorage();

  // document is deliberately left undefined: app.js only registers its
  // DOMContentLoaded bootstrap when one exists, which keeps these tests off
  // every DOM code path.
  globalThis.window = { tabManager: null };
  globalThis.localStorage = localStorage;

  return { localStorage };
}

module.exports = { installBrowserStub, createLocalStorage };
