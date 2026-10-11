// With no plugin window connected, a script is turned away within 10 seconds, not at its timeout.

const test = require('node:test');
const assert = require('node:assert/strict');
const { sleep, startBridge, run, plugin } = require('./stand-in');

test('a script sent with no plugin window is answered within 10 seconds', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());

  const answer = await run(bridge, { timeoutMs: 30000 });
  assert.equal(answer.status, 503);
  assert.equal(answer.body.kind, 'no-plugin');
  assert.ok(answer.ms <= 10500, `answered after ${answer.ms} ms`);
});

test('a plugin window that opens within those 10 seconds gets the script', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());

  const waiting = run(bridge, { timeoutMs: 30000 });
  await sleep(2000);
  const window = plugin(bridge, { session: 'w1' });
  t.after(() => window.stop());

  assert.equal((await waiting).status, 200);
});
