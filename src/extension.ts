import * as vscode from 'vscode';
import { debounce } from './debounce';
import { createGit, getRepoContext, getHeadHash, getCountsForAllLines, blameLineMetadata } from './git';
import { applyHeatmapHighlights, clearActiveHighlightDecorations, disposeAllHighlightTypes } from './heatmap';

let infoDecorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
    console.log('Usage Heatmap extension is now active.');

    infoDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 3em',
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
            applyHeatmapHighlights(editor, counts);

            // ---- blame for metadata on the selected line (guarded) ----
            const { author, date, summary } = await blameLineMetadata(git, relPath, line0);

            // Apply info text (if we have anything meaningful)
            const infoText = `  (Edited ${historyCount} times)` +
                (summary ? ` ${summary}` : '') +
                (author ? ` · ${author}` : '') +
                (date ? ` · ${date}` : '');
            const infoDecoration: vscode.DecorationOptions = {
                range: new vscode.Range(line0 - 1, 0, line0 - 1, 0),
                renderOptions: {
                    after: {
                        contentText: infoText,
                        color: new vscode.ThemeColor('disabledForeground'),
                        fontStyle: 'italic',
                    },
                },
            };
            editor.setDecorations(infoDecorationType, [infoDecoration]);
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
        if (e.affectsConfiguration('usageHeatmap.scale') || e.affectsConfiguration('usageHeatmap.exponentialGamma')) {
            disposeAllHighlightTypes();
            if (activeEditor) {
                updateDecorations(activeEditor);
            }
        }
    }, null, context.subscriptions);
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
