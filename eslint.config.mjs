// The extension ships classic <script> tags, so every file shares one global
// scope and cross-file references are implicit. no-undef is the point of this
// config: it turns a renamed function into a CI failure instead of a runtime
// error the user finds first.
//
// Because those shared names are declared here as globals AND declared for real
// in their own file, no-redeclare must run with builtinGlobals disabled —
// otherwise every `class TabManager` is reported as redeclaring itself.
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Blob: 'readonly',
  FormData: 'readonly',
  AbortController: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',
  indexedDB: 'readonly',
  MutationObserver: 'readonly',
  KeyboardEvent: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  performance: 'readonly',
  structuredClone: 'readonly',
  crypto: 'readonly'
};

// Created by app/index.html's script order; each is declared in exactly one file.
const sharedAppGlobals = {
  DB_NAME: 'readonly',
  DB_VERSION: 'readonly',
  STORES: 'readonly',
  App: 'readonly',
  AuthManager: 'readonly',
  CodeEditor: 'readonly',
  CollectionsManager: 'readonly',
  HistoryManager: 'readonly',
  PlaceholderManager: 'readonly',
  RequestManager: 'readonly',
  Storage: 'readonly',
  TabManager: 'readonly',
  authManager: 'readonly',
  collectionsManager: 'readonly',
  historyManager: 'readonly',
  monacoSetup: 'readonly',
  placeholderManager: 'readonly',
  requestManager: 'readonly',
  storage: 'readonly',
  tabManager: 'readonly',
  applyResponseViewState: 'readonly',
  getRequestBody: 'readonly',
  getResponseBody: 'readonly',
  getResponseSearchInput: 'readonly',
  getResponseViewState: 'readonly',
  initEditors: 'readonly',
  setRequestBody: 'readonly',
  setResponseBody: 'readonly'
};

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  globalThis: 'readonly',
  URL: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly'
};

export default [
  {
    ignores: ['app/lib/**', 'dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**']
  },

  {
    files: ['app/js/**/*.js', 'background.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...browserGlobals,
        ...sharedAppGlobals,
        chrome: 'readonly',
        JSONEditor: 'readonly',
        // CommonJS export guards at the tail of app.js / tabs.js
        module: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'smart']
    }
  },

  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs', 'playwright.config.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn'
    }
  },

  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...nodeGlobals, require: 'readonly', module: 'writable', __dirname: 'readonly' }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn'
    }
  },

  {
    files: ['test/e2e/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn'
    }
  }
];
