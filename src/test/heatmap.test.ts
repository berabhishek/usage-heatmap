import { strict as assert } from 'assert';
import { test } from './harness';
import { applyHeatmapHighlights, disposeAllHighlightTypes, clearActiveHighlightDecorations } from '../heatmap';

test('heatmap.applyHeatmapHighlights groups uniform counts into single bin', () => {
  const counts = new Array(5).fill(3);
  const calls: Array<{ ranges: any[] }> = [];
  const editor: any = {
    setDecorations: (_type: any, ranges: any[]) => { calls.push({ ranges }); },
  };

  applyHeatmapHighlights(editor, counts);
  // Should have exactly 1 setDecorations call with 5 ranges
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ranges.length, 5);

  // Clear and dispose should not throw
  clearActiveHighlightDecorations(editor);
  disposeAllHighlightTypes();
});

