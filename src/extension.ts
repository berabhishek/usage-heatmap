import * as vscode from 'vscode';
import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import { debounce } from './debounce';
import * as path from 'path';

let decorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
    console.log('Usage Heatmap extension is now active.');

    decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 3em',
            textDecoration: 'none',
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    });

    let activeEditor = vscode.window.activeTextEditor;
    let git: SimpleGit | null = null;

    const updateDecorations = async (editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor) => {
        if (!editor) {
            return;
        }

        // Clear existing decorations
        editor.setDecorations(decorationType, []);

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!workspaceFolder) {
            return;
        }

        const options: Partial<SimpleGitOptions> = {
            baseDir: workspaceFolder.uri.fsPath,
            binary: 'git',
            maxConcurrentProcesses: 6,
        };
        git = simpleGit(options);

        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
            return;
        }

        try {
            const repoRoot = await git.revparse(['--show-toplevel']);
            const absPath = editor.document.uri.fsPath;
            const relPath = path.relative(repoRoot, absPath).split(path.sep).join('/');

            const line0 = editor.selection.active.line + 1;

            // ---- blame ----
            const blameOutput = await git.raw([
                'blame',
                '-p',
                '-L', `${line0},${line0}`,
                '--',
                relPath,
            ]);

            let author = '';
            let date = '';
            let summary = '';
            const lines = blameOutput.split('\n');
            for (const l of lines) {
                if (l.startsWith('author ')) {
                    author = l.replace('author ', '').trim();
                } else if (l.startsWith('author-time ')) {
                    const timestamp = parseInt(l.replace('author-time ', '').trim(), 10);
                    date = new Date(timestamp * 1000).toLocaleDateString();
                } else if (l.startsWith('summary ')) {
                    summary = l.replace('summary ', '').trim();
                }
            }

            // ---- log history for that line ----
            const logRangeArg = `${line0},${line0}:${relPath}`;
            const blameLog = await git.raw([
                'log',
                '--no-patch',
                '--pretty=%H',
                '-L', logRangeArg,
            ]);
            const historyCount = blameLog.trim() ? blameLog.trim().split('\n').length : 0;

            if (author || date || summary) {
                const decoration: vscode.DecorationOptions = {
                    range: new vscode.Range(line0 - 1, 0, line0 - 1, 0),
                    renderOptions: {
                        after: {
                            contentText: `  (Edited ${historyCount} times) ${summary}`,
                            color: new vscode.ThemeColor('disabledForeground'),
                            fontStyle: 'italic',
                        },
                    },
                };
                editor.setDecorations(decorationType, [decoration]);
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
            activeEditor.setDecorations(decorationType, []);
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument(document => {
        if (activeEditor && document === activeEditor.document) {
            updateDecorations(activeEditor);
        }
    }, null, context.subscriptions);
}

export function deactivate() {
    if (decorationType) {
        vscode.window.visibleTextEditors.forEach(editor => {
            if (editor && editor.document) {
                editor.setDecorations(decorationType, []);
            }
        });
        decorationType.dispose();
    }
}
