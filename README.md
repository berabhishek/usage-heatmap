# Change Heatmap – See Code Change Hotspots, Instantly

Change Heatmap visualizes Git change activity directly in your editor using a subtle, per-line background heatmap. Quickly spot churn-heavy areas, understand file history at a glance, and focus your attention where it matters most. For the selected line, an optional inline note shows how many changes were recorded.

## What You Get

- Heatmap coloring per line based on Git history.
- Optional inline text on the current line: “(N changes)”.
- Three scaling modes for intensity: logarithmic (default), exponential, linear.
- One-tap toggles to enable/disable color or inline text.

## How It Works

- The extension analyzes your repository’s history for the open file and computes change counts per line.
- It then maps those counts to color bins to render a subtle, whole-line background.
- For the active cursor line, it can show an inline “(N changes)” annotation at the end of the line.

## Quick Start

1. Open a Git repository folder in VS Code.
2. Open any tracked file. Change Heatmap activates automatically.
3. Use the commands palette to control visibility:
   - `Change Heatmap: Toggle`
   - `Change Heatmap: Toggle Color`
   - `Change Heatmap: Toggle Text`

## Settings

- `changeHeatmap.enableColor`: Enable/disable the background heatmap.
- `changeHeatmap.enableText`: Enable/disable the “(N changes)” inline annotation.
- `changeHeatmap.scale`: Map change counts to color intensity.
  - `logarithmic` (default): Best overall contrast; prevents saturation on hotspots.
  - `exponential`: Emphasizes high-change hotspots; tune via `exponentialGamma`.
  - `linear`: Uniform mapping across the range.
- `changeHeatmap.exponentialGamma`: Exponent used by `exponential` scale (default: 2, range: 1–6).

## Requirements & Limitations

- Requires an open folder that is a valid Git repository.
- Works with files tracked by Git; untracked files won’t show history.
- VS Code decorations are whole-line; backgrounds are intentionally subtle to avoid distraction.

## Privacy

- All analysis runs locally using your Git history; no data leaves your machine.

## Troubleshooting

- No colors? Make sure the workspace is a Git repo and the file is tracked.
- Still nothing? Try saving the file or switching focus back to the editor.
- Check Output/Console for “Change Heatmap extension is now active.” when it starts.

---

 Developer Notes

These are useful if you want to build or modify the extension locally.

- Install dependencies (requires pnpm): `pnpm install`
- Compile TypeScript: `pnpm run compile`
- Watch for changes: `pnpm run watch`
- Package a `.vsix`: `pnpm run package`
- Publish latest version: `pnpm run publish:latest` (requires `VSCE_PAT`)
- Run in dev mode: open the repo in VS Code and press `F5`.
- Run tests with coverage: `pnpm run test:coverage` (writes raw V8 JSON to `coverage/`).

MIT License
