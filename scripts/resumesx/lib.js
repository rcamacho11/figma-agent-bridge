// resumesx design library: tokens, fonts and small builders shared by every resumesx script.
// Run it first, after icons.js:  node run.js icons.js lib.js <script>.js
//
// Colours are palettes.light and palettes.dark in frontend/src/theme/theme.ts, published as
// Figma variables in a "resumesx" collection under the same token names, so a fill in Figma
// reads as theme.app.<token> in code. Radii follow MUI: sx borderRadius N is N * 8px.

var LIGHT = {
  page: '#f8f9fa', surface: '#ffffff', surface2: '#f1f3f4', surface3: '#e8eaed', border: '#dadce0',
  ink: '#202124', ink2: '#5f6368', muted: '#80868b',
  accent: '#6D9654', accentHover: '#55783F', accentInk: '#ffffff',
  good: '#1F9986', warning: '#B5872B', critical: '#B04560', pending: '#5f6368'
};
var DARK = {
  page: '#202124', surface: '#292a2d', surface2: '#35363a', surface3: '#3c4043', border: '#3c4043',
  ink: '#e8eaed', ink2: '#9aa0a6', muted: '#80868b',
  accent: '#96BD7C', accentHover: '#ADCE96', accentInk: '#1b2117',
  good: '#4FA692', warning: '#C9A05C', critical: '#CB7E93', pending: '#9aa0a6'
};

// STATUS_META and STATUS_ICONS, SOURCE_ICONS from theme.ts and components/common.tsx.
var STATUS = {
  pending: { label: 'Pending', token: 'pending', icon: 'Schedule' },
  interview: { label: 'Interview', token: 'accent', icon: 'Forum' },
  offer: { label: 'Offer', token: 'good', icon: 'CheckCircle' },
  rejected: { label: 'Rejected', token: 'critical', icon: 'Cancel' },
  withdrawn: { label: 'Withdrawn', token: 'warning', icon: 'Undo' }
};
var STATUS_ORDER = ['pending', 'interview', 'offer', 'rejected', 'withdrawn'];
var SOURCE_ICON = {
  Indeed: 'Work', LinkedIn: 'BusinessCenter', Glassdoor: 'Visibility', Handshake: 'School',
  ZipRecruiter: 'Bolt', Greenhouse: 'Park', Other: 'Send'
};

var PAGE_COMPONENTS = 'resumesx / Components';
var PAGE_SCREENS = 'resumesx / Screens';

var V = {};
var VARS = { collection: null, lightId: null, darkId: null };
var FONT = { sans: 'Roboto', mono: 'Roboto Mono' };

async function loadFonts() {
  var styles = ['Regular', 'Medium'];
  for (var i = 0; i < styles.length; i++) await figma.loadFontAsync({ family: 'Roboto', style: styles[i] });
  try {
    for (var j = 0; j < styles.length; j++) await figma.loadFontAsync({ family: 'Roboto Mono', style: styles[j] });
  } catch (e) {
    FONT.mono = 'Roboto';
    log('Roboto Mono is not available in this Figma; numbers fall back to Roboto.');
  }
}

async function ensureVariables() {
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  var collection = collections.filter(function (c) { return c.name === 'resumesx'; })[0];
  if (!collection) collection = figma.variables.createVariableCollection('resumesx');
  var lightId = collection.modes[0].modeId;
  collection.renameMode(lightId, 'Light');
  var darkId = null;
  var dark = collection.modes.filter(function (m) { return m.name === 'Dark'; })[0];
  if (dark) darkId = dark.modeId;
  else {
    try { darkId = collection.addMode('Dark'); }
    catch (e) { log('Dark mode was not added (the Figma plan limits variable modes): ' + e.message); }
  }
  VARS.collection = collection; VARS.lightId = lightId; VARS.darkId = darkId;
  var existing = await figma.variables.getLocalVariablesAsync('COLOR');
  // Tint variables made on an earlier run are reused by name.
  existing.forEach(function (x) { if (x.variableCollectionId === collection.id) V[x.name] = x; });
  Object.keys(LIGHT).forEach(function (token) {
    var variable = existing.filter(function (x) { return x.variableCollectionId === collection.id && x.name === token; })[0];
    if (!variable) variable = figma.variables.createVariable(token, collection, 'COLOR');
    variable.setValueForMode(lightId, h.hex(LIGHT[token]));
    if (darkId) variable.setValueForMode(darkId, h.hex(DARK[token]));
    V[token] = variable;
  });
  return { collection: collection.name, modes: collection.modes.map(function (m) { return m.name; }) };
}

// A paint bound to a theme token. A tint (the alpha() a component applies over a token) is
// its own variable, "<token>-a<percent>", with the alpha stored in the variable: a paint
// opacity on a variable-bound paint does not survive into instances.
function fill(token, opacity) {
  var name = token;
  if (opacity !== undefined && opacity < 1) {
    name = token + '-a' + Math.round(opacity * 100);
    if (!V[name]) {
      var variable = figma.variables.createVariable(name, VARS.collection, 'COLOR');
      var light = h.hex(LIGHT[token]);
      variable.setValueForMode(VARS.lightId, { r: light.r, g: light.g, b: light.b, a: opacity });
      if (VARS.darkId) {
        var dark = h.hex(DARK[token]);
        variable.setValueForMode(VARS.darkId, { r: dark.r, g: dark.g, b: dark.b, a: opacity });
      }
      V[name] = variable;
    }
  }
  return [figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: h.hex(LIGHT[token]) }, 'color', V[name])];
}

function paintTo(node, prop, token, opacity) {
  node[prop] = fill(token, opacity);
}

// An auto-layout frame, or a component when o.component is set.
function box(o) {
  var n = o.component ? figma.createComponent() : figma.createFrame();
  n.name = o.name || 'Box';
  n.layoutMode = o.dir === 'V' ? 'VERTICAL' : 'HORIZONTAL';
  n.primaryAxisSizingMode = 'AUTO';
  n.counterAxisSizingMode = 'AUTO';
  n.itemSpacing = o.gap || 0;
  var pad = o.pad === undefined ? [0, 0, 0, 0] : (typeof o.pad === 'number' ? [o.pad, o.pad, o.pad, o.pad] : o.pad);
  n.paddingTop = pad[0]; n.paddingRight = pad[1]; n.paddingBottom = pad[2]; n.paddingLeft = pad[3];
  n.primaryAxisAlignItems = o.justify || 'MIN';
  n.counterAxisAlignItems = o.align || 'MIN';
  if (o.fill) paintTo(n, 'fills', o.fill, o.fillOpacity); else n.fills = [];
  if (o.stroke) {
    paintTo(n, 'strokes', o.stroke, o.strokeOpacity);
    n.strokeWeight = 1;
    n.strokeAlign = 'INSIDE';
    if (o.dashed) n.dashPattern = [4, 3];
    if (o.bottomOnly) { n.strokeTopWeight = 0; n.strokeLeftWeight = 0; n.strokeRightWeight = 0; n.strokeBottomWeight = 1; }
  }
  n.cornerRadius = o.radius || 0;
  n.clipsContent = o.clip === true;
  if (o.w || o.h) {
    var horizontal = n.layoutMode === 'HORIZONTAL';
    if (o.w) { if (horizontal) n.primaryAxisSizingMode = 'FIXED'; else n.counterAxisSizingMode = 'FIXED'; }
    if (o.h) { if (horizontal) n.counterAxisSizingMode = 'FIXED'; else n.primaryAxisSizingMode = 'FIXED'; }
    n.resize(o.w || n.width, o.h || n.height);
  }
  return n;
}

// Appends a child and sets how it sizes inside its auto-layout parent ('FILL', 'HUG' or 'FIXED').
function add(parent, child, sizeX, sizeY) {
  parent.appendChild(child);
  if (sizeX) child.layoutSizingHorizontal = sizeX;
  if (sizeY) child.layoutSizingVertical = sizeY;
  return child;
}

function tx(str, o) {
  o = o || {};
  var t = figma.createText();
  t.fontName = { family: o.mono ? FONT.mono : FONT.sans, style: o.weight || 'Regular' };
  t.characters = String(str);
  t.fontSize = o.size || 13;
  paintTo(t, 'fills', o.color || 'ink', o.opacity);
  if (o.ls) t.letterSpacing = { value: o.ls, unit: 'PIXELS' };
  if (o.lh) t.lineHeight = { value: o.lh, unit: 'PIXELS' };
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, t.height); }
  t.name = o.name || String(str);
  return t;
}

// A Material icon from ICONS (icons.js), sized like sx fontSize and coloured with a token.
function icon(name, size, token, opacity) {
  var paths = ICONS[name].map(function (d) { return '<path d="' + d + '"/>'; }).join('');
  var n = figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' + paths + '</svg>');
  n.name = 'Icon/' + name;
  n.findAll(function (x) { return x.type === 'VECTOR' || x.type === 'BOOLEAN_OPERATION'; }).forEach(function (v) { paintTo(v, 'fills', token || 'ink', opacity); });
  return n;
}

function space(hgt) {
  var s = figma.createFrame();
  s.name = 'space ' + hgt;
  s.resize(8, hgt);
  s.fills = [];
  return s;
}

// Finds a component or component set on the Components page by its React name.
async function component(name) {
  var page = figma.root.children.filter(function (p) { return p.name === PAGE_COMPONENTS; })[0];
  if (!page) throw new Error('Run components.js first: the page "' + PAGE_COMPONENTS + '" does not exist.');
  await page.loadAsync();
  var found = page.findOne(function (n) { return (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === name; });
  if (!found) throw new Error('No component named "' + name + '" on ' + PAGE_COMPONENTS + '.');
  return found;
}

// An instance of a component, or of the variant of a set that matches props ({ status: 'offer' }).
async function instance(name, props) {
  var c = await component(name);
  var inst = (c.type === 'COMPONENT_SET' ? c.defaultVariant : c).createInstance();
  if (props) inst.setProperties(props);
  return inst;
}

function setText(node, name, value) {
  var t = node.findOne(function (n) { return n.type === 'TEXT' && n.name === name; });
  if (!t) throw new Error('No text layer named "' + name + '" in ' + node.name + '.');
  t.characters = String(value);
  return t;
}

function setVisible(node, name, visible) {
  var n = node.findOne(function (x) { return x.name === name; });
  if (n) n.visible = visible;
}

// A MUI Button: contained by default, o.outlined or o.text otherwise. o.tone swaps the accent
// for another token (critical is MUI's color="error").
function action(label, o) {
  o = o || {};
  var disabled = o.disabled === true;
  var tone = o.tone || 'accent';
  var plain = o.outlined === true || o.text === true;
  var b = box({ name: label, gap: 8, align: 'CENTER', justify: 'CENTER', radius: 8, h: o.h, pad: o.large ? [8, 22, 8, 22] : (o.small ? [3, 9, 3, 9] : [6, 16, 6, 16]),
    fill: plain ? undefined : (disabled ? 'ink' : tone), fillOpacity: disabled ? 0.12 : 1,
    stroke: o.outlined ? (disabled ? 'ink' : tone) : undefined, strokeOpacity: disabled ? 0.12 : 0.5 });
  var color = disabled ? 'ink' : (plain ? tone : 'accentInk');
  var opacity = disabled ? 0.26 : 1;
  if (o.icon) b.appendChild(icon(o.icon, o.large ? 22 : (o.small ? 18 : 20), color, opacity));
  b.appendChild(tx(label, { name: 'label', size: o.large ? 14 : 12.5, weight: 'Medium', color: color, opacity: opacity, lh: 22 }));
  return b;
}

// An instance of the TextField component. o.placeholder greys the value; o.resting shows the
// label inside the field, which is how MUI draws an empty, unfocused field.
async function textField(kind, label, value, o) {
  o = o || {};
  var inst = await instance('TextField', { kind: kind });
  inst.name = label;
  setText(inst, 'label', label);
  var v = setText(inst, 'value', o.resting ? label : value);
  if (o.resting) { paintTo(v, 'fills', 'ink2'); setVisible(inst, 'label chip', false); }
  else if (o.placeholder) paintTo(v, 'fills', 'muted');
  return inst;
}

// Text that fills its parent's width and wraps.
function para(parent, str, o) {
  var t = tx(str, o);
  parent.appendChild(t);
  t.layoutSizingHorizontal = 'FILL';
  t.textAutoResize = 'HEIGHT';
  return t;
}

// Exports a PNG. exportPng gives up after 15 seconds and says so, since Figma stalls an export
// while its window is minimised or covered. True when the PNG was saved.
async function png(node, name, scale) {
  return (await exportPng(node, name, scale)) !== null;
}

await loadFonts();
var variablesInfo = await ensureVariables();
