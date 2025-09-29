import * as vscode from 'vscode';
import { THEME } from './constants';
import { clearActiveHighlightDecorations } from './heatmap';

export function createInfoDecorationType(): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 1em',
      textDecoration: 'none',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
  });
}

export function buildInlineInfoDecoration(
  editor: vscode.TextEditor,
  lineIndex0: number,
  text: string,
): vscode.DecorationOptions {
  const lineEndChar = editor.document.lineAt(lineIndex0).range.end.character;
  return {
    range: new vscode.Range(lineIndex0, lineEndChar, lineIndex0, lineEndChar),
    renderOptions: {
      after: {
        contentText: text,
        color: THEME.infoTextColor,
        fontStyle: 'italic',
      },
    },
  };
}

export function clearEditorDecorations(
  editor: vscode.TextEditor,
  infoDecorationType: vscode.TextEditorDecorationType,
) {
  try { editor.setDecorations(infoDecorationType, []); } catch { /* noop */ }
  try { clearActiveHighlightDecorations(editor); } catch { /* noop */ }
}

