import * as vscode from 'vscode';
import { CONFIG_SCOPE, CONFIG_KEYS } from './constants';
import { errorMessage } from './utils';

export type FeatureConfig = {
  enableColor: boolean;
  enableText: boolean;
};

export function readFeatureConfig(): FeatureConfig {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SCOPE);
  return {
    enableColor: cfg.get<boolean>(CONFIG_KEYS.enableColor, true),
    enableText: cfg.get<boolean>(CONFIG_KEYS.enableText, true),
  };
}

export async function updateConfig(key: string, value: boolean) {
  try {
    const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    const target = hasWorkspace ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    const cfg = vscode.workspace.getConfiguration(CONFIG_SCOPE);
    await cfg.update(key, value, target);
  } catch (err: unknown) {
    const msg = errorMessage(err) || 'Failed to update configuration';
    vscode.window.showErrorMessage(msg);
  }
}

