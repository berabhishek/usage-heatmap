import { strict as assert } from 'assert';
import { test } from './harness';
import { docKey, setDocCounts, getDocCounts, deleteDocCounts, clearAllDocCounts } from '../cache';

test('cache.docKey uses uri.toString()', () => {
  const uri: any = { toString: () => 'file:///tmp/a' };
  assert.equal(docKey(uri), 'file:///tmp/a');
});

test('cache set/get/delete/clear works', () => {
  const uri: any = { toString: () => 'u1' };
  const counts = [1,2,3];
  setDocCounts(uri, counts);
  assert.deepEqual(getDocCounts(uri), counts);
  deleteDocCounts(uri);
  assert.equal(getDocCounts(uri), undefined);
  setDocCounts(uri, counts);
  clearAllDocCounts();
  assert.equal(getDocCounts(uri), undefined);
});

