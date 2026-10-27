import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const engines = process.env.HYGULAR_BROWSERS?.split(',').map(value => value.trim()) || ['chromium', 'firefox', 'webkit'];
const file = fileURLToPath(new URL('./contrast.mjs', import.meta.url));
let failed = false;
for (const engine of engines) {
  if (!['chromium', 'firefox', 'webkit'].includes(engine)) throw new Error(`Unknown browser: ${engine}`);
  const result = spawnSync(process.execPath, [file], {
    env: { ...process.env, HYGULAR_BROWSER: engine },
    stdio: 'inherit',
    timeout: 300000,
    killSignal: 'SIGKILL',
  });
  if (result.error || result.status !== 0) {
    failed = true;
    console.error(`${engine}: color checks failed${result.error?.code === 'ETIMEDOUT' ? ' (five-minute limit)' : ''}.`);
  }
}
process.exitCode = failed ? 1 : 0;
