// Sends a script to the open Figma file through the bridge and prints what came back.
//
//   node run.js <script.js> [more.js ...] [--out <folder>] [--timeout <seconds>] [--file <Figma file>]
//   node run.js -e "return figma.currentPage.name"
//   node run.js --status      no bridge, bridge without plugin, or plugin connected
//
// The bridge is started in the background when it is not running, and left running.
//
// PNGs the script exports with exportPng() are saved into --out (default: the current folder).
//
// Exit code: 0 done, 1 the script failed or could not be sent, 2 it passed its timeout and is
// still running in Figma.

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.FIGMA_BRIDGE_PORT || 3055);

function fail(message, code) {
  console.error(message);
  process.exit(code || 1);
}

// Plain http, not fetch: fetch gives up when an answer takes longer than 300 seconds, and a
// script may run for up to 600.
function request(method, pathname, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pathname, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new Error('The bridge sent an answer that could not be read.')); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function bridgeAnswers() {
  return request('GET', '/status').then(() => true, () => false);
}

// Starts bridge.js in the background when nothing answers on the port, and leaves it running
// for the next call. What it prints goes to .bridge.log, since it has no terminal of its own.
async function ensureBridge() {
  if (await bridgeAnswers()) return;
  const log = fs.openSync(path.join(__dirname, '.bridge.log'), 'a');
  spawn(process.execPath, [path.join(__dirname, 'bridge.js')], { detached: true, stdio: ['ignore', log, log], windowsHide: true }).unref();
  for (let tries = 0; tries < 25; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (await bridgeAnswers()) return;
  }
  fail('Could not start the bridge. See .bridge.log beside run.js.');
}

async function main() {
  const args = process.argv.slice(2);
  // Several files are joined in order and run as one script, so a shared library can come first.
  const files = [];
  let code = null, outDir = process.cwd(), timeout = 120, figmaFile = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--status') {
      // Only reports. It never starts the bridge, and exits with 0 only when a script could run now.
      if (!(await bridgeAnswers())) fail('The bridge is not running. It starts by itself with the next script.');
      const status = await request('GET', '/status');
      if (!status.plugin) fail('Bridge is up, but the plugin is not connected.');
      console.log('Plugin connected.');
      for (const name of status.files || []) console.log(`  ${name}`);
      return;
    }
    if (args[i] === '-e') code = args[++i];
    else if (args[i] === '--out') outDir = path.resolve(args[++i]);
    else if (args[i] === '--timeout') timeout = Number(args[++i]);
    // Needed only when the plugin window is open in more than one Figma file.
    else if (args[i] === '--file') figmaFile = args[++i];
    else files.push(args[i]);
  }
  const file = files.length ? files[files.length - 1] : null;
  if (files.length) code = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n;\n');
  if (!code) fail('Usage: node run.js <script.js> [--out <folder>] [--timeout <seconds>] [--file <Figma file>]');

  await ensureBridge();
  const token = fs.readFileSync(path.join(__dirname, '.bridge-token'), 'utf8').trim();

  const result = await request('POST', '/run', { 'Content-Type': 'application/json', 'x-bridge-token': token },
    JSON.stringify({ code, outDir, file: figmaFile, label: file ? path.basename(file) : 'inline script', timeoutMs: timeout * 1000 }));

  for (const line of result.logs || []) console.log(line);
  for (const saved of result.saved || []) console.log(`saved ${saved}`);
  if (result.kind === 'still-running') fail(`Timed out after ${timeout} seconds. ${result.error}`, 2);
  if (result.kind === 'choose-file' || result.kind === 'no-plugin') fail(result.error);
  if (!result.ok) fail(`Script failed: ${result.error}`);
  if (result.value !== null && result.value !== undefined) console.log(JSON.stringify(result.value, null, 2));
}

main().catch((e) => {
  fail(e && e.code === 'ECONNREFUSED' ? 'The bridge stopped answering. Run the script again to start it.' : String(e));
});
