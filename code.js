// Claude Script Runner: runs scripts sent from the local bridge inside the open Figma file.
//
// A script is the body of an async function with four names in scope:
//   figma      the Figma plugin API
//   h          the drawing helpers below
//   exportPng  exportPng(node, 'name.png', scale = 2), on disk in the --out folder when it returns.
//              Returns null when Figma did not render it within 15 seconds
//   log        log(...values), printed by run.js
// Whatever the script returns is sent back as the result.
//
// The sandbox is strict about syntax: no object spread, no ?. and no ?? in this file or in scripts.

figma.showUI(__html__, { width: 300, height: 168, themeColors: true });

var fontFamily = 'Inter';

function hex(c) {
  var s = String(c).replace('#', '');
  if (s.length === 3) s = s.split('').map(function (x) { return x + x; }).join('');
  var n = parseInt(s, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function paint(c, opacity) {
  if (!c) return [];
  return [{ type: 'SOLID', color: hex(c), opacity: opacity === undefined ? 1 : opacity }];
}

function pick(value, fallback) {
  return value === undefined || value === null ? fallback : value;
}

var h = {
  hex: hex,
  paint: paint,

  // Loads Regular, Medium and Bold of a family, falling back to Inter when it is missing.
  font: async function (family) {
    var styles = ['Regular', 'Medium', 'Bold'];
    try {
      for (var i = 0; i < styles.length; i++) await figma.loadFontAsync({ family: family || 'Inter', style: styles[i] });
      fontFamily = family || 'Inter';
    } catch (e) {
      for (var j = 0; j < styles.length; j++) await figma.loadFontAsync({ family: 'Inter', style: styles[j] });
      fontFamily = 'Inter';
    }
    return fontFamily;
  },

  // Finds or creates a page by name and makes it current.
  page: async function (name) {
    var found = null;
    for (var i = 0; i < figma.root.children.length; i++) {
      if (figma.root.children[i].name === name) found = figma.root.children[i];
    }
    if (!found) { found = figma.createPage(); found.name = name; }
    await figma.setCurrentPageAsync(found);
    return found;
  },

  // A top-level frame to draw on. Re-running a script replaces the board of the same name.
  board: function (o) {
    var page = figma.currentPage;
    var x = 0;
    var kept = [];
    for (var i = 0; i < page.children.length; i++) {
      var child = page.children[i];
      if (child.name === o.name) { x = child.x; kept.push(child); }
    }
    if (kept.length === 0) {
      for (var j = 0; j < page.children.length; j++) {
        x = Math.max(x, page.children[j].x + page.children[j].width + 120);
      }
    }
    for (var k = 0; k < kept.length; k++) kept[k].remove();
    var f = figma.createFrame();
    f.name = o.name;
    f.resize(o.w, o.h);
    f.x = x;
    f.y = 0;
    f.fills = paint(pick(o.fill, '#ffffff'));
    f.clipsContent = true;
    return f;
  },

  frame: function (parent, o) {
    var f = figma.createFrame();
    f.name = pick(o.name, 'Frame');
    f.resize(o.w, o.h);
    f.x = pick(o.x, 0);
    f.y = pick(o.y, 0);
    f.fills = paint(o.fill);
    f.strokes = paint(o.stroke);
    f.strokeWeight = pick(o.strokeWeight, 1);
    f.cornerRadius = pick(o.radius, 0);
    if (o.dashed) f.dashPattern = [4, 4];
    f.clipsContent = false;
    parent.appendChild(f);
    return f;
  },

  text: function (parent, str, o) {
    o = o || {};
    var t = figma.createText();
    t.fontName = { family: fontFamily, style: pick(o.weight, 'Regular') };
    t.characters = String(str);
    t.fontSize = pick(o.size, 12);
    t.fills = paint(pick(o.color, '#202124'));
    t.textAlignHorizontal = pick(o.align, 'LEFT');
    if (o.width) { t.textAutoResize = 'HEIGHT'; t.resize(o.width, t.height); }
    t.x = pick(o.x, 0);
    t.y = pick(o.y, 0);
    parent.appendChild(t);
    return t;
  },

  // A rounded box with a centred title and an optional second line.
  box: function (parent, o) {
    var f = figma.createFrame();
    f.name = pick(o.name, o.title);
    f.layoutMode = 'VERTICAL';
    f.primaryAxisSizingMode = 'FIXED';
    f.counterAxisSizingMode = 'FIXED';
    f.primaryAxisAlignItems = 'CENTER';
    f.counterAxisAlignItems = 'CENTER';
    f.itemSpacing = 2;
    f.paddingLeft = 8; f.paddingRight = 8; f.paddingTop = 6; f.paddingBottom = 6;
    f.resize(o.w, o.h);
    f.x = o.x;
    f.y = o.y;
    f.fills = paint(pick(o.fill, '#ffffff'));
    f.strokes = paint(pick(o.stroke, '#5f6368'));
    f.strokeWeight = pick(o.strokeWeight, 1);
    f.cornerRadius = pick(o.radius, 8);
    if (o.dashed) f.dashPattern = [4, 4];
    parent.appendChild(f);
    h.text(f, o.title, { size: pick(o.size, 13), weight: 'Medium', color: pick(o.color, '#202124'), align: 'CENTER', width: o.w - 16 });
    if (o.sub) h.text(f, o.sub, { size: 11, color: pick(o.subColor, '#5f6368'), align: 'CENTER', width: o.w - 16 });
    return f;
  },

  // A polyline through o.points ([[x, y], ...]) with an arrowhead on the last point,
  // and on the first too when o.both is set. o.label sits on the middle of the longest segment.
  arrow: async function (parent, o) {
    var pts = o.points;
    var minX = pts[0][0], minY = pts[0][1];
    for (var i = 1; i < pts.length; i++) { minX = Math.min(minX, pts[i][0]); minY = Math.min(minY, pts[i][1]); }
    var vertices = [];
    var segments = [];
    for (var j = 0; j < pts.length; j++) {
      var cap = 'NONE';
      if (j === pts.length - 1 && !o.plain) cap = 'ARROW_EQUILATERAL';
      if (j === 0 && o.both) cap = 'ARROW_EQUILATERAL';
      vertices.push({ x: pts[j][0] - minX, y: pts[j][1] - minY, strokeCap: cap });
      if (j > 0) segments.push({ start: j - 1, end: j });
    }
    var v = figma.createVector();
    v.name = pick(o.name, pick(o.label, 'Arrow'));
    parent.appendChild(v);
    var network = { vertices: vertices, segments: segments, regions: [] };
    if (v.setVectorNetworkAsync) await v.setVectorNetworkAsync(network); else v.vectorNetwork = network;
    v.x = minX;
    v.y = minY;
    v.fills = [];
    v.strokes = paint(pick(o.color, '#5f6368'));
    v.strokeWeight = pick(o.weight, 1.25);
    if (o.dashed) v.dashPattern = [5, 4];

    if (o.label) {
      var best = 0, bestLength = -1;
      for (var k = 1; k < pts.length; k++) {
        var length = Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]);
        if (length > bestLength) { bestLength = length; best = k; }
      }
      var chip = figma.createFrame();
      chip.name = o.label;
      chip.layoutMode = 'HORIZONTAL';
      chip.primaryAxisSizingMode = 'AUTO';
      chip.counterAxisSizingMode = 'AUTO';
      chip.paddingLeft = 4; chip.paddingRight = 4; chip.paddingTop = 1; chip.paddingBottom = 1;
      chip.fills = paint(pick(o.labelFill, '#ffffff'));
      parent.appendChild(chip);
      h.text(chip, o.label, { size: 11, color: pick(o.labelColor, '#202124') });
      chip.x = Math.round((pts[best][0] + pts[best - 1][0]) / 2 - chip.width / 2);
      chip.y = Math.round((pts[best][1] + pts[best - 1][1]) / 2 - chip.height / 2);
    }
    return v;
  }
};

function describe(value, depth) {
  depth = depth || 0;
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object' && typeof value.id === 'string' && typeof value.type === 'string') {
    return { id: value.id, name: value.name, type: value.type };
  }
  if (depth > 3) return String(value);
  if (Array.isArray(value)) return value.map(function (item) { return describe(item, depth + 1); });
  if (typeof value === 'object') {
    var out = {};
    Object.keys(value).forEach(function (key) { out[key] = describe(value[key], depth + 1); });
    return out;
  }
  return String(value);
}

var EXPORT_WAIT_MS = 15000;

// Exports waiting for the plugin window to say the bridge has written the file, by key.
var uploads = {};
var uploadCount = 0;

// Hands a PNG to the plugin window, which posts it to the bridge. Settles when the file is on disk,
// so a script that fails later keeps what it had exported.
function upload(jobId, name, bytes) {
  return new Promise(function (resolve, reject) {
    var key = jobId + ':' + (++uploadCount);
    uploads[key] = { resolve: resolve, reject: reject };
    figma.ui.postMessage({ type: 'export', key: key, id: jobId, name: name, bytes: bytes });
  });
}

async function run(job) {
  var logs = [];
  var log = function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var item = arguments[i];
      parts.push(typeof item === 'string' ? item : JSON.stringify(describe(item)));
    }
    logs.push(parts.join(' '));
  };
  var exportPng = async function (node, name, scale) {
    // Figma stalls an export while its window is minimised or covered, and a stalled export must
    // not take the whole script with it. Returns null when the export was skipped.
    var stalled = {};
    var timer = new Promise(function (resolve) { setTimeout(function () { resolve(stalled); }, EXPORT_WAIT_MS); });
    var bytes = await Promise.race([node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale || 2 } }), timer]);
    if (bytes === stalled) {
      log('Skipped the export of ' + name + ': Figma did not render it. Bring the Figma window to the front and run again.');
      return null;
    }
    await upload(job.id, name, bytes);
    return name;
  };

  var reply = { type: 'result', id: job.id, ok: true, value: null, error: null, logs: logs };
  try {
    var fn = eval('(async function (figma, h, exportPng, log) {\n' + job.code + '\n})');
    reply.value = describe(await fn(figma, h, exportPng, log));
  } catch (e) {
    reply.ok = false;
    reply.error = String(e && e.message ? e.message : e) + (e && e.stack ? '\n' + e.stack : '');
  }
  figma.ui.postMessage(reply);
}

figma.ui.onmessage = function (message) {
  if (message && message.type === 'run') run(message);
  // The plugin window asks which file it is in, and passes the name on to the bridge.
  if (message && message.type === 'ready') figma.ui.postMessage({ type: 'hello', file: figma.root.name });
  if (message && message.type === 'export-saved' && uploads[message.key]) {
    var waiting = uploads[message.key];
    delete uploads[message.key];
    if (message.ok) waiting.resolve(); else waiting.reject(new Error('Could not save ' + message.name + ': ' + message.error));
  }
  if (message && message.type === 'close') figma.closePlugin();
};
