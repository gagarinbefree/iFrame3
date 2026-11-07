const { test } = require('node:test');
const assert = require('node:assert/strict');
const { indexedDB } = require('fake-indexeddb');
const { PhotoCache, PhotoDimensions } = require('../src/services/photo-cache.ts');

const open = () =>
  new Promise((resolve, reject) =>
    PhotoCache.open(
      indexedDB,
      (error, cache) => (error ? reject(error) : resolve(cache)),
      require('../settings.example.json').cacheLimit,
    ),
  );
const invoke = (fn) =>
  new Promise((resolve, reject) => fn((error, value) => (error ? reject(error) : resolve(value))));

test('persists cached photo data and separate metadata for offline listing', async () => {
  const cache = await open();
  const photo = { url: '/photos/test.jpg', name: 'test.jpg', folder: 'Семья', version: '1:2' };
  await invoke((done) => cache.put(photo, 'data:image/jpeg;base64,abc', done));
  const reopened = await open();
  const items = await invoke((done) => reopened.list(done));
  assert.deepEqual(items, [photo]);
  assert.equal(await invoke((done) => reopened.get(photo.url, done)), 'data:image/jpeg;base64,abc');
  assert.equal(await invoke((done) => reopened.get('/photos/missing.jpg', done)), null);
});

test('fits landscape and portrait photos to iPad 3 pixels without enlarging', () => {
  assert.deepEqual(PhotoDimensions.fit(4000, 3000, 2048, 1536), { width: 2048, height: 1536 });
  assert.deepEqual(PhotoDimensions.fit(3000, 4000, 2048, 1536), { width: 1536, height: 2048 });
  assert.deepEqual(PhotoDimensions.fit(800, 600, 2048, 1536), { width: 800, height: 600 });
});

test('keeps at most the configured number of photos and replaces the oldest', async () => {
  const { IDBFactory } = require('fake-indexeddb');
  const factory = new IDBFactory();
  const cache = await new Promise((resolve, reject) =>
    PhotoCache.open(factory, (error, value) => (error ? reject(error) : resolve(value)), 2),
  );
  for (const name of ['one', 'two', 'three']) {
    await invoke((done) =>
      cache.put({ url: '/photos/' + name + '.jpg', name, folder: '' }, 'data:' + name, done),
    );
  }
  const items = await invoke((done) => cache.list(done));
  assert.equal(items.length, 2);
  assert.equal(await invoke((done) => cache.get('/photos/one.jpg', done)), null);
  assert.equal(await invoke((done) => cache.get('/photos/three.jpg', done)), 'data:three');
});

test('changing the cache setting removes older entries immediately', async () => {
  const { IDBFactory } = require('fake-indexeddb');
  const cache = await new Promise((resolve, reject) =>
    PhotoCache.open(
      new IDBFactory(),
      (error, value) => (error ? reject(error) : resolve(value)),
      3,
    ),
  );
  for (const name of ['a', 'b', 'c'])
    await invoke((done) =>
      cache.put({ url: '/photos/' + name + '.jpg', name, folder: '' }, 'data:' + name, done),
    );
  await invoke((done) => cache.setLimit(1, done));
  assert.deepEqual(
    (await invoke((done) => cache.list(done))).map((photo) => photo.name),
    ['c'],
  );
});

test('uses the configured dimensions for portrait and landscape photos', () => {
  assert.deepEqual(PhotoDimensions.fit(4000, 3000, 1200, 900), { width: 1200, height: 900 });
  assert.deepEqual(PhotoDimensions.fit(3000, 4000, 1200, 900), { width: 900, height: 1200 });
});
