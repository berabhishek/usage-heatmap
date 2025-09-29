import { strict as assert } from 'assert';
import { test } from './harness';
import { createInfoDecorationType, buildInlineInfoDecoration } from '../decorations';

test('decorations.createInfoDecorationType returns disposable', () => {
  const t = createInfoDecorationType();
  assert.ok(t);
  assert.equal(typeof (t as any).dispose, 'function');
});

test('decorations.buildInlineInfoDecoration sets after content and range', () => {
  const editor: any = {
    document: {
      lineAt: (i: number) => ({ range: { end: { character: 7 + i } } })
    }
  };
  const deco = buildInlineInfoDecoration(editor, 3, '(2 changes)');
  assert.equal((deco as any).range.end.character, 7 + 3);
  const after = (deco as any).renderOptions?.after as any;
  assert.equal(after.contentText, '(2 changes)');
});

