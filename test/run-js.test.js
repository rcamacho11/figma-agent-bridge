// run.js against a real bridge: what it prints and how it exits.

const test = require('node:test');
const assert = require('node:assert/strict');
const { sleep, startBridge, runJs, plugin, connected } = require('./stand-in');

test('run.js prints the value a script returns', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const window = plugin(bridge, { session: 'w1', work: async () => ({ value: 42 }) });
  t.after(() => window.stop());
  await connected(bridge);

  const result = await runJs(bridge, ['-e', 'return 42']);
  assert.equal(result.code, 0);
  assert.equal(result.out, '42');
});

test('run.js exits with 2 when the script is still running at its timeout', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const window = plugin(bridge, { session: 'w1', work: async () => { await sleep(1500); return {}; } });
  t.after(() => window.stop());
  await connected(bridge);

  const result = await runJs(bridge, ['-e', 'return 1', '--timeout', '1']);
  assert.equal(result.code, 2);
  assert.match(result.out, /still running in Figma/);
});

test('run.js exits with 1 when the script fails', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const window = plugin(bridge, { session: 'w1', work: async () => ({ ok: false, error: 'tx is not defined' }) });
  t.after(() => window.stop());
  await connected(bridge);

  const result = await runJs(bridge, ['-e', 'return tx']);
  assert.equal(result.code, 1);
  assert.match(result.out, /Script failed: tx is not defined/);
});

test('--status tells a bridge without a plugin window from a connected one', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());

  const alone = await runJs(bridge, ['--status']);
  assert.equal(alone.code, 1);
  assert.match(alone.out, /Bridge is up, but the plugin is not connected/);

  const window = plugin(bridge, { session: 'w1' });
  t.after(() => window.stop());
  await connected(bridge);
  const both = await runJs(bridge, ['--status']);
  assert.equal(both.code, 0);
  assert.match(both.out, /Plugin connected/);
});
