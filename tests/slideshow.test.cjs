const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Slideshow } = require('../src/services/slideshow.ts');
test('cycles through photos and handles an empty selection', () => {
  assert.equal(Slideshow.nextPhotoIndex(1, 2), 0);
  assert.equal(Slideshow.nextPhotoIndex(0, 2), 1);
  assert.equal(Slideshow.nextPhotoIndex(0, 0), 0);
});
