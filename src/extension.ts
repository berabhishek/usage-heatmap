import * as vscode from 'vscode';
import { createGit, getRepoContext, getHeadHash, getCountsForAllLines } from './git';
import { applyHeatmapHighlights, clearActiveHighlightDecorations, disposeAllHighlightTypes } from './heatmap';
import { CONFIG_SCOPE, CONFIG_KEYS } from './constants';
import { clamp, errorMessage } from './utils';
import { readFeatureConfig, updateConfig } from './config';
import { createInfoDecorationType, buildInlineInfoDecoration, clearEditorDecorations } from './decorations';
import { buildCountsCacheKey, deleteDocCounts, setDocCounts, getDocCounts, clearAllDocCounts } from './cache';

/**
 * Decoration type used to render lightweight inline text (e.g. "(X changes)")
 * at the end of the current line selection. Created on activate and disposed
 * on deactivate.
 */
let infoDecorationType: vscode.TextEditorDecorationType;

// Cache last computed counts per document to avoid reapplying colors on selection changes
// Centralized in ./cache


export function activate(context: vscode.ExtensionContext) {
    console.log('Change Heatmap extension is now active.');

    infoDecorationType = createInfoDecorationType();

    let activeEditor = vscode.window.activeTextEditor;

    const updateDecorations = async (editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor) => {
        if (!editor) {
            return;
        }

        // Always clear previous decorations before recomputing
        clearEditorDecorations(editor, infoDecorationType);

        const { enableColor, enableText } = readFeatureConfig();
        if (!enableColor && !enableText) {
            return; // nothing to render
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!workspaceFolder) {
            return;
        }

        const git = createGit(workspaceFolder.uri.fsPath);
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
            return;
        }

        try {
            const { repoRoot, relPath, lineCount } = await getRepoContext(git, editor);
            if (lineCount <= 0) {
                return;
            }

            const selectionLine1 = editor.selection.active.line + 1; // 1-based
            const clampedLine1 = clamp(selectionLine1, 1, lineCount);

            // Compute edit counts for all lines (batched) and cache per HEAD
            const headHash = await getHeadHash(git);
            const cacheKey = buildCountsCacheKey(repoRoot, relPath, headHash);
            const counts = await getCountsForAllLines(git, relPath, lineCount, cacheKey);

            if (enableColor) {
                applyHeatmapHighlights(editor, counts);
            }

            if (enableText) {
                const historyCount = counts[clampedLine1 - 1] ?? 0;
                const infoText = `(${historyCount} changes)`;
                const infoDeco = buildInlineInfoDecoration(editor, clampedLine1 - 1, infoText);
                editor.setDecorations(infoDecorationType, [infoDeco]);
            }

            // Cache counts for this document so selection changes only update text
            try {
                setDocCounts(editor.document.uri, counts);
            } catch { /* noop */ }
        } catch (err: unknown) {
            const msg = errorMessage(err);
            if (msg) {
                vscode.window.showErrorMessage(`Git Blame Error: ${msg}`);
            }
            console.error('git blame failed', err);
        }
    };

    // Note: debouncing not needed for selection-only updates; keep full updates immediate

    // Update only the inline text for the current selection; do not recompute colors
    const updateSelectionInfoOnly = async (editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor) => {
        if (!editor) { return; }

        const { enableText } = readFeatureConfig();
        // Always clear previous info decoration
        try { editor.setDecorations(infoDecorationType, []); } catch { /* noop */ }
        if (!enableText) { return; }

        const selectionLine1 = editor.selection.active.line + 1; // 1-based
        const lineCount = editor.document.lineCount;
        const clampedLine1 = clamp(selectionLine1, 1, lineCount);

        let counts = getDocCounts(editor.document.uri);

        if (!counts || counts.length !== lineCount) {
            // Fallback: attempt to fetch from git cache (fast if already computed)
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
            if (!workspaceFolder) { return; }
            const git = createGit(workspaceFolder.uri.fsPath);
            const isRepo = await git.checkIsRepo();
            if (!isRepo) { return; }
            try {
                const { repoRoot, relPath } = await getRepoContext(git, editor);
                const headHash = await getHeadHash(git);
                const cacheKey = buildCountsCacheKey(repoRoot, relPath, headHash);
                counts = await getCountsForAllLines(git, relPath, lineCount, cacheKey);
                setDocCounts(editor.document.uri, counts);
            } catch {
                // If we fail to obtain counts, skip rendering text
                return;
            }
        }

        const historyCount = counts[clampedLine1 - 1] ?? 0;
        const infoText = `(${historyCount} changes)`;
        const infoDeco = buildInlineInfoDecoration(editor, clampedLine1 - 1, infoText);
        editor.setDecorations(infoDecorationType, [infoDeco]);
    };

    if (activeEditor) {
        updateDecorations(activeEditor);
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            updateDecorations(editor);
        }
    }, null, context.subscriptions);

    vscode.window.onDidChangeTextEditorSelection(event => {
        if (activeEditor && event.textEditor === activeEditor) {
            // Only update the inline information; keep color highlights intact
            updateSelectionInfoOnly(event.textEditor);
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            clearEditorDecorations(activeEditor, infoDecorationType);
            try { deleteDocCounts(activeEditor.document.uri); } catch { /* noop */ }
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument(document => {
        if (activeEditor && document === activeEditor.document) {
            updateDecorations(activeEditor);
        }
    }, null, context.subscriptions);

    // React to configuration changes that affect scaling or visibility
    vscode.workspace.onDidChangeConfiguration(e => {
        if (
            e.affectsConfiguration(`${CONFIG_SCOPE}.${CONFIG_KEYS.scale}`) ||
            e.affectsConfiguration(`${CONFIG_SCOPE}.${CONFIG_KEYS.exponentialGamma}`) ||
            e.affectsConfiguration(`${CONFIG_SCOPE}.${CONFIG_KEYS.enableColor}`) ||
            e.affectsConfiguration(`${CONFIG_SCOPE}.${CONFIG_KEYS.enableText}`)
        ) {
            disposeAllHighlightTypes();
            // Clear cached counts to force recomputation under new scaling/visibility
            try { clearAllDocCounts(); } catch { /* noop */ }
            if (activeEditor) {
                updateDecorations(activeEditor);
            }
        }
    }, null, context.subscriptions);

    // updateConfig now imported from ./config

    const clearAllDecorations = (editor?: vscode.TextEditor) => {
        const ed = editor ?? vscode.window.activeTextEditor;
        if (!ed) {
            return;
        }
        try { ed.setDecorations(infoDecorationType, []); } catch { /* noop */ }
        try { clearActiveHighlightDecorations(ed); } catch { /* noop */ }
        try { deleteDocCounts(ed.document.uri); } catch { /* noop */ }
    };

    // Commands: toggle color and text
    const toggleSetting = async (key: string, label: string) => {
        const cfg = vscode.workspace.getConfiguration(CONFIG_SCOPE);
        const current = cfg.get<boolean>(key as any, true);
        await updateConfig(key, !current);
        vscode.window.setStatusBarMessage(`Heatmap ${label} ${!current ? 'enabled' : 'disabled'}`, 2000);
        clearAllDecorations(activeEditor);
        if (activeEditor) {
            updateDecorations(activeEditor);
        }
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('changeHeatmap.toggleColor', async () => {
            await toggleSetting(CONFIG_KEYS.enableColor, 'color');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('changeHeatmap.toggleText', async () => {
            await toggleSetting(CONFIG_KEYS.enableText, 'text');
        })
    );

    // Unified toggle: turns both color and text on/off together
    context.subscriptions.push(
        vscode.commands.registerCommand('changeHeatmap.toggle', async () => {
            const cfg = vscode.workspace.getConfiguration(CONFIG_SCOPE);
            const color = cfg.get<boolean>(CONFIG_KEYS.enableColor, true);
            const text = cfg.get<boolean>(CONFIG_KEYS.enableText, true);
            const newState = !(color && text); // both on -> off, otherwise turn on both
            await Promise.all([
                updateConfig(CONFIG_KEYS.enableColor, newState),
                updateConfig(CONFIG_KEYS.enableText, newState),
            ]);
            vscode.window.setStatusBarMessage(`Heatmap ${newState ? 'enabled' : 'disabled'}`, 2000);
            clearAllDecorations(activeEditor);
            if (activeEditor) {
                updateDecorations(activeEditor);
            }
        })
    );
}

export function deactivate() {
    if (infoDecorationType) {
        vscode.window.visibleTextEditors.forEach(editor => {
            if (editor && editor.document) {
                editor.setDecorations(infoDecorationType, []);
            }
        });
        infoDecorationType.dispose();
    }
    disposeAllHighlightTypes();
}
