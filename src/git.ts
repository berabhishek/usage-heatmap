import * as vscode from 'vscode';
import * as path from 'path';
import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';

/**
 * Basic info tying the current editor to a git repo context.
 */
export interface RepoContext {
  repoRoot: string;
  absPath: string;
  relPath: string;
  lineCount: number;
}

/**
 * Subset of blame metadata for a specific line.
 */
export interface LineMeta {
  author: string;
  date: string;
  summary: string;
}

// Cache per-file counts keyed by repo+path+HEAD
const fileCountsCache = new Map<string, { counts: number[] }>();

const SAFE_MAX_LINES = 1200; // Safety cap for very large files
const CONCURRENCY = 6; // Match simple-git maxConcurrentProcesses

export function createGit(baseDir: string): SimpleGit {
  const options: Partial<SimpleGitOptions> = {
    baseDir,
    binary: 'git',
    maxConcurrentProcesses: CONCURRENCY,
  };
  return simpleGit(options);
}

export async function getRepoContext(git: SimpleGit, editor: vscode.TextEditor): Promise<RepoContext> {
  const repoRoot = await git.revparse(['--show-toplevel']);
  const absPath = editor.document.uri.fsPath;
  const relPath = path.relative(repoRoot, absPath).split(path.sep).join('/');
  const lineCount = editor.document.lineCount;
  return { repoRoot, absPath, relPath, lineCount };
}

export async function getHeadHash(git: SimpleGit): Promise<string> {
  try {
    return await git.revparse(['HEAD']);
  } catch {
    return 'WORKTREE';
  }
}

export async function getCountsForAllLines(
  git: SimpleGit,
  relPath: string,
  lineCount: number,
  cacheKey: string,
): Promise<number[]> {
  const cached = fileCountsCache.get(cacheKey);
  if (cached && cached.counts.length === lineCount) {
    return cached.counts;
  }

  const effectiveLineCount = Math.min(lineCount, SAFE_MAX_LINES);

  const counts: number[] = new Array(effectiveLineCount).fill(0);

  const tasks: Array<() => Promise<void>> = [];
  for (let i = 1; i <= effectiveLineCount; i++) {
    const idx = i - 1;
    tasks.push(async () => {
      try {
        const rangeArg = `${i},${i}:${relPath}`;
        const out = await git.raw([
          'log',
          '--no-patch',
          '--pretty=%H',
          '-L', rangeArg,
        ]);
        const c = out.trim() ? out.trim().split('\n').length : 0;
        counts[idx] = c;
      } catch {
        // ignore per-line failures; keep default 0
        counts[idx] = 0;
      }
    });
  }

  // Execute in simple batches to avoid overloading git
  for (let start = 0; start < tasks.length; start += CONCURRENCY) {
    const slice = tasks.slice(start, Math.min(start + CONCURRENCY, tasks.length));
    await Promise.all(slice.map(fn => fn()));
  }

  if (lineCount > SAFE_MAX_LINES) {
    counts.length = lineCount;
    for (let i = SAFE_MAX_LINES; i < lineCount; i++) {
      counts[i] = 0;
    }
  }

  fileCountsCache.set(cacheKey, { counts: counts.slice() });
  return counts;
}

export async function blameLineMetadata(
  git: SimpleGit,
  relPath: string,
  line0: number,
): Promise<LineMeta> {
  let author = '';
  let date = '';
  let summary = '';
  try {
    const blameOutput = await git.raw([
      'blame',
      '-p',
      '-L', `${line0},${line0}`,
      '--',
      relPath,
    ]);
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
  } catch (blameErr: any) {
    const msg = String(blameErr?.message || blameErr || '');
    const benign = /has only \d+ line|no such path|exists on disk, but not in/.test(msg);
    if (!benign) {
      vscode.window.showErrorMessage(`Git Blame Error: ${msg}`);
    } else {
      console.warn('Benign blame error ignored:', msg);
    }
  }
  return { author, date, summary };
}
