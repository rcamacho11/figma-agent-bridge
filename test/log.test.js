// The bridge prints one line per script and per plugin window.

const test = require('node:test');
const assert = require('node:assert/strict');
const { sleep, startBridge, run, plugin, connected } = require('./stand-in');

test('the bridge logs a window connecting, a script that passes and one that fails', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const window = plugin(bridge, {
    session: 'w1',
    file: 'Resume-x',
    work: async (job) => (job.label === 'screens.js' ? { ok: false, error: 'tx is not defined\n    at eval' } : {}),
  });
  t.after(() => window.stop());
  await connected(bridge);

  await run(bridge, { label: 'dashboard.js' });
  await run(bridge, { label: 'screens.js' });
  await sleep(100);

  assert.match(bridge.output, /Plugin window connected: Resume-x/);
  assert.match(bridge.output, /dashboard\.js: started in Resume-x/);
  assert.match(bridge.output, /dashboard\.js: done in \d+\.\d s, 0 export\(s\)/);
  assert.match(bridge.output, /screens\.js: failed in \d+\.\d s: tx is not defined\r?\n/);
});

test('the bridge logs a script turned away for want of a plugin window', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());

  await run(bridge, { label: 'dashboard.js', timeoutMs: 1000 });
  await sleep(100);
  assert.match(bridge.output, /dashboard\.js: not run, no plugin window connected/);
});
