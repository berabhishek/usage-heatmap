import { strict as assert } from 'assert';
import { test } from './harness';
import { readFeatureConfig, updateConfig } from '../config';
import * as vscode from 'vscode';
import * as path from 'path';
import { CONFIG_KEYS } from '../constants';

test('config.readFeatureConfig returns defaults when unset', () => {
  const cfg = readFeatureConfig();
  assert.equal(typeof cfg.enableColor, 'boolean');
  assert.equal(typeof cfg.enableText, 'boolean');
});

const mockWorkspaceFolder = {
  uri: vscode.Uri.file(path.join(__dirname, 'test-workspace')),
  name: 'test-workspace',
  index: 0
};

test('config.updateConfig uses Workspace target when workspace exists', async () => {
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: [mockWorkspaceFolder],
    writable: true,
  });
  const originalGetConfiguration = vscode.workspace.getConfiguration;
  let received: { key?: string; value?: boolean; target?: vscode.ConfigurationTarget } = {};
  // Stub configuration to capture update target without relying on VS Code persistence
  (vscode.workspace as any).getConfiguration = () => ({
    get: (_k: string, def: any) => def,
    update: async (key: string, value: boolean, target: vscode.ConfigurationTarget) => {
      received = { key, value, target };
    },
  });
  try {
    await updateConfig(CONFIG_KEYS.enableColor, false);
    assert.equal(received.key, CONFIG_KEYS.enableColor);
    assert.equal(received.value, false);
    assert.equal(received.target, vscode.ConfigurationTarget.Workspace);
  } finally {
    (vscode.workspace as any).getConfiguration = originalGetConfiguration;
  }
});

test('config.updateConfig uses Global target when no workspace', async () => {
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: undefined,
    writable: true,
  });
  const originalGetConfiguration = vscode.workspace.getConfiguration;
  let received: { key?: string; value?: boolean; target?: vscode.ConfigurationTarget } = {};
  (vscode.workspace as any).getConfiguration = () => ({
    get: (_k: string, def: any) => def,
    update: async (key: string, value: boolean, target: vscode.ConfigurationTarget) => {
      received = { key, value, target };
    },
  });
  try {
    await updateConfig(CONFIG_KEYS.enableText, false);
    assert.equal(received.key, CONFIG_KEYS.enableText);
    assert.equal(received.value, false);
    assert.equal(received.target, vscode.ConfigurationTarget.Global);
  } finally {
    (vscode.workspace as any).getConfiguration = originalGetConfiguration;
  }
});
