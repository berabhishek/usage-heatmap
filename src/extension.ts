import * as vscode from 'vscode';
import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';

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
    let debounceTimer: NodeJS.Timeout;

    function debounce(func: (...args: any[]) => void, delay: number) {
        return function(this: any, ...args: any[]) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    interface BlameInfo {
        line: {
            to: number;
            from: number;
        };
        author: string;
        date: string;
        summary: string;
    }

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
            const blame = await git.blame(['-p', '--', editor.document.fileName]);
            const line = editor.selection.active.line;
            const blameInfo = blame.all.find((b: BlameInfo) => b.line.to === line + 1);

            if (blameInfo) {
                const decoration: vscode.DecorationOptions = {
                    range: new vscode.Range(line, 0, line, 0),
                    renderOptions: {
                        after: {
                            contentText: `  (${blameInfo.author} ${blameInfo.date}) ${blameInfo.summary}`,
                            color: new vscode.ThemeColor('editor.foreground'),
                            fontStyle: 'italic',
                        },
                    },
                };
                editor.setDecorations(decorationType, [decoration]);
            }
        } catch (err) {
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
    clearTimeout(debounceTimer);
    // Clear decorations on all visible editors before disposing
    if (decorationType) {
        vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(decorationType, []);
        });
        decorationType.dispose();
    }
}