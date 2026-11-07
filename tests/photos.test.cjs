const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PhotoIndex } = require('../.server/services/photo-index.js');
const { PhotoServer } = require('../.server/services/server.js');

test('indexes supported photos in their folders and URL-encodes names', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-'));
  try {
    fs.mkdirSync(path.join(root, 'Семья'));
    fs.writeFileSync(path.join(root, 'Семья', 'лето 1.JPG'), 'image');
    fs.writeFileSync(path.join(root, 'Семья', 'note.txt'), 'text');
    const result = PhotoIndex.scanPhotos(root);
    assert.equal(result.length, 1);
    assert.equal(result[0].folder, 'Семья');
    assert.equal(result[0].name, 'лето 1.JPG');
    assert.match(result[0].url, /^\/photos\//);
    assert.equal(decodeURIComponent(result[0].url.slice(8)), 'Семья/лето 1.JPG');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects paths outside the selected directory and non-photo files', () => {
  const root = path.resolve('example-photos');
  assert.equal(PhotoServer.resolvePhoto(root, '../outside.jpg'), null);
  assert.equal(PhotoServer.resolvePhoto(root, 'file.txt'), null);
  assert.equal(
    PhotoServer.resolvePhoto(root, 'folder/image.jpg'),
    path.join(root, 'folder', 'image.jpg'),
  );
});

test('marks a missing folder unavailable rather than presenting an empty photo collection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-index-'));
  const file = path.join(root, 'photos.json');
  try {
    assert.equal(PhotoIndex.writePhotoIndex(path.join(root, 'missing'), file), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { available: false });
    assert.equal(PhotoIndex.writePhotoIndex(root, file), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('file changes alter the version used to refresh cached photos', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-version-'));
  try {
    const file = path.join(root, 'photo.jpg');
    fs.writeFileSync(file, 'one');
    const first = PhotoIndex.scanPhotos(root)[0].version;
    fs.writeFileSync(file, 'different size');
    assert.notEqual(PhotoIndex.scanPhotos(root)[0].version, first);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('separates cached URLs for different configured photo roots', () => {
  const { ServerSettings } = require('../.server/services/settings.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-source-'));
  try {
    fs.writeFileSync(path.join(root, 'photo.jpg'), 'image');
    const id = ServerSettings.sourceId(root);
    const photo = PhotoIndex.scanPhotos(root, id)[0];
    assert.match(id, /^[a-f0-9]{20}$/);
    assert.equal(photo.url, '/photos/photo.jpg?source=' + id);
    assert.notEqual(ServerSettings.sourceId(path.join(root, 'other')), id);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('indexes photos in the root and all nested folders', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-nested-'));
  try {
    fs.mkdirSync(path.join(root, 'family', 'holiday'), { recursive: true });
    fs.writeFileSync(path.join(root, 'root.jpg'), 'image');
    fs.writeFileSync(path.join(root, 'family', 'child.png'), 'image');
    fs.writeFileSync(path.join(root, 'family', 'holiday', 'deep.jpg'), 'image');
    const result = PhotoIndex.scanPhotos(root);
    assert.deepEqual(result.map((photo) => photo.folder).sort(), ['', 'family', 'family/holiday']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('includes photos in dot-prefixed subfolders', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iframe3-hidden-'));
  try {
    fs.mkdirSync(path.join(root, '.archive'));
    fs.writeFileSync(path.join(root, '.archive', 'photo.jpg'), 'image');
    assert.equal(PhotoIndex.scanPhotos(root)[0].folder, '.archive');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
