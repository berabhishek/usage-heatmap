import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    // Create a status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.color = '#808080'; // Faint grey color
    context.subscriptions.push(statusBarItem);

    // Update the status bar when the active editor changes
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar, null, context.subscriptions);
    vscode.window.onDidChangeTextEditorSelection(updateStatusBar, null, context.subscriptions);

    // Show status bar item
    updateStatusBar();
}

function updateStatusBar(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const position = editor.selection.active;
        const lineNumber = position.line + 1; // Convert 0-based to 1-based
        statusBarItem.text = `Line ${lineNumber}`;
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}