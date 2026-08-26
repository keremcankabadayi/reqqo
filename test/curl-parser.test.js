'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { installBrowserStub } = require('./helpers/browser-stub');

installBrowserStub();
const { App } = require('../app/js/app.js');

const app = new App();

test('parses a schemeless host:port target, as curl itself accepts', () => {
  const parsed = app.parseCurlCommand(
    `curl -s -X POST "10.85.237.78:9200/my-index/_search?pretty" -H 'Content-Type: application/json' -d '{"size": 3}'`
  );

  assert.equal(parsed.url, 'http://10.85.237.78:9200/my-index/_search?pretty');
  assert.equal(parsed.method, 'POST');
  assert.deepEqual(parsed.headers, [
    { enabled: true, key: 'Content-Type', value: 'application/json' }
  ]);
  assert.equal(parsed.body, '{"size": 3}');
});

test('keeps an explicit scheme untouched', () => {
  const parsed = app.parseCurlCommand(`curl -X GET "https://api.example.com/v1/items?status=onSale"`);
  assert.equal(parsed.url, 'https://api.example.com/v1/items?status=onSale');
});

test('does not mistake a flag value for the request target', () => {
  const parsed = app.parseCurlCommand(`curl -X POST example.com/api -d '{"a":1}'`);

  assert.equal(parsed.method, 'POST');
  assert.equal(parsed.url, 'http://example.com/api');
});

test('honours --url', () => {
  const parsed = app.parseCurlCommand(`curl --url 10.0.0.5:9200/_cat/indices -X GET`);
  assert.equal(parsed.url, 'http://10.0.0.5:9200/_cat/indices');
});

test('returns null when there is no target to import', () => {
  assert.equal(app.parseCurlCommand(`curl -X POST -H "Accept: */*"`), null);
});

test('keeps a multi-line JSON payload parseable', () => {
  const parsed = app.parseCurlCommand(`curl -X POST "10.85.237.78:9200/idx/_search" \\
    -H 'Content-Type: application/json' \\
    -d '{
      "size": 3,
      "query": {
        "bool": {
          "filter": [
            {"term": {"content.variants.attributes.id": 338}},
            {"nested": {"path": "listings", "query": {"term": {"listings.statusTypes": "ON_SALE"}}}}
          ]
        }
      }
    }'`);

  assert.equal(parsed.url, 'http://10.85.237.78:9200/idx/_search');
  assert.doesNotThrow(() => JSON.parse(parsed.body));
  assert.equal(JSON.parse(parsed.body).size, 3);
});

test('tokenizer keeps a quoted payload as one token', () => {
  const tokens = app.tokenizeCurlCommand(`curl -d '{"a": 1, "b": 2}' https://x.test`);
  assert.deepEqual(tokens, ['curl', '-d', '{"a": 1, "b": 2}', 'https://x.test']);
});

test('rejects bare words that are not hosts', () => {
  assert.equal(app.looksLikeCurlUrl('POST'), false);
  assert.equal(app.looksLikeCurlUrl('application/json'), false);
  assert.equal(app.looksLikeCurlUrl('localhost:8080'), true);
  assert.equal(app.looksLikeCurlUrl('api.example.com'), true);
});
