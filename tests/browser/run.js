import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const engines = process.env.HYGULAR_BROWSERS?.split(',') || ['chromium', 'firefox', 'webkit'];
const testFile = fileURLToPath(new URL('./ui.test.js', import.meta.url));
let failed = false;
for (const engine of engines) {
  if (!['chromium', 'firefox', 'webkit'].includes(engine)) throw new Error(`Unknown browser: ${engine}`);
  const result = spawnSync(process.execPath, ['--test', testFile], {
    env: { ...process.env, HYGULAR_BROWSERS: engine },
    stdio: 'inherit', timeout: 60000, killSignal: 'SIGKILL',
  });
  if (result.error || result.status !== 0) {
    failed = true;
    console.error(`${engine} failed${result.error?.code === 'ETIMEDOUT' ? ': exceeded the 60-second limit' : ''}.`);
  }
}
process.exitCode = failed ? 1 : 0;
