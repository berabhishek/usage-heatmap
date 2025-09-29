import { discoverTestFiles, runAll } from './harness';

async function main() {
  const testDir = __dirname; // compiled to out/test
  const files = discoverTestFiles(testDir);
  for (const f of files) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(f);
  }
  const failures = await runAll();
  if (process.env.NODE_V8_COVERAGE) {
    console.log(`\nCoverage output written to: ${process.env.NODE_V8_COVERAGE}`);
  }
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
