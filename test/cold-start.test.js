// run.js starts the bridge itself when nothing is listening, and leaves it running.

const test = require('node:test');
const assert = require('node:assert/strict');
const { project, status, runJs, plugin } = require('./stand-in');

test('run.js starts the bridge when it is not running', async (t) => {
  const bridge = await project();
  t.after(async () => {
    const left = await status(bridge.base);
    if (left && left.pid) process.kill(left.pid);
    bridge.remove();
  });
  // The plugin window is already open and keeps looking for the bridge, as in Figma.
  const window = plugin(bridge, { session: 'w1', work: async () => ({ value: 'drawn' }) });
  t.after(() => window.stop());

  const result = await runJs(bridge, ['-e', 'return 1']);
  assert.equal(result.code, 0, result.out);
  assert.equal(result.out, '"drawn"');

  const left = await status(bridge.base);
  assert.ok(left, 'the bridge is still listening after run.js has ended');
});

test('--status does not start the bridge', async (t) => {
  const bridge = await project();
  t.after(() => bridge.remove());

  const result = await runJs(bridge, ['--status']);
  assert.equal(result.code, 1);
  assert.match(result.out, /The bridge is not running/);
  assert.equal(await status(bridge.base), null);
});
