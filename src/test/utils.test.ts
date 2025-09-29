import { strict as assert } from 'assert';
import { test } from './harness';
import { clamp, errorMessage } from '../utils';

test('utils.clamp clamps within range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('utils.errorMessage extracts from Error', () => {
  const err = new Error('boom');
  assert.equal(errorMessage(err), 'boom');
});

test('utils.errorMessage passes through strings', () => {
  assert.equal(errorMessage('oops'), 'oops');
});

test('utils.errorMessage stringifies objects safely', () => {
  assert.equal(errorMessage({ a: 1, b: 'c' }), '{"a":1,"b":"c"}');
});

test('utils.errorMessage handles circular safely', () => {
  const a: any = { a: 1 };
  a.self = a;
  // JSON.stringify throws on circular; function should catch and return ''
  assert.equal(errorMessage(a), '');
});

