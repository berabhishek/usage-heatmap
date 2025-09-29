import { discoverTestFiles, runAll } from './harness';

export function run(): Promise<void> {
  return new Promise(async (c, e) => {
    try {
      const testDir = __dirname;
      const files = discoverTestFiles(testDir);
      for (const f of files) {
        require(f);
      }
      const failures = await runAll();
      if (failures > 0) {
        e(new Error(`${failures} tests failed.`));
      } else {
        c();
      }
    } catch (err) {
      e(err);
    }
  });
}
