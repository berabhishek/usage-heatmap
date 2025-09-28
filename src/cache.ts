import * as vscode from 'vscode';

// Cache of last computed counts for a document, keyed by document URI string
export const docCountsCache = new Map<string, number[]>();

export function docKey(uri: vscode.Uri): string {
  return uri.toString();
}

export function getDocCounts(uri: vscode.Uri): number[] | undefined {
  return docCountsCache.get(docKey(uri));
}

export function setDocCounts(uri: vscode.Uri, counts: number[]): void {
  docCountsCache.set(docKey(uri), counts);
}

export function deleteDocCounts(uri: vscode.Uri): void {
  docCountsCache.delete(docKey(uri));
}

export function clearAllDocCounts(): void {
  docCountsCache.clear();
}

export function buildCountsCacheKey(repoRoot: string, relPath: string, headHash: string): string {
  return `${repoRoot}::${relPath}::${headHash}`;
}

