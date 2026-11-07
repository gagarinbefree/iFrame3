const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('page loads its bundled assets and has no client secret field', () => {
  const page = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.match(page, /app\.js/);
  assert.match(page, /style\.css/);
  assert.doesNotMatch(page, /<input[^>]+(?:name|id)=["'][^"']*client[_-]?secret/i);
});

test('uses a configurable port and rejects invalid values', () => {
  const { PhotoServer } = require('../.server/services/server.js');
  assert.equal(PhotoServer.getPort(undefined), 3000);
  assert.equal(PhotoServer.getPort('4321'), 4321);
  for (const value of ['', '0', '65536', 'abc', '3.5']) {
    assert.throws(() => PhotoServer.getPort(value), /PORT/);
  }
});

test('the frame has no visible controls or text', () => {
  const page = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.doesNotMatch(page, /<(button|select|label|p)(\s|>)/i);
  assert.match(page, /id="frame"/);
});

test('photos fit within the frame without cropping', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/style.css'), 'utf8');
  assert.match(css, /background-size:\s*contain\s*;/);
});
