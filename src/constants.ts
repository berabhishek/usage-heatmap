import * as vscode from 'vscode';

// Centralized constants used across the extension
export const CONFIG_SCOPE = 'changeHeatmap';

export const CONFIG_KEYS = {
  enableColor: 'enableColor',
  enableText: 'enableText',
  scale: 'scale',
  exponentialGamma: 'exponentialGamma',
} as const;

export const THEME = {
  infoTextColor: new vscode.ThemeColor('disabledForeground'),
} as const;

