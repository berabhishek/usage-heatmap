# Usage Heatmap VS Code Extension

VS Code extension that shows the current line number (where the cursor is) in the status bar with faint grey color. Written in TypeScript and packaged as a VS Code extension (.vsix).

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Build Process
- Install pnpm (package manager): `npm install -g pnpm`
- Install dependencies: `pnpm install` -- takes ~10 seconds. NEVER CANCEL.
- Compile TypeScript: `pnpm run compile` -- takes <2 seconds.
- Build and package extension: `pnpm run package` -- takes ~5 seconds. NEVER CANCEL.

### Development Workflow
- Start TypeScript compiler in watch mode: `pnpm run watch` -- runs continuously, recompiles on file changes.
- The watch command will show "Found 0 errors. Watching for file changes." when ready.
- Stop watch mode with Ctrl+C when done making changes.

### Testing and Validation
- VS Code is NOT available in the current environment.
- You CANNOT run the extension interactively (F5 debugging not possible).
- Always validate that compilation succeeds: `pnpm run compile` must exit with code 0.
- Always validate that packaging succeeds: `pnpm run package` must create a `.vsix` file.
- Check the generated `.vsix` file exists: `ls -la *.vsix`

## Project Structure

### Repository Root
```
.
├── .github/                  # GitHub configuration
├── .vscode/                  # VS Code debugging configuration  
├── out/                      # Compiled JavaScript output (generated)
├── src/                      # TypeScript source code
│   └── extension.ts          # Main extension entry point
├── node_modules/             # Dependencies (ignored by git)
├── .gitignore               # Git ignore patterns
├── LICENSE                  # MIT license
├── README.md                # Project documentation
├── package.json             # NPM package configuration and VS Code extension manifest
├── pnpm-lock.yaml          # pnpm lockfile (committed)
├── tsconfig.json           # TypeScript compiler configuration
└── *.vsix                  # Packaged extension files (ignored by git)
```

### Key Files to Know
- `src/extension.ts`: Main extension logic - status bar item creation and cursor position tracking
- `package.json`: Contains extension metadata, scripts, and dependencies
- `tsconfig.json`: TypeScript compilation settings (target: ES2020, outDir: out)
- `.vscode/launch.json`: VS Code debugging configuration (F5 functionality)

## Exact Command Reference

### Install Dependencies
```bash
# Install pnpm if not available
npm install -g pnpm

# Install all project dependencies 
pnpm install
```
**Timing**: ~10 seconds. **NEVER CANCEL** - wait for completion.

### Build Commands
```bash
# Compile TypeScript to JavaScript (one-time)
pnpm run compile

# Compile TypeScript in watch mode (continuous)
pnpm run watch

# Package extension into .vsix file
pnpm run package
```
**Timing**: 
- `compile`: <2 seconds
- `package`: ~5 seconds  
- `watch`: Runs continuously until stopped

### Validation Commands
```bash
# Check compilation output exists
ls -la out/

# Verify package was created
ls -la *.vsix

# Clean build artifacts
rm -rf out/ *.vsix
```

## Common Development Tasks

### Making Code Changes
1. Start watch mode: `pnpm run watch`
2. Edit files in `src/` directory
3. Watch mode automatically recompiles on save
4. Verify no compilation errors in watch output
5. Stop watch mode when done: Ctrl+C

### Testing Changes
1. Compile the extension: `pnpm run compile`
2. Package the extension: `pnpm run package`
3. Verify `.vsix` file was created successfully
4. Check file size is reasonable (~18KB for this extension)

### Before Committing Changes
1. Always run `pnpm run compile` to ensure no TypeScript errors
2. Always run `pnpm run package` to ensure extension can be packaged
3. Clean up any temporary files: `rm -f *.vsix`

## Extension Development Details

### VS Code Extension Manifest
The `package.json` serves as both npm package file and VS Code extension manifest with:
- Extension metadata (name, version, description)
- VS Code API version requirement (`engines.vscode`)
- Activation events (`onStartupFinished`)
- Main entry point (`./out/extension.js`)
- Dependencies and build scripts

### TypeScript Configuration
- Target: ES2020
- Module: CommonJS  
- Output directory: `out/`
- Source maps enabled for debugging
- Strict type checking enabled

### Extension Functionality
- Creates status bar item on activation
- Displays current cursor line number as "Line X"
- Uses faint grey color (#808080) for subtlety
- Updates on cursor movement and editor changes
- Automatically shows/hides based on active editor

## Troubleshooting

### Common Issues
- **"Missing script" errors**: Run `pnpm install` first to set up package.json scripts
- **TypeScript compilation errors**: Check `tsconfig.json` configuration and source files in `src/`
- **Package warnings about repository**: Ignore if repository field is present in package.json
- **Package warnings about activation events**: Use `--allow-star-activation` flag (already in script)

### Environment Limitations
- VS Code IDE is not available - cannot test F5 extension debugging
- Extension cannot be run interactively - can only validate compilation and packaging
- No linting or formatting tools configured - manual code review required

### Build Artifacts
- `out/` directory contains compiled JavaScript and source maps
- `*.vsix` files are the packaged extension ready for installation
- `node_modules/` contains dependencies (excluded from git)
- `pnpm-lock.yaml` ensures reproducible dependency installation

## Package Manager Notes
- This project uses **pnpm** (not npm or yarn)
- All commands should use `pnpm` not `npm`
- `pnpm install` creates `pnpm-lock.yaml` (committed to git)
- Global pnpm installation: `npm install -g pnpm`