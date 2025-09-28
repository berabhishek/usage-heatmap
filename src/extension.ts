import * as vscode from 'vscode';
import { debounce } from './debounce';
import { createGit, getRepoContext, getHeadHash, getCountsForAllLines } from './git';
import { applyHeatmapHighlights, clearActiveHighlightDecorations, disposeAllHighlightTypes } from './heatmap';

let infoDecorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
    console.log('Usage Heatmap extension is now active.');

    infoDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1em',
            textDecoration: 'none',
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    });

    let activeEditor = vscode.window.activeTextEditor;
    

    const updateDecorations = async (editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor) => {
        if (!editor) {
            return;
        }

        // Clear existing decorations
        editor.setDecorations(infoDecorationType, []);
        clearActiveHighlightDecorations(editor);

        const cfg = vscode.workspace.getConfiguration('usageHeatmap');
        const enableColor = cfg.get<boolean>('enableColor', true);
        const enableText = cfg.get<boolean>('enableText', true);

        // If both features are disabled, skip work after clearing
        if (!enableColor && !enableText) {
            return;
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

            // Clamp selection line to valid range to avoid git fatal errors
            const selectionLine = editor.selection.active.line + 1;
            const line0 = Math.min(Math.max(1, selectionLine), lineCount);

            // ---- compute edit counts for all lines (batched) ----
            const headHash = await getHeadHash(git);
            const cacheKey = `${repoRoot}::${relPath}::${headHash}`;
            const counts = await getCountsForAllLines(git, relPath, lineCount, cacheKey);
            const historyCount = counts[line0 - 1] ?? 0;

            // Apply background highlights for all lines at once, grouped by color bin
            if (enableColor) {
                applyHeatmapHighlights(editor, counts);
            }

            if (enableText) {
                // Apply info text: only the number of changes
                const infoText = `(${historyCount} changes)`;
                // Place decoration at the end of the selected line so it appears after the text
                const lineIndex = line0 - 1;
                const lineEndChar = editor.document.lineAt(lineIndex).range.end.character;
                const infoDecoration: vscode.DecorationOptions = {
                    range: new vscode.Range(lineIndex, lineEndChar, lineIndex, lineEndChar),
                    renderOptions: {
                        after: {
                            contentText: infoText,
                            color: new vscode.ThemeColor('disabledForeground'),
                            fontStyle: 'italic',
                        },
                    },
                };
                editor.setDecorations(infoDecorationType, [infoDecoration]);
            }
        } catch (err: any) {
            if (err && err.message) {
                vscode.window.showErrorMessage(`Git Blame Error: ${err.message}`);
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
            activeEditor.setDecorations(infoDecorationType, []);
            clearActiveHighlightDecorations(activeEditor);
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument(document => {
        if (activeEditor && document === activeEditor.document) {
            updateDecorations(activeEditor);
        }
    }, null, context.subscriptions);

    // React to configuration changes that affect scaling
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

    // Commands: toggle color and text
    context.subscriptions.push(
        vscode.commands.registerCommand('usageHeatmap.toggleColor', async () => {
            const cfg = vscode.workspace.getConfiguration('usageHeatmap');
            const current = cfg.get<boolean>('enableColor', true);
            await cfg.update('enableColor', !current, vscode.ConfigurationTarget.Global);
            vscode.window.setStatusBarMessage(`Heatmap color ${!current ? 'enabled' : 'disabled'}`, 2000);
            if (activeEditor) {
                updateDecorations(activeEditor);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('usageHeatmap.toggleText', async () => {
            const cfg = vscode.workspace.getConfiguration('usageHeatmap');
            const current = cfg.get<boolean>('enableText', true);
            await cfg.update('enableText', !current, vscode.ConfigurationTarget.Global);
            vscode.window.setStatusBarMessage(`Heatmap text ${!current ? 'enabled' : 'disabled'}`, 2000);
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
            // If both are on, turn both off; otherwise turn both on
            const newState = !(color && text);
            await cfg.update('enableColor', newState, vscode.ConfigurationTarget.Global);
            await cfg.update('enableText', newState, vscode.ConfigurationTarget.Global);
            vscode.window.setStatusBarMessage(`Heatmap ${newState ? 'enabled' : 'disabled'}`, 2000);
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
