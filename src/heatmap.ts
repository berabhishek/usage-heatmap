import * as vscode from 'vscode';

// Number of color bins used for heatmap quantization
const MAX_BINS = 10; // 0..10

const lineHighlightTypes: Map<number, vscode.TextEditorDecorationType> = new Map();
let activeHighlightBins: number[] = [];

type ScaleMode = 'linear' | 'logarithmic' | 'exponential';

/** Read heatmap scaling configuration from settings. */
function getScaleConfig(): { mode: ScaleMode; gamma: number } {
  const cfg = vscode.workspace.getConfiguration('usageHeatmap');
  const mode = (cfg.get<string>('scale', 'logarithmic') as ScaleMode) || 'logarithmic';
  const rawGamma = cfg.get<number>('exponentialGamma', 2);
  const gamma = Math.min(6, Math.max(1, Number.isFinite(rawGamma) ? rawGamma : 2));
  return { mode, gamma };
}

/** Minimal HSL→RGB conversion, returning 0..255 rgb components. */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hp >= 1 && hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp >= 2 && hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp >= 3 && hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp >= 4 && hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else if (hp >= 5 && hp < 6) { r1 = c; g1 = 0; b1 = x; }
  const m = l - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/** Map a [0..MAX_BINS] bin to an rgba background color. */
function colorForBin(bin: number): string {
  const t = Math.max(0, Math.min(bin, MAX_BINS)) / MAX_BINS;
  const startHue = 210; // blue
  const endHue = 0;     // red
  const hue = startHue * (1 - t) + endHue * t;
  const { r, g, b } = hslToRgb(hue, 0.85, 0.50);
  const alpha = 0.12 + 0.22 * t; // slightly increase opacity with edits
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

/** Lazily create and cache an editor decoration type for a color bin. */
function ensureDecorationTypeForBin(bin: number): vscode.TextEditorDecorationType {
  let type = lineHighlightTypes.get(bin);
  if (!type) {
    type = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: colorForBin(bin),
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    });
    lineHighlightTypes.set(bin, type);
  }
  return type;
}

/** Dispose all created decoration types and clear state. */
export function disposeAllHighlightTypes() {
  for (const type of lineHighlightTypes.values()) {
    try { type.dispose(); } catch { /* noop */ }
  }
  lineHighlightTypes.clear();
  activeHighlightBins = [];
}

/** Clear highlights for the bins last applied in a given editor. */
export function clearActiveHighlightDecorations(editor: vscode.TextEditor) {
  for (const bin of activeHighlightBins) {
    const type = lineHighlightTypes.get(bin);
    if (type) {
      editor.setDecorations(type, []);
    }
  }
  activeHighlightBins = [];
}

/**
 * Apply background highlights based on per-line counts. Keeps the API stable
 * and groups ranges by color bin for efficient updates.
 */
export function applyHeatmapHighlights(editor: vscode.TextEditor, counts: number[]) {
  clearActiveHighlightDecorations(editor);

  // Compute dynamic range for normalization
  let minCount = Infinity;
  let maxCount = -Infinity;
  for (const v of counts) {
    const c = v ?? 0;
    if (c < minCount) {
      minCount = c;
    }
    if (c > maxCount) {
      maxCount = c;
    }
  }
  if (!isFinite(minCount)) {
    minCount = 0;
  }
  if (!isFinite(maxCount)) {
    maxCount = 0;
  }
  const range = Math.max(0, maxCount - minCount);

  const { mode, gamma } = getScaleConfig();
  const logDen = Math.log(range + 1);

  const binToRanges = new Map<number, vscode.Range[]>();
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i] ?? 0;
    let t: number;
    if (range <= 0) {
      t = 0;
    } else if (mode === 'logarithmic') {
      // Map counts via log-scale: 0..1 by log(c - min + 1)/log(range + 1)
      const num = Math.log((c - minCount) + 1);
      t = logDen > 0 ? (num / logDen) : 0;
    } else if (mode === 'exponential') {
      // Emphasize high values: (linear)^gamma
      const lin = (c - minCount) / range;
      t = Math.pow(Math.max(0, Math.min(1, lin)), gamma);
    } else {
      // linear
      t = (c - minCount) / range;
    }
    t = Math.max(0, Math.min(1, t));
    const bin = Math.round(t * MAX_BINS);
    if (!binToRanges.has(bin)) {
      binToRanges.set(bin, []);
    }
    binToRanges.get(bin)!.push(new vscode.Range(i, 0, i, 0));
  }

  const usedBins: number[] = [];
  for (const [bin, ranges] of binToRanges.entries()) {
    const type = ensureDecorationTypeForBin(bin);
    editor.setDecorations(type, ranges);
    usedBins.push(bin);
  }
  activeHighlightBins = usedBins;
}
