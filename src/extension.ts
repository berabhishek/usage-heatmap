import * as vscode from 'vscode';
import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import { debounce } from './debounce';

let decorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "GitLens Clone" is now active!');

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
            // Use git.raw to run blame for the current line
            const line = editor.selection.active.line;
            const filePath = editor.document.fileName;
            // git blame -p -L <line+1>,<line+1> -- <file>
            const blameOutput = await git.raw([
                'blame',
                '-p',
                `-L`, `${line + 1},${line + 1}`,
                '--',
                filePath
            ]);

            // Parse the output for author, date, and summary
            // Example output:
            // <commit> <orig-line> <final-line> <num-lines>
            // author <author>
            // author-time <timestamp>
            // author-tz <tz>
            // summary <summary>
            // ...
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

            const blameOutputForLog = await git.raw([
                'log',
                '--pretty=format:"%h - %an, %ar : %s"',
                `-L`, `${line + 1},${line + 1}`,
                '--',
                filePath
            ]);
            const logLines = blameOutputForLog.split('\n').filter(logLine => logLine.trim() !== '');
            const historyCount = logLines.length;

            if (author || date || summary) {
                const decoration: vscode.DecorationOptions = {
                    range: new vscode.Range(line, 0, line, 0),
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
            // Show a user-friendly error message, but only if it's a real error
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
    // Clear decorations on all visible editors before disposing
    if (decorationType) {
        vscode.window.visibleTextEditors.forEach(editor => {
            // It's possible the editor has been closed, so we check for its existence.
            if (editor && editor.document) {
                editor.setDecorations(decorationType, []);
            }
        });
        decorationType.dispose();
    }
}