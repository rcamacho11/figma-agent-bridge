// A PNG is written to the out folder when it is exported, not when the script ends.

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { startBridge, run, plugin, connected } = require('./stand-in');

const PNG = Buffer.from('not really a png, the bridge does not look inside');

async function setUp(t, work) {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const window = plugin(bridge, { session: 'w1', work });
  t.after(() => window.stop());
  await connected(bridge);
  return { bridge, out: path.join(bridge.dir, 'out') };
}

test('a PNG is on disk as soon as it is exported, before the script ends', async (t) => {
  const seen = {};
  const { bridge, out } = await setUp(t, async (job, window) => {
    seen.status = await window.export(job, 'a.png', PNG);
    seen.onDisk = fs.existsSync(path.join(out, 'a.png'));
    return { value: 'done' };
  });

  const answer = await run(bridge, { outDir: out });
  assert.equal(seen.status, 200);
  assert.ok(seen.onDisk, 'a.png was not on disk while the script was still running');
  assert.deepEqual(answer.body.saved, [path.join(out, 'a.png')]);
  assert.deepEqual(fs.readFileSync(path.join(out, 'a.png')), PNG);
});

test('a script that fails keeps the PNGs it had already exported', async (t) => {
  const { bridge, out } = await setUp(t, async (job, window) => {
    await window.export(job, 'before.png', PNG);
    return { ok: false, error: 'tx is not defined' };
  });

  const answer = await run(bridge, { outDir: out });
  assert.equal(answer.body.ok, false);
  assert.ok(fs.existsSync(path.join(out, 'before.png')));
  assert.deepEqual(answer.body.saved, [path.join(out, 'before.png')]);
});

test('one PNG over the size limit does not take the others with it', async (t) => {
  const seen = {};
  const { bridge, out } = await setUp(t, async (job, window) => {
    seen.small = await window.export(job, 'small.png', PNG);
    seen.big = await window.export(job, 'big.png', Buffer.alloc(97 * 1024 * 1024));
    return {};
  });

  const answer = await run(bridge, { outDir: out });
  assert.equal(seen.small, 200);
  assert.notEqual(seen.big, 200);
  assert.equal(answer.status, 200);
  assert.deepEqual(fs.readdirSync(out), ['small.png']);
});

test('an export cannot be written outside the out folder', async (t) => {
  const { bridge, out } = await setUp(t, async (job, window) => {
    await window.export(job, '../../escaped.png', PNG);
    return {};
  });

  const answer = await run(bridge, { outDir: out });
  assert.deepEqual(answer.body.saved, [path.join(out, 'escaped.png')]);
});
