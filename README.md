# Usage Heatmap VS Code Extension

Shows the current line number (where the cursor is) in the status bar in a faint color.

## Features

- Displays the current cursor line number in the status bar.
- Uses a faint grey color for subtlety.
- Updates as you move the cursor in any file.

## Installation

1. Clone this repository:
   ```sh
   git clone https://github.com/berabhishek/usage-heatmap.git
   cd usage-heatmap
   ```

2. Install dependencies (requires [pnpm](https://pnpm.io/)):
   ```sh
   pnpm install
   ```

3. Compile the extension:
   ```sh
   pnpm run compile
   ```

4. Open the project in VS Code:
   ```sh
   code .
   ```

5. Press `F5` to launch a new Extension Development Host window with Usage Heatmap enabled.

## Development Commands

- **Install dependencies**
  ```sh
  pnpm install
  ```

- **Compile TypeScript**
  ```sh
  pnpm run compile
  ```

- **Watch for changes**
  ```sh
  pnpm run watch
  ```

- **Package the extension**
  ```sh
  pnpm exec vsce package
  ```

- **Run extension in development mode**
  1. Open the repo in VS Code: `code .`
  2. Press `F5` to open a new Extension Development Host window.

## Settings

- `usageHeatmap.scale`: Choose how change counts map to color intensity. Options:
  - `logarithmic` (default): Spreads low-to-moderate changes, avoids saturation on extreme hotspots.
  - `exponential`: Emphasizes high-change hotspots; tune with `usageHeatmap.exponentialGamma`.
  - `linear`: Uniform mapping.
- `usageHeatmap.exponentialGamma`: Exponent when using `exponential` scale (default: 2).

## Limitations

- VS Code only allows line background decorations per range; the heatmap uses subtle whole-line backgrounds and an inline info annotation for the selected line.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

MIT License
