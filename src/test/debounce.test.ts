import { strict as assert } from 'assert';
import { test } from './harness';
import { debounce } from '../debounce';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

test('debounce calls only once with latest args', async () => {
  let called = 0;
  let lastArg: any;
  const fn = (x: number) => { called++; lastArg = x; };
  const debounced = debounce(fn, 30);
  debounced(1);
  debounced(2);
  debounced(3);
  await sleep(50);
  assert.equal(called, 1);
  assert.equal(lastArg, 3);
});

test('debounce preserves this binding', async () => {
  const ctx = { v: 41, inc(this: any, d: number) { this.v += d; } };
  const debounced = debounce(ctx.inc, 20).bind(ctx);
  debounced(1);
  await sleep(35);
  assert.equal(ctx.v, 42);
});

