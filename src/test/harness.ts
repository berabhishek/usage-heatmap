import * as path from 'path';
import * as fs from 'fs';

type TestCase = { name: string; fn: () => void | Promise<void> };
const tests: TestCase[] = [];

export function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

export async function runAll(): Promise<number> {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`✓ ${t.name}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${t.name}`);
      console.error(err);
    }
  }
  console.log(`\nTests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
  return failed;
}

export function discoverTestFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...discoverTestFiles(p));
    } else if (e.isFile() && /\.test\.js$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

