// Each plugin window keeps its own poll, and a script only runs in the file it was sent to.

const test = require('node:test');
const assert = require('node:assert/strict');
const { sleep, status, startBridge, run, runJs, plugin, waitFor } = require('./stand-in');

async function twoWindows(t) {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const windows = {
    resume: plugin(bridge, { session: 'w1', file: 'Resume-x', work: async () => ({ value: 'Resume-x' }) }),
    landing: plugin(bridge, { session: 'w2', file: 'Landing page', work: async () => ({ value: 'Landing page' }) }),
  };
  t.after(() => { windows.resume.stop(); windows.landing.stop(); });
  await waitFor(() => status(bridge.base).then((s) => s && s.files && s.files.length === 2), 5000, 'both windows to connect');
  return { bridge, windows };
}

test('two plugin windows do not end each other\'s poll', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const one = plugin(bridge, { session: 'w1', file: 'Resume-x' });
  const two = plugin(bridge, { session: 'w2', file: 'Landing page' });
  t.after(() => { one.stop(); two.stop(); });

  await sleep(3000);
  assert.ok(one.polls <= 1 && two.polls <= 1, `answers in 3 seconds: ${one.polls} and ${two.polls}, expected 0 or 1 each`);
});

test('--status lists the file behind each window', async (t) => {
  const { bridge } = await twoWindows(t);
  const result = await runJs(bridge, ['--status']);
  assert.equal(result.code, 0);
  assert.match(result.out, /Resume-x/);
  assert.match(result.out, /Landing page/);
});

test('with two files connected and none named, the script is refused with the list', async (t) => {
  const { bridge, windows } = await twoWindows(t);
  const answer = await run(bridge, {});
  assert.equal(answer.status, 409);
  assert.equal(answer.body.kind, 'choose-file');
  assert.deepEqual(answer.body.files.slice().sort(), ['Landing page', 'Resume-x']);
  assert.deepEqual([windows.resume.spans, windows.landing.spans], [{}, {}], 'the script ran somewhere anyway');
});

test('a script sent to a named file runs in that file only', async (t) => {
  const { bridge, windows } = await twoWindows(t);
  const result = await runJs(bridge, ['-e', 'return 1', '--file', 'landing PAGE']);
  assert.equal(result.code, 0, result.out);
  assert.equal(result.out, '"Landing page"');
  assert.deepEqual(windows.resume.spans, {});
});

test('naming a file that is not connected is refused with the list', async (t) => {
  const { bridge } = await twoWindows(t);
  const result = await runJs(bridge, ['-e', 'return 1', '--file', 'Nowhere']);
  assert.equal(result.code, 1);
  assert.match(result.out, /Resume-x/);
});

test('with one window connected, no file needs naming', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.stop());
  const window = plugin(bridge, { session: 'w1', file: 'Resume-x', work: async () => ({ value: 'only one' }) });
  t.after(() => window.stop());
  await waitFor(() => status(bridge.base).then((s) => s && s.plugin), 5000, 'the window to connect');

  assert.equal((await run(bridge, {})).body.value, 'only one');
});
