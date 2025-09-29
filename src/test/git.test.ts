import { strict as assert } from 'assert';
import { test } from './harness';
import { getHeadHash, getCountsForAllLines, blameLineMetadata } from '../git';

test('git.getHeadHash falls back to WORKTREE on error', async () => {
  const git: any = { revparse: async () => { throw new Error('no HEAD'); } };
  const head = await getHeadHash(git);
  assert.equal(head, 'WORKTREE');
});

test('git.getCountsForAllLines computes counts via mocked git log -L', async () => {
  const relPath = 'a/b.txt';
  const rawCalls: string[] = [];
  const git: any = {
    raw: async (args: string[]) => {
      rawCalls.push(args.join(' '));
      const li = args.indexOf('-L');
      const range = args[li + 1]; // e.g., "3,3:a/b.txt"
      const line = parseInt(range.split(':')[0].split(',')[0], 10);
      // return N lines equal to line index as a simple pattern
      return Array(line).fill('hash').join('\n');
    }
  };
  const counts = await getCountsForAllLines(git as any, relPath, 4, 'k1');
  assert.deepEqual(counts, [1,2,3,4]);
  assert.ok(rawCalls.length >= 4);
});

test('git.blameLineMetadata parses blame -p output', async () => {
  const git: any = {
    raw: async () => (
      [
        'f00 1 1 1',
        'author Jane Doe',
        'author-time 1700000000',
        'summary Change stuff',
        'filename foo.ts',
      ].join('\n')
    ),
  };
  const meta = await blameLineMetadata(git as any, 'foo.ts', 1);
  assert.equal(meta.author, 'Jane Doe');
  assert.ok(meta.date.length > 0);
  assert.equal(meta.summary, 'Change stuff');
});
