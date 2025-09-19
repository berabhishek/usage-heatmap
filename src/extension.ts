import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	// Create status bar item for showing current line number
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	
	// Set initial styling - faint grey color for subtlety
	statusBarItem.color = new vscode.ThemeColor('statusBar.foreground');
	statusBarItem.tooltip = 'Current cursor line number';
	
	// Function to update the status bar with current line number
	function updateLineNumber() {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const position = editor.selection.active;
			const lineNumber = position.line + 1; // Convert from 0-based to 1-based
			statusBarItem.text = `Line ${lineNumber}`;
			statusBarItem.show();
		} else {
			statusBarItem.hide();
		}
	}
	
	// Update immediately
	updateLineNumber();
	
	// Update when active editor changes
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			updateLineNumber();
		})
	);
	
	// Update when cursor position changes
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection((event) => {
			if (event.textEditor === vscode.window.activeTextEditor) {
				updateLineNumber();
			}
		})
	);
	
	// Add status bar item to subscriptions for proper disposal
	context.subscriptions.push(statusBarItem);
}

export function deactivate() {
	// Cleanup is handled automatically by VS Code through subscriptions
}