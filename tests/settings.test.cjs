const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ClientSettingsStore } = require('../src/store/settings.ts');
test('remembers public JSON settings for use while the server is unavailable', () => {
  const store = {
    value: null,
    getItem() {
      return this.value;
    },
    setItem(key, value) {
      this.value = value;
    },
  };
  assert.equal(new ClientSettingsStore(store).read().cacheLimit, 50);
  const settings = {
    cacheLimit: 12,
    slideshowIntervalSeconds: 5,
    sourceId: '0123456789abcdef0123',
    maxPhotoWidth: 2048,
    maxPhotoHeight: 1536,
  };
  assert.equal(new ClientSettingsStore(store).save(settings), true);
  assert.deepEqual(new ClientSettingsStore(store).read(), settings);
  assert.equal(new ClientSettingsStore(store).save({ ...settings, cacheLimit: 0 }), false);
  assert.equal(new ClientSettingsStore(null).read().cacheLimit, 50);
});
