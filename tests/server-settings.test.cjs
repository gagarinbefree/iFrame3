const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ServerSettings } = require('../.server/services/settings.js');

test('loads the configured photo folder and permits an environment override', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-settings-'));
  const file = path.join(root, 'settings.json');
  try {
    assert.equal(ServerSettings.readSettings(file, {}).photosDir, '');
    fs.writeFileSync(file, JSON.stringify({ photosDir: 'E:\\Photos' }));
    assert.equal(ServerSettings.readSettings(file, {}).photosDir, 'E:\\Photos');
    assert.equal(
      ServerSettings.readSettings(file, { PHOTOS_DIR: 'Z:\\Other' }).photosDir,
      'Z:\\Other',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reports invalid settings rather than silently using a different folder', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-settings-'));
  const file = path.join(root, 'settings.json');
  try {
    fs.writeFileSync(file, '{');
    assert.throws(() => ServerSettings.readSettings(file, {}), /настроек/);
    fs.writeFileSync(file, JSON.stringify({ photosDir: 42 }));
    assert.throws(() => ServerSettings.readSettings(file, {}), /photosDir/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('loads cache and slideshow settings from JSON with defaults and validation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-settings-'));
  const file = path.join(root, 'settings.json');
  try {
    assert.equal(ServerSettings.readSettings(file, {}).cacheLimit, 50);
    assert.equal(ServerSettings.readSettings(file, {}).slideshowIntervalSeconds, 10);
    fs.writeFileSync(
      file,
      JSON.stringify({ photosDir: 'E:\\Photos', cacheLimit: 12, slideshowIntervalSeconds: 5 }),
    );
    assert.equal(ServerSettings.readSettings(file, {}).cacheLimit, 12);
    assert.equal(ServerSettings.readSettings(file, {}).slideshowIntervalSeconds, 5);
    fs.writeFileSync(file, JSON.stringify({ cacheLimit: 0 }));
    assert.throws(() => ServerSettings.readSettings(file, {}), /cacheLimit/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validates photo dimensions in JSON settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-dimensions-'));
  const file = path.join(root, 'settings.json');
  try {
    fs.writeFileSync(file, JSON.stringify({ maxPhotoWidth: 1200, maxPhotoHeight: 900 }));
    assert.equal(ServerSettings.readSettings(file, {}).maxPhotoWidth, 1200);
    assert.equal(ServerSettings.readSettings(file, {}).maxPhotoHeight, 900);
    fs.writeFileSync(file, JSON.stringify({ maxPhotoWidth: 0 }));
    assert.throws(() => ServerSettings.readSettings(file, {}), /maxPhotoWidth/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
