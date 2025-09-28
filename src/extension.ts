import * as vscode from 'vscode';
import { debounce } from './debounce';
import { createGit, getRepoContext, getHeadHash, getCountsForAllLines } from './git';
import { applyHeatmapHighlights, clearActiveHighlightDecorations, disposeAllHighlightTypes } from './heatmap';

/**
 * Decoration type used to render lightweight inline text (e.g. "(X changes)")
 * at the end of the current line selection. Created on activate and disposed
 * on deactivate.
 */
let infoDecorationType: vscode.TextEditorDecorationType;

type FeatureConfig = {
    enableColor: boolean;
    enableText: boolean;
};

function readFeatureConfig(): FeatureConfig {
    const cfg = vscode.workspace.getConfiguration('usageHeatmap');
    return {
        enableColor: cfg.get<boolean>('enableColor', true),
        enableText: cfg.get<boolean>('enableText', true),
    };
}

function createInfoDecorationType(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1em',
            textDecoration: 'none',
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    });
}

function clampLine(oneBasedLine: number, min: number, max: number): number {
    return Math.min(Math.max(min, oneBasedLine), max);
}

function buildInlineInfoDecoration(editor: vscode.TextEditor, lineIndex0: number, text: string): vscode.DecorationOptions {
    const lineEndChar = editor.document.lineAt(lineIndex0).range.end.character;
    return {
        range: new vscode.Range(lineIndex0, lineEndChar, lineIndex0, lineEndChar),
        renderOptions: {
            after: {
                contentText: text,
                color: new vscode.ThemeColor('disabledForeground'),
                fontStyle: 'italic',
            },
        },
    };
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Usage Heatmap extension is now active.');

    infoDecorationType = createInfoDecorationType();

    let activeEditor = vscode.window.activeTextEditor;

    const updateDecorations = async (editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor) => {
        if (!editor) {
            return;
        }

        // Always clear previous decorations before recomputing
        try { editor.setDecorations(infoDecorationType, []); } catch { /* noop */ }
        try { clearActiveHighlightDecorations(editor); } catch { /* noop */ }

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
            const clampedLine1 = clampLine(selectionLine1, 1, lineCount);

            // Compute edit counts for all lines (batched) and cache per HEAD
            const headHash = await getHeadHash(git);
            const cacheKey = `${repoRoot}::${relPath}::${headHash}`;
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
        } catch (err: any) {
            const msg = String(err?.message || err || '');
            if (msg) {
                vscode.window.showErrorMessage(`Git Blame Error: ${msg}`);
            }
            console.error('git blame failed', err);
        }
    };

    const debouncedUpdateDecorations = debounce(updateDecorations, 500);

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
            debouncedUpdateDecorations(event.textEditor);
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            try { activeEditor.setDecorations(infoDecorationType, []); } catch { /* noop */ }
            try { clearActiveHighlightDecorations(activeEditor); } catch { /* noop */ }
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
            e.affectsConfiguration('usageHeatmap.scale') ||
            e.affectsConfiguration('usageHeatmap.exponentialGamma') ||
            e.affectsConfiguration('usageHeatmap.enableColor') ||
            e.affectsConfiguration('usageHeatmap.enableText')
        ) {
            disposeAllHighlightTypes();
            if (activeEditor) {
                updateDecorations(activeEditor);
            }
        }
    }, null, context.subscriptions);

    // Helper to update config at a meaningful target (workspace if present)
    const updateConfig = async (key: string, value: boolean) => {
        const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
        const target = hasWorkspace ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
        const cfg = vscode.workspace.getConfiguration('usageHeatmap');
        await cfg.update(key, value, target);
    };

    const clearAllDecorations = (editor?: vscode.TextEditor) => {
        const ed = editor ?? vscode.window.activeTextEditor;
        if (!ed) {
            return;
        }
        try { ed.setDecorations(infoDecorationType, []); } catch { /* noop */ }
        try { clearActiveHighlightDecorations(ed); } catch { /* noop */ }
    };

    // Commands: toggle color and text
    context.subscriptions.push(
        vscode.commands.registerCommand('usageHeatmap.toggleColor', async () => {
            const cfg = vscode.workspace.getConfiguration('usageHeatmap');
            const current = cfg.get<boolean>('enableColor', true);
            await updateConfig('enableColor', !current);
            vscode.window.setStatusBarMessage(`Heatmap color ${!current ? 'enabled' : 'disabled'}`, 2000);
            clearAllDecorations(activeEditor);
            if (activeEditor) {
                updateDecorations(activeEditor);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('usageHeatmap.toggleText', async () => {
            const cfg = vscode.workspace.getConfiguration('usageHeatmap');
            const current = cfg.get<boolean>('enableText', true);
            await updateConfig('enableText', !current);
            vscode.window.setStatusBarMessage(`Heatmap text ${!current ? 'enabled' : 'disabled'}`, 2000);
            clearAllDecorations(activeEditor);
            if (activeEditor) {
                updateDecorations(activeEditor);
            }
        })
    );

    // Unified toggle: turns both color and text on/off together
    context.subscriptions.push(
        vscode.commands.registerCommand('usageHeatmap.toggle', async () => {
            const cfg = vscode.workspace.getConfiguration('usageHeatmap');
            const color = cfg.get<boolean>('enableColor', true);
            const text = cfg.get<boolean>('enableText', true);
            const newState = !(color && text); // both on -> off, otherwise turn on both
            await Promise.all([
                updateConfig('enableColor', newState),
                updateConfig('enableText', newState),
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
