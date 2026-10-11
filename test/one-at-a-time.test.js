// One script per plugin window at a time, and a timed-out script keeps the window until it ends.
//
//   node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const { sleep, startBridge, run, plugin, connected } = require('./stand-in');

test('two scripts sent together run one after the other', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const window = plugin(bridge, { session: 'w1', work: async (job) => { await sleep(300); return { value: job.label }; } });
  t.after(() => window.stop());
  await connected(bridge);

  const answers = await Promise.all([run(bridge, { label: 'first' }), run(bridge, { label: 'second' })]);
  assert.deepEqual(answers.map((a) => a.status), [200, 200]);

  const spans = [window.spans.first, window.spans.second].sort((a, b) => a.start - b.start);
  assert.ok(spans[1].start >= spans[0].end, `the later script started ${spans[0].end - spans[1].start} ms before the earlier one ended`);
});

test('a script past its timeout keeps the window until it ends, and its late result is accepted', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const window = plugin(bridge, { session: 'w1', work: async (job) => { await sleep(job.label === 'slow' ? 1800 : 50); return {}; } });
  t.after(() => window.stop());
  await connected(bridge);

  const slow = run(bridge, { label: 'slow', timeoutMs: 1000 });
  await sleep(1200);
  const next = await run(bridge, { label: 'next' });
  const timedOut = await slow;

  assert.equal(timedOut.status, 504);
  assert.equal(timedOut.body.kind, 'still-running', 'run.js is told the script is still running, not that it failed');
  assert.equal(next.status, 200);
  assert.ok(window.spans.next.start >= window.spans.slow.end, 'the next script started while the timed-out one was still running');
  assert.equal(window.posted.slow, 200, 'the late result was refused');
});

test('a reopened plugin window drops the script the old window was running', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const old = plugin(bridge, { session: 'w1', work: () => new Promise(() => {}) });
  t.after(() => old.stop());
  await connected(bridge);

  const stuck = run(bridge, { label: 'stuck', timeoutMs: 30000 });
  await sleep(300);
  old.stop();
  const reopened = plugin(bridge, { session: 'w2' });
  t.after(() => reopened.stop());

  const dropped = await stuck;
  assert.equal(dropped.status, 502);
  assert.equal(dropped.body.kind, 'dropped');
  assert.equal((await run(bridge, { label: 'after' })).status, 200);
});
