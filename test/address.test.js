// The plugin window calls http://localhost, so the bridge answers on ::1 as well as 127.0.0.1.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startBridge } = require('./stand-in');

test('the bridge answers on ::1 and on 127.0.0.1', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());

  for (const host of ['127.0.0.1', '[::1]']) {
    const response = await fetch(`http://${host}:${bridge.port}/status`);
    assert.equal(response.status, 200, host);
  }
});
