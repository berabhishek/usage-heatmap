import { strict as assert } from 'assert';
import { test } from './harness';
import { readFeatureConfig, updateConfig } from '../config';
import * as vscode from 'vscode';
import { CONFIG_SCOPE, CONFIG_KEYS } from '../constants';

test('config.readFeatureConfig returns defaults when unset', () => {
  const cfg = readFeatureConfig();
  assert.equal(typeof cfg.enableColor, 'boolean');
  assert.equal(typeof cfg.enableText, 'boolean');
});

test('config.updateConfig updates workspace when workspace exists', async () => {
  (vscode.workspace as any).workspaceFolders = [{} as any];
  await updateConfig(CONFIG_KEYS.enableColor, false);
  const got = vscode.workspace.getConfiguration(CONFIG_SCOPE).get(CONFIG_KEYS.enableColor, true);
  assert.equal(got, false);
});

test('config.updateConfig updates global when no workspace', async () => {
  (vscode.workspace as any).workspaceFolders = undefined;
  await updateConfig(CONFIG_KEYS.enableText, false);
  const got = vscode.workspace.getConfiguration(CONFIG_SCOPE).get(CONFIG_KEYS.enableText, true);
  assert.equal(got, false);
});

