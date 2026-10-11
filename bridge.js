// Local bridge between run.js and the Claude Script Runner plugin. No dependencies.
//
//   node bridge.js            listens on 127.0.0.1:3055
//
// run.js   -> POST /run      queues a script and waits for its result (needs the token)
// plugin   -> GET  /next     long-poll for the next script, one poll per plugin window
// plugin   -> POST /export   one PNG, written to the out folder at once
// plugin   -> POST /result   the script's result
// anyone   -> GET  /status   which plugin windows are connected, and the Figma file behind each
//
// /run only answers a caller that holds the token written to .bridge-token on start, and it
// sends no CORS headers, so a web page open in a browser cannot queue a script.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.FIGMA_BRIDGE_PORT || 3055);
const TOKEN_FILE = path.join(__dirname, '.bridge-token');
const MAX_BODY = 96 * 1024 * 1024;
const POLL_HOLD_MS = 25000;
// How long a script waits for a plugin window to show up. The window retries every 2 seconds.
const CONNECT_WAIT_MS = 10000;

const token = crypto.randomBytes(24).toString('hex');
fs.writeFileSync(TOKEN_FILE, token);

// One entry per open plugin window, keyed by the id the window made when it opened:
// { id, file, waiter, lastPoll, running, queue }. Each window runs one script at a time.
const windows = new Map();
// Scripts that arrived while no window was connected. A window that connects in time takes them.
const unplaced = [];
const pending = new Map();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// One line per event, to the terminal, or to .bridge.log when run.js started the bridge.
function log(line) {
  console.log(new Date().toLocaleTimeString('en-GB') + '  ' + line);
}

function seconds(since) {
  return ((Date.now() - since) / 1000).toFixed(1) + ' s';
}

function send(res, status, body, headers) {
  const text = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, headers || {}));
  res.end(text);
}

function readBody(req) {
  return readBytes(req).then((bytes) => bytes.toString('utf8'));
}

function readBytes(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error('Request body is too large.')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// A window is there while it holds a poll. Between polls it gets a few seconds, and longer
// while it runs a script, since heavy work in Figma can keep the window from polling.
function isLive(w) {
  return w.waiter !== null || Date.now() - w.lastPoll < (w.running ? POLL_HOLD_MS + 5000 : 5000);
}

function liveWindows() {
  return Array.from(windows.values()).filter(isLive);
}

function fileName(w) {
  return w.file || 'unnamed';
}

// Where a script goes: the one window, the window in the named file, nowhere yet, or refused.
// With more than one file connected the bridge never guesses.
function choose(wanted) {
  const live = liveWindows();
  if (live.length === 0) return { wait: true };
  if (wanted) {
    const match = live.filter((w) => w.file.toLowerCase() === wanted.toLowerCase());
    if (match.length === 1) return { window: match[0] };
    return { refuse: match.length === 0 ? `No connected plugin window is in a file named "${wanted}".` : `More than one connected plugin window is in a file named "${wanted}".` };
  }
  if (live.length === 1) return { window: live[0] };
  return { refuse: 'More than one Figma file is connected.' };
}

function refusal(reason) {
  const files = liveWindows().map(fileName);
  return { ok: false, kind: 'choose-file', error: `${reason} Connected: ${files.map((f) => `"${f}"`).join(', ')}. Name one with --file.`, files };
}

function enqueue(job, w) {
  clearTimeout(job.connectTimer);
  job.window = w;
  w.queue.push(job);
  handOver(w);
}

// Gives a window's waiting poll its next queued script, when there is one and the window is free.
function handOver(w) {
  if (w.running || !w.waiter || w.queue.length === 0) return;
  const res = w.waiter.res;
  clearTimeout(w.waiter.timer);
  w.waiter = null;
  w.running = w.queue.shift();
  w.running.startedAt = Date.now();
  log(`${w.running.label}: started in ${fileName(w)}`);
  send(res, 200, { id: w.running.id, code: w.running.code, label: w.running.label }, CORS);
}

// A script whose result or exports are still expected: pending, or timed out but still running.
function expecting(id) {
  if (pending.has(id)) return pending.get(id);
  for (const w of windows.values()) if (w.running && w.running.id === id) return w.running;
  return null;
}

// Writes one PNG into the script's out folder, at once, and remembers it for the final answer.
// Only the file name is kept, so an export cannot be written outside the out folder.
function saveExport(job, name, bytes) {
  const base = path.basename(String(name || 'export.png'));
  const file = path.join(job.outDir, base.toLowerCase().endsWith('.png') ? base : base + '.png');
  fs.mkdirSync(job.outDir, { recursive: true });
  fs.writeFileSync(file, bytes);
  job.saved.push(file);
  log(`${job.label}: saved ${file}`);
  return file;
}

function removeFrom(list, item) {
  const at = list.indexOf(item);
  if (at >= 0) list.splice(at, 1);
}

// Answers run.js for a script, once. A script answered while it runs keeps its window: see release.
function answer(job, status, body) {
  if (job.answered) return;
  job.answered = true;
  clearTimeout(job.timer);
  clearTimeout(job.connectTimer);
  pending.delete(job.id);
  removeFrom(unplaced, job);
  if (job.window) removeFrom(job.window.queue, job);
  send(job.res, status, body);
}

// Frees the script's window for the next script.
function release(job) {
  const w = job.window;
  if (!w) return;
  if (w.running === job) w.running = null;
  handOver(w);
}

// No plugin window showed up for the script.
function noPlugin(job) {
  log(`${job.label}: not run, no plugin window connected`);
  answer(job, 503, { ok: false, kind: 'no-plugin', error: 'The plugin window is not open. In Figma, run Plugins > Development > Claude Script Runner and keep its window open.' });
}

function timedOut(job) {
  const w = job.window;
  if (w && w.running === job) {
    // run.js gets its answer, but the script is still drawing. The window stays taken until the
    // result arrives or the window goes away, so the next script cannot start on top of it.
    log(`${job.label}: passed its timeout after ${seconds(job.startedAt)}, still running`);
    return answer(job, 504, { ok: false, kind: 'still-running', error: 'The script did not finish in time. It is still running in Figma, and the next script waits for it.' });
  }
  if (!w) return noPlugin(job);
  let error = 'The script did not start in time.';
  if (w.running) error = `The script did not start in time: "${w.running.label}" is still running in Figma.`;
  log(`${job.label}: not run, timed out waiting`);
  answer(job, 504, { ok: false, kind: 'queued', error });
}

// The plugin window was closed or reopened, so its scripts went with it.
function closeWindow(w) {
  windows.delete(w.id);
  log(`Plugin window gone: ${fileName(w)}`);
  for (const job of (w.running ? [w.running] : []).concat(w.queue)) log(`${job.label}: dropped with its plugin window`);
  if (w.waiter) { clearTimeout(w.waiter.timer); w.waiter.res.writeHead(204, CORS); w.waiter.res.end(); w.waiter = null; }
  if (w.running) answer(w.running, 502, { ok: false, kind: 'dropped', error: 'The plugin window was closed or reopened while the script was running.' });
  for (const job of w.queue.slice()) answer(job, 502, { ok: false, kind: 'dropped', error: 'The plugin window was closed before the script started.' });
}

setInterval(() => {
  for (const w of Array.from(windows.values())) if (!isLive(w)) closeWindow(w);
}, 2000).unref();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/run') {
      if (req.method !== 'POST' || req.headers['x-bridge-token'] !== token) return send(res, 403, { error: 'Forbidden.' });
      const body = JSON.parse(await readBody(req));
      if (typeof body.code !== 'string' || body.code.trim() === '') return send(res, 400, { error: 'No script was sent.' });
      const picked = choose(body.file);
      if (picked.refuse) return send(res, 409, refusal(picked.refuse));
      const id = crypto.randomUUID();
      const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 120000, 1000), 600000);
      const job = { id, code: body.code, label: body.label || 'script', file: body.file || '', outDir: body.outDir || process.cwd(), saved: [], res };
      job.timer = setTimeout(() => timedOut(job), timeoutMs);
      pending.set(id, job);
      if (picked.window) return enqueue(job, picked.window);
      // No plugin window in sight. Give it a moment to connect, then say so instead of letting
      // run.js sit until its timeout.
      unplaced.push(job);
      job.connectTimer = setTimeout(() => noPlugin(job), Math.min(CONNECT_WAIT_MS, timeoutMs));
      return;
    }

    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

    if (url.pathname === '/next' && req.method === 'GET') {
      const id = url.searchParams.get('session') || '';
      const file = url.searchParams.get('file') || '';
      let w = windows.get(id);
      if (!w) {
        // A window that reopens in a file takes the place of the one that stopped polling there.
        for (const other of Array.from(windows.values())) if (other.file === file && !other.waiter) closeWindow(other);
        w = { id, file, waiter: null, lastPoll: 0, running: null, queue: [] };
        windows.set(id, w);
        log(`Plugin window connected: ${fileName(w)}`);
      }
      w.file = file;
      w.lastPoll = Date.now();
      if (w.waiter) { clearTimeout(w.waiter.timer); w.waiter.res.writeHead(204, CORS); w.waiter.res.end(); w.waiter = null; }
      const mine = { res };
      mine.timer = setTimeout(() => {
        if (w.waiter === mine) w.waiter = null;
        res.writeHead(204, CORS);
        res.end();
      }, POLL_HOLD_MS);
      req.on('close', () => { if (w.waiter === mine) { clearTimeout(mine.timer); w.waiter = null; } });
      w.waiter = mine;
      for (const job of unplaced.slice()) {
        const picked = choose(job.file);
        if (picked.wait) continue;
        removeFrom(unplaced, job);
        if (picked.window) enqueue(job, picked.window); else answer(job, 409, refusal(picked.refuse));
      }
      handOver(w);
      return;
    }

    if (url.pathname === '/export' && req.method === 'POST') {
      const job = expecting(url.searchParams.get('id'));
      if (!job) return send(res, 404, { error: 'No script is waiting for that export.' }, CORS);
      const file = saveExport(job, url.searchParams.get('name'), await readBytes(req));
      return send(res, 200, { saved: file }, CORS);
    }

    if (url.pathname === '/result' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      // A script that timed out is no longer pending, but its result is still expected.
      const job = expecting(body.id);
      if (!job) return send(res, 404, { error: 'No script is waiting for that result.' }, CORS);
      // A plugin window from before /export still sends its PNGs here, all at the end.
      for (const item of body.exports || []) saveExport(job, item.name, Buffer.from(String(item.base64 || ''), 'base64'));
      const saved = job.saved;
      const late = job.answered ? ', after its timeout' : '';
      log(body.ok === true
        ? `${job.label}: done in ${seconds(job.startedAt)}, ${saved.length} export(s)${late}`
        : `${job.label}: failed in ${seconds(job.startedAt)}${late}: ${String(body.error).split('\n')[0]}`);
      send(res, 200, { saved: saved.length }, CORS);
      answer(job, 200, { ok: body.ok === true, value: body.value, error: body.error, logs: body.logs || [], saved });
      release(job);
      return;
    }

    if (url.pathname === '/status' && req.method === 'GET') {
      const live = liveWindows();
      const queued = unplaced.length + live.reduce((sum, w) => sum + w.queue.length, 0);
      return send(res, 200, { plugin: live.length > 0, files: live.map(fileName), queued, running: live.filter((w) => w.running).length, pid: process.pid }, CORS);
    }

    send(res, 404, { error: 'Not found.' });
  } catch (e) {
    send(res, 400, { error: String(e && e.message ? e.message : e) });
  }
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Is another bridge running?` : String(e));
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  log(`Figma bridge listening on http://127.0.0.1:${PORT}`);
});

// The plugin window calls http://localhost, which Windows resolves to ::1 before 127.0.0.1.
// Without a listener there, every connection first fails over, about 0.2 seconds each time.
const server6 = http.createServer((req, res) => server.emit('request', req, res));
server6.on('error', (e) => log(`Not listening on [::1]:${PORT} (${e.code}). localhost falls back to 127.0.0.1.`));
server6.listen(PORT, '::1');
