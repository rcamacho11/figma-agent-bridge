// Test helpers: a real bridge on a spare port, and a stand-in for the plugin window.
//
// The bridge writes its token beside itself, so each test copies bridge.js and run.js into a
// fresh temp folder and runs them from there. A bridge already running for Figma is not touched.

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

async function waitFor(check, ms, what) {
  const until = Date.now() + ms;
  for (;;) {
    if (await check()) return;
    if (Date.now() > until) throw new Error('Timed out waiting for ' + what + '.');
    await sleep(50);
  }
}

function status(base) {
  return fetch(base + '/status').then((r) => r.json(), () => null);
}

// A folder holding copies of bridge.js and run.js, and a port nothing listens on yet.
async function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-runner-'));
  for (const file of ['bridge.js', 'run.js']) fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
  const port = await freePort();
  return { dir, port, base: `http://127.0.0.1:${port}`, remove() { fs.rmSync(dir, { recursive: true, force: true }); } };
}

async function startBridge() {
  const bridge = await project();
  const child = spawn(process.execPath, [path.join(bridge.dir, 'bridge.js')], {
    env: Object.assign({}, process.env, { FIGMA_BRIDGE_PORT: String(bridge.port) }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  bridge.output = '';
  child.stdout.on('data', (chunk) => { bridge.output += chunk; });
  child.stderr.on('data', (chunk) => { bridge.output += chunk; });
  await waitFor(() => status(bridge.base), 5000, 'the bridge to listen');
  bridge.token = fs.readFileSync(path.join(bridge.dir, '.bridge-token'), 'utf8').trim();
  bridge.stop = () => { child.kill(); bridge.remove(); };
  return bridge;
}

// What run.js sends, without run.js: the answer's status, body and how long it took.
async function run(bridge, body) {
  const began = Date.now();
  const response = await fetch(bridge.base + '/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bridge-token': bridge.token },
    body: JSON.stringify(Object.assign({ code: 'return 1', label: 'script' }, body)),
  });
  return { status: response.status, body: await response.json(), ms: Date.now() - began };
}

// run.js itself, from the copied folder.
function runJs(bridge, args) {
  return new Promise((resolve) => {
    const began = Date.now();
    const child = spawn(process.execPath, [path.join(bridge.dir, 'run.js')].concat(args), {
      env: Object.assign({}, process.env, { FIGMA_BRIDGE_PORT: String(bridge.port) }),
    });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { out += chunk; });
    child.on('close', (code) => resolve({ code, out: out.trim(), ms: Date.now() - began }));
  });
}

// The plugin window: the poll loop of ui.html, with options.work(job, window) in place of Figma.
// work returns the fields of the result (value, ok, error, logs). Each script's start and end
// times land in window.spans, and the bridge's answer to its result in window.posted.
function plugin(bridge, options) {
  options = options || {};
  const control = new AbortController();
  const query = new URLSearchParams();
  if (options.session) query.set('session', options.session);
  if (options.file) query.set('file', options.file);
  const next = bridge.base + '/next' + (query.toString() ? '?' + query : '');
  const window = { polls: 0, answers: {}, spans: {}, posted: {} };

  window.export = (job, name, bytes) => fetch(bridge.base + '/export?id=' + job.id + '&name=' + encodeURIComponent(name), {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes,
  }).then((r) => r.status, () => 'failed');

  async function handle(job) {
    window.spans[job.label] = { start: Date.now() };
    const result = options.work ? await options.work(job, window) : {};
    window.spans[job.label].end = Date.now();
    window.posted[job.label] = await fetch(bridge.base + '/result', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(Object.assign({ id: job.id, ok: true, value: null, error: null, logs: [] }, result)),
    }).then((r) => r.status, () => 'failed');
  }

  (async () => {
    for (;;) {
      try {
        const response = await fetch(next, { signal: control.signal });
        window.polls++;
        window.answers[response.status] = (window.answers[response.status] || 0) + 1;
        if (response.status === 200) handle(await response.json()); else await response.arrayBuffer();
      } catch (e) {
        if (control.signal.aborted) return;
        await sleep(200);
      }
    }
  })();

  window.stop = () => control.abort();
  return window;
}

// Waits until the bridge sees a plugin window.
function connected(bridge) {
  return waitFor(() => status(bridge.base).then((s) => s && s.plugin === true), 5000, 'the plugin window to connect');
}

module.exports = { sleep, waitFor, status, project, startBridge, run, runJs, plugin, connected };
