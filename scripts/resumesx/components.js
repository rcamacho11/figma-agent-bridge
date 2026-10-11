// Builds the resumesx component library on the page "resumesx / Components".
// Every component is named after the React component it mirrors, and built from the sx
// values in that file, so a design made from these maps straight back to the code.
//
//   node run.js scripts/resumesx/icons.js scripts/resumesx/lib.js scripts/resumesx/components.js
//
// Re-running rebuilds the whole page, which breaks existing instances: re-run the screen
// scripts afterwards.

var page = await h.page(PAGE_COMPONENTS);
page.children.slice().forEach(function (n) { n.remove(); });

var sheet = box({ name: 'Library', dir: 'V', gap: 40, pad: 48, fill: 'page' });
figma.currentPage.appendChild(sheet);

function section(title, source) {
  var s = box({ name: title, dir: 'V', gap: 12 });
  var head = box({ name: 'heading', gap: 10, align: 'CENTER' });
  head.appendChild(tx(title, { size: 14, weight: 'Medium' }));
  head.appendChild(tx(source, { size: 11.5, color: 'muted', mono: true }));
  s.appendChild(head);
  sheet.appendChild(s);
  return s;
}

function variants(parent, name, list) {
  list.forEach(function (c) { parent.appendChild(c); });
  var set = figma.combineAsVariants(list, parent);
  set.name = name;
  set.layoutMode = 'HORIZONTAL';
  set.layoutWrap = 'WRAP';
  set.primaryAxisSizingMode = 'AUTO';
  set.counterAxisSizingMode = 'AUTO';
  set.itemSpacing = 16;
  set.counterAxisSpacing = 16;
  set.paddingTop = 16; set.paddingRight = 16; set.paddingBottom = 16; set.paddingLeft = 16;
  set.counterAxisAlignItems = 'CENTER';
  return set;
}

// ---- common.tsx ----------------------------------------------------------------------------

var common = section('Status, fit and source', 'components/common.tsx');

variants(common, 'StatusSelect', STATUS_ORDER.map(function (key) {
  var meta = STATUS[key];
  var c = box({ component: true, name: 'status=' + key, gap: 4, pad: [2, 4, 2, 8], radius: 999, align: 'CENTER', fill: meta.token, fillOpacity: 0.14 });
  c.appendChild(icon(meta.icon, 15, meta.token));
  c.appendChild(tx(meta.label, { name: 'label', size: 12, weight: 'Medium', color: meta.token, lh: 18 }));
  c.appendChild(icon('ArrowDropDown', 16, meta.token));
  return c;
}));

variants(common, 'FitPill', ['target', 'stretch'].map(function (key) {
  var target = key === 'target';
  var c = box({ component: true, name: 'fit=' + key, gap: 4, pad: [3, 8, 3, 8], radius: 999, align: 'CENTER', stroke: target ? 'accent' : 'border', strokeOpacity: target ? 0.45 : 1 });
  c.appendChild(icon(target ? 'Flag' : 'TrendingUp', 12, target ? 'accent' : 'muted'));
  c.appendChild(tx(target ? 'Target' : 'Stretch', { name: 'label', size: 10.5, weight: 'Medium', color: target ? 'accent' : 'muted', lh: 15 }));
  return c;
}));

variants(common, 'SourceTag', Object.keys(SOURCE_ICON).map(function (key) {
  var c = box({ component: true, name: 'source=' + key, gap: 5, align: 'CENTER' });
  c.appendChild(icon(SOURCE_ICON[key], 14, 'muted'));
  c.appendChild(tx(key, { name: 'label', size: 12, color: 'muted', lh: 18 }));
  return c;
}));

// ---- Buttons, as AppHeader.tsx and DashboardPage.tsx use them --------------------------------

var buttons = section('Buttons', 'components/AppHeader.tsx, pages/DashboardPage.tsx');

function button(kind, label, iconName) {
  var o = { component: true, name: 'kind=' + kind, gap: 8, align: 'CENTER', justify: 'CENTER', radius: 8 };
  var color = 'accent';
  if (kind === 'text') o.pad = [6, 8, 6, 4];
  if (kind === 'outlined') { o.pad = [5, 15, 5, 11]; o.stroke = 'accent'; o.strokeOpacity = 0.5; }
  if (kind === 'dashed') { o.pad = [9, 16, 9, 12]; o.stroke = 'border'; o.dashed = true; o.radius = 20; color = 'ink2'; }
  var c = box(o);
  var slot = box({ name: 'icon', align: 'CENTER', justify: 'CENTER' });
  slot.appendChild(icon(iconName, 20, color));
  c.appendChild(slot);
  c.appendChild(tx(label, { name: 'label', size: 12.5, weight: 'Medium', color: color, lh: 22 }));
  return c;
}

variants(buttons, 'Button', [
  button('text', 'Templates', 'Description'),
  button('outlined', 'New application', 'Bolt'),
  button('dashed', 'Add application', 'Add')
]);

var iconButton = box({ component: true, name: 'IconButton', w: 40, h: 40, align: 'CENTER', justify: 'CENTER', radius: 999 });
iconButton.appendChild(icon('AccountCircle', 24, 'ink2'));
buttons.appendChild(iconButton);

// ---- AppHeader.tsx -------------------------------------------------------------------------

var headerSection = section('AppHeader', 'components/AppHeader.tsx');
var header = box({ component: true, name: 'AppHeader', w: 1096, justify: 'SPACE_BETWEEN', align: 'CENTER', pad: [0, 0, 16, 0], stroke: 'border', bottomOnly: true });
var brand = box({ name: 'brand', gap: 10, align: 'CENTER' });
var tile = box({ name: 'tile', w: 32, h: 32, radius: 16, fill: 'accent', align: 'CENTER', justify: 'CENTER' });
tile.appendChild(icon('TrendingUp', 18, 'accentInk'));
brand.appendChild(tile);
var names = box({ name: 'names', dir: 'V' });
names.appendChild(tx('resumesx', { name: 'wordmark', size: 18, weight: 'Medium', ls: -0.1, lh: 27 }));
names.appendChild(tx('Dev User', { name: 'user', size: 12, color: 'ink2', lh: 18 }));
brand.appendChild(names);
header.appendChild(brand);
var actions = box({ name: 'actions', gap: 10, align: 'CENTER' });
var buttonSet = buttons.findOne(function (n) { return n.type === 'COMPONENT_SET' && n.name === 'Button'; });
function buttonInstance(kind) {
  return buttonSet.children.filter(function (c) { return c.name === 'kind=' + kind; })[0].createInstance();
}
actions.appendChild(buttonInstance('text'));
actions.appendChild(buttonInstance('outlined'));
actions.appendChild(iconButton.createInstance());
header.appendChild(actions);
headerSection.appendChild(header);

// ---- Search field, DashboardPage.tsx ---------------------------------------------------------

var searchSection = section('Search', 'pages/DashboardPage.tsx');
var search = box({ component: true, name: 'SearchField', w: 1096, h: 40, gap: 8, pad: [0, 14, 0, 14], radius: 8, align: 'CENTER', stroke: 'border' });
search.appendChild(icon('Search', 19, 'muted'));
search.appendChild(tx('Search company, role, source, status, fit…', { name: 'placeholder', size: 13, color: 'muted' }));
searchSection.appendChild(search);

// ---- KpiTiles.tsx --------------------------------------------------------------------------

var kpiSection = section('KpiTiles', 'components/KpiTiles.tsx');
var KPIS = [
  { label: 'Total sent', value: '12', icon: 'Send', token: 'accent' },
  { label: 'Awaiting response', value: '5', icon: 'Schedule', token: 'pending' },
  { label: 'Interviewing', value: '2', icon: 'Forum', token: 'accent' },
  { label: 'Offers', value: '1', icon: 'CheckCircle', token: 'good' },
  { label: 'Rejected', value: '3', icon: 'Cancel', token: 'critical' },
  { label: 'Response rate', value: '50%', icon: 'Insights', token: 'ink2' }
];
variants(kpiSection, 'KpiTile', KPIS.map(function (k) {
  var c = box({ component: true, name: 'kind=' + k.label, dir: 'V', w: 172, gap: 8, pad: [14, 16, 14, 16], radius: 24, fill: 'surface', stroke: 'border' });
  var top = box({ name: 'top', justify: 'SPACE_BETWEEN', align: 'CENTER', gap: 8 });
  top.appendChild(tx(k.label, { name: 'label', size: 12, weight: 'Medium', color: 'ink2', lh: 18 }));
  var badge = box({ name: 'badge', w: 30, h: 30, radius: 16, align: 'CENTER', justify: 'CENTER', fill: k.token, fillOpacity: 0.14 });
  badge.appendChild(icon(k.icon, 17, k.token));
  top.appendChild(badge);
  add(c, top, 'FILL');
  c.appendChild(tx(k.value, { name: 'value', size: 26, weight: 'Medium', mono: true, ls: -0.5, lh: 28.6 }));
  return c;
}));

// ---- Panels.tsx ----------------------------------------------------------------------------

var panelSection = section('Panels', 'components/Panels.tsx');
var panelRow = box({ name: 'panels', gap: 12, align: 'MIN' });
panelSection.appendChild(panelRow);

function panelShell(name, title, hint, width) {
  var p = box({ component: true, name: name, dir: 'V', w: width, pad: [18, 20, 18, 20], radius: 24, fill: 'surface', stroke: 'border' });
  var head = box({ name: 'head', justify: 'SPACE_BETWEEN', align: 'MAX', gap: 12 });
  head.appendChild(tx(title, { name: 'title', size: 14, weight: 'Medium', lh: 21 }));
  head.appendChild(tx(hint, { name: 'hint', size: 11.5, color: 'muted', lh: 17 }));
  add(p, head, 'FILL');
  return p;
}

// The seeded dev account's applications (backend/Services/DevAccount.cs), as days ago and status.
var SAMPLE_DAYS = { 0: { pending: 2 }, 1: { interview: 1 }, 3: { pending: 2, rejected: 1 }, 6: { offer: 1 }, 8: { withdrawn: 1 }, 9: { rejected: 1 }, 13: { interview: 1, pending: 1 }, 17: { rejected: 1 } };
var DAY_COUNT = 18;
var TODAY = new Date(2026, 9, 7);
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

var chart = panelShell('PerDayChart', 'Applications per day', 'hover a bar for detail, click to drill in', 667);
chart.appendChild(space(12));
var legend = box({ name: 'legend', gap: 14, align: 'CENTER' });
STATUS_ORDER.forEach(function (key) {
  var item = box({ name: key, gap: 5, align: 'CENTER' });
  var swatch = box({ name: 'swatch', w: 9, h: 9, radius: 2, fill: STATUS[key].token });
  item.appendChild(swatch);
  item.appendChild(tx(STATUS[key].label, { size: 11.5, color: 'ink2', lh: 17 }));
  legend.appendChild(item);
});
chart.appendChild(legend);
chart.appendChild(space(18));

// PerDayChart's own maths: max 3 a day, so one grid line per application and scale = 180 / (3 * 1.15).
var PLOT_H = 180, GUTTER = 28, COL = 24, COL_GAP = 7, MAX = 3;
var SCALE = PLOT_H / (MAX * 1.15);
var plot = figma.createFrame();
plot.name = 'plot';
plot.fills = [];
plot.clipsContent = false;
plot.resize(GUTTER + DAY_COUNT * (COL + COL_GAP) - COL_GAP, PLOT_H + 36);
for (var g = 0; g <= MAX; g++) {
  var y = PLOT_H - Math.round(g * SCALE);
  var line = figma.createRectangle();
  line.name = 'grid ' + g;
  line.resize(plot.width - GUTTER, 1);
  line.x = GUTTER; line.y = y;
  line.fills = fill('border');
  plot.appendChild(line);
  var tick = tx(String(g), { size: 10, color: 'muted', mono: true, align: 'RIGHT', w: 22 });
  tick.x = 0; tick.y = y - 7;
  plot.appendChild(tick);
}
for (var d = 0; d < DAY_COUNT; d++) {
  var daysAgo = DAY_COUNT - 1 - d;
  var x = GUTTER + d * (COL + COL_GAP);
  var counts = SAMPLE_DAYS[daysAgo] || {};
  var bottom = PLOT_H;
  STATUS_ORDER.slice().reverse().forEach(function (key) {
    if (!counts[key]) return;
    var height = Math.max(3, Math.round(counts[key] * SCALE));
    bottom -= 2;
    bottom -= height;
    var bar = figma.createRectangle();
    bar.name = key;
    bar.resize(16, height);
    bar.x = x + 4; bar.y = bottom;
    bar.cornerRadius = 2;
    bar.fills = fill(STATUS[key].token);
    plot.appendChild(bar);
  });
  var date = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - daysAgo);
  var label = tx(MONTHS[date.getMonth()] + ' ' + date.getDate(), { size: 9.5, color: 'muted', mono: true, align: 'CENTER', w: COL, lh: 13 });
  label.x = x; label.y = PLOT_H + 8;
  plot.appendChild(label);
  if (daysAgo === 0) {
    var dot = figma.createEllipse();
    dot.name = 'today';
    dot.resize(4, 4);
    dot.x = x + 10; dot.y = PLOT_H + 2;
    dot.fills = fill('accent');
    plot.appendChild(dot);
  }
}
chart.appendChild(plot);
panelRow.appendChild(chart);

var sources = panelShell('SourcePanel', 'By source', 'where these came from', 417);
sources.appendChild(space(14));
var sourceRows = box({ name: 'rows', dir: 'V', gap: 16 });
add(sources, sourceRows, 'FILL');
var BY_SOURCE = [['LinkedIn', 3], ['Indeed', 2], ['Handshake', 2], ['ZipRecruiter', 2], ['Glassdoor', 1], ['Greenhouse', 1], ['Other', 1]];
BY_SOURCE.forEach(function (row) {
  var r = box({ name: row[0], gap: 10, align: 'CENTER' });
  add(sourceRows, r, 'FILL');
  r.appendChild(icon(SOURCE_ICON[row[0]], 16, 'muted'));
  r.appendChild(tx(row[0], { size: 12, weight: 'Medium', color: 'ink2', w: 66, lh: 18 }));
  var track = box({ name: 'track', h: 20, radius: 12, fill: 'surface2', clip: true });
  add(r, track, 'FILL');
  var value = figma.createRectangle();
  value.name = 'value';
  value.resize(Math.round(241 * row[1] / 12), 20);
  value.cornerRadius = 12;
  value.fills = fill('accent');
  track.appendChild(value);
  r.appendChild(tx(String(row[1]), { size: 12, weight: 'Medium', color: 'ink2', mono: true, align: 'RIGHT', w: 24, lh: 18 }));
});
panelRow.appendChild(sources);

// ---- FilterChip, DashboardPage.tsx ---------------------------------------------------------

var filterSection = section('FilterChip', 'pages/DashboardPage.tsx');
variants(filterSection, 'FilterChip', [true, false].map(function (active) {
  var c = box({ component: true, name: 'active=' + active, h: 28, gap: 6, pad: active ? [0, 12, 0, 5] : [0, 12, 0, 12], radius: 999, align: 'CENTER', stroke: active ? 'accent' : 'border', strokeOpacity: active ? 0.4 : 1, fill: active ? 'accent' : undefined, fillOpacity: 0.14 });
  if (active) c.appendChild(icon('Check', 15, 'accent'));
  c.appendChild(tx('All statuses · 12', { name: 'label', size: 12, weight: 'Medium', color: active ? 'accent' : 'ink', lh: 18 }));
  return c;
}));

// ---- ApplicationsTable.tsx -----------------------------------------------------------------

var tableSection = section('ApplicationsTable', 'components/ApplicationsTable.tsx');
var COLS = [['Date', 90], ['Company', 250], ['Role', 260], ['Fit', 110], ['Source', 150], ['Status', 170]];
var ACTIONS_W = 66;

var head = box({ component: true, name: 'ApplicationsTable/Head', w: 1096, align: 'CENTER', stroke: 'border', bottomOnly: true });
COLS.forEach(function (col, index) {
  var cell = box({ name: col[0], w: col[1], gap: 4, pad: [10, 14, 10, 14], align: 'CENTER' });
  cell.appendChild(tx(col[0], { size: 11.5, weight: 'Medium', color: 'ink2', lh: 17 }));
  cell.appendChild(index === 0 ? icon('ArrowDownward', 14, 'ink2') : icon('UnfoldMore', 14, 'ink2', 0.6));
  head.appendChild(cell);
});
tableSection.appendChild(head);

var commonSets = {};
common.children.forEach(function (n) { if (n.type === 'COMPONENT_SET') commonSets[n.name] = n; });

var row = box({ component: true, name: 'ApplicationsTable/Row', w: 1096, align: 'CENTER', stroke: 'border', bottomOnly: true });
function cell(name, width, o) {
  o = o || {};
  var c = box({ name: name + ' cell', w: width, gap: o.gap || 0, pad: [10, 14, 10, 14], align: 'CENTER', justify: o.justify });
  row.appendChild(c);
  return c;
}
cell('date', 90).appendChild(tx('Oct 7', { name: 'date', size: 12, color: 'ink2', mono: true, lh: 18 }));
var companyCell = cell('company', 250, { gap: 6 });
var link = box({ name: 'link', gap: 4, align: 'CENTER' });
link.appendChild(tx('Northwind Labs', { name: 'company', size: 12.5, weight: 'Medium', lh: 18 }));
link.appendChild(icon('OpenInNew', 13, 'ink', 0.55));
link.children[1].name = 'open';
companyCell.appendChild(link);
var documents = box({ name: 'documents', gap: 2, align: 'CENTER' });
documents.appendChild(icon('Description', 13, 'muted'));
documents.appendChild(tx('2', { name: 'count', size: 10.5, color: 'muted', lh: 15 }));
companyCell.appendChild(documents);
cell('role', 260).appendChild(tx('Backend Engineer', { name: 'role', size: 12.5, color: 'ink2', lh: 18 }));
cell('fit', 110).appendChild(commonSets.FitPill.defaultVariant.createInstance());
cell('source', 150).appendChild(commonSets.SourceTag.defaultVariant.createInstance());
cell('status', 170).appendChild(commonSets.StatusSelect.defaultVariant.createInstance());
// DeleteButton: the first click arms it, as in ApplicationsTable.tsx.
var deleteSet = variants(tableSection, 'DeleteButton', [false, true].map(function (armed) {
  var c = box({ component: true, name: 'armed=' + armed, w: 27, h: 27, align: 'CENTER', justify: 'CENTER', radius: 999 });
  c.appendChild(icon(armed ? 'DeleteForever' : 'Delete', 17, armed ? 'critical' : 'muted'));
  return c;
}));
cell('actions', ACTIONS_W, { justify: 'MAX' }).appendChild(deleteSet.defaultVariant.createInstance());
tableSection.appendChild(row);

// ---- Fields, menus and dialogs -------------------------------------------------------------

// MUI Paper elevation, approximated with one shadow.
var SHADOW = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.2 }, offset: { x: 0, y: 8 }, radius: 28, spread: 0, visible: true, blendMode: 'NORMAL' }];

var fieldSection = section('TextField', 'MUI outlined, size small (theme.ts)');
var fieldSet = variants(fieldSection, 'TextField', ['text', 'select', 'link'].map(function (kind) {
  var c = box({ component: true, name: 'kind=' + kind, w: 240, h: 40, gap: 8, pad: [0, 14, 0, 14], radius: 8, align: 'CENTER', stroke: 'border', fill: 'surface' });
  if (kind === 'link') c.appendChild(icon('Link', 18, 'muted'));
  add(c, tx('Value', { name: 'value', size: 13, lh: 20 }), 'FILL');
  if (kind === 'select') c.appendChild(icon('ArrowDropDown', 24, 'ink2'));
  var chip = box({ name: 'label chip', pad: [0, 4, 0, 4], fill: 'surface' });
  chip.appendChild(tx('Label', { name: 'label', size: 9.75, color: 'ink2', lh: 14 }));
  c.appendChild(chip);
  chip.layoutPositioning = 'ABSOLUTE';
  chip.x = 9; chip.y = -7;
  return c;
}));

// A TextField instance. o.placeholder greys the value; o.resting shows the label inside the
// field, which is how MUI draws an empty, unfocused field.
function field(kind, label, value, o) {
  o = o || {};
  var inst = fieldSet.children.filter(function (c) { return c.name === 'kind=' + kind; })[0].createInstance();
  inst.name = label;
  setText(inst, 'label', label);
  var v = setText(inst, 'value', o.resting ? label : value);
  if (o.resting) { paintTo(v, 'fills', 'ink2'); setVisible(inst, 'label chip', false); }
  else if (o.placeholder) paintTo(v, 'fills', 'muted');
  return inst;
}

function closeButton() {
  var c = box({ name: 'close', w: 34, h: 34, align: 'CENTER', justify: 'CENTER', radius: 999 });
  c.appendChild(icon('Close', 24, 'ink2'));
  return c;
}

var menuSection = section('Menus', 'components/AppHeader.tsx, components/common.tsx');
var menuRow = box({ name: 'menus', gap: 32, align: 'MIN' });
menuSection.appendChild(menuRow);

var accountMenu = box({ component: true, name: 'AccountMenu', dir: 'V', w: 250, pad: [8, 0, 8, 0], radius: 8, fill: 'surface' });
accountMenu.effects = SHADOW;
var who = box({ name: 'who', dir: 'V', pad: [8, 16, 8, 16] });
who.appendChild(tx('Dev User', { name: 'name', size: 12.5, weight: 'Medium', lh: 19 }));
who.appendChild(tx('dev@resumesx.local', { name: 'email', size: 11.5, color: 'ink2', lh: 17 }));
add(accountMenu, who, 'FILL');
var divider = box({ name: 'divider', h: 1, fill: 'border' });
add(accountMenu, divider, 'FILL');
accountMenu.appendChild(space(8));
[['Settings', 'Account'], ['HelpOutline', 'Show the tailoring guide'], ['CreditCard', 'Plans and billing'], ['Logout', 'Sign out']].forEach(function (item) {
  var m = box({ name: item[1], pad: [6, 16, 6, 16], align: 'CENTER' });
  var slot = box({ name: 'icon', w: 36 });
  slot.appendChild(icon(item[0], 20, 'ink2'));
  m.appendChild(slot);
  m.appendChild(tx(item[1], { size: 13, lh: 20 }));
  add(accountMenu, m, 'FILL');
});
menuRow.appendChild(accountMenu);

// The status list StatusSelect opens, with the current status highlighted.
var statusMenus = STATUS_ORDER.map(function (selected) {
  var c = box({ component: true, name: 'selected=' + selected, dir: 'V', w: 150, pad: [8, 0, 8, 0], radius: 8, fill: 'surface' });
  c.effects = SHADOW;
  STATUS_ORDER.forEach(function (key) {
    var m = box({ name: key, pad: [6, 16, 6, 16], align: 'CENTER', fill: key === selected ? 'accent' : undefined, fillOpacity: 0.08 });
    m.appendChild(tx(STATUS[key].label, { size: 12.5, lh: 19 }));
    add(c, m, 'FILL');
  });
  return c;
});
variants(menuRow, 'StatusMenu', statusMenus).effects = [];

var formSection = section('AddApplicationForm', 'pages/DashboardPage.tsx');
var form = box({ component: true, name: 'AddApplicationForm', w: 1068, gap: 8, align: 'MAX' });
[['text', 'Company', '', 221, { resting: true }], ['text', 'Role', '', 221, { resting: true }], ['text', 'Date', '10/07/2026', 170], ['select', 'Source', 'Indeed', 170], ['select', 'Fit', 'Target', 170]].forEach(function (f) {
  var inst = field(f[0], f[1], f[2], f[4]);
  form.appendChild(inst);
  inst.resize(f[3], 40);
});
add(form, action('Add', { icon: 'Add', disabled: true, h: 40 }), 'FILL');
formSection.appendChild(form);

var dialogSection = section('Dialogs', 'components/NewApplicationDialog.tsx, components/ApplicationDialog.tsx');

function dialogTitle(parent, lines) {
  var title = box({ name: 'title', justify: 'SPACE_BETWEEN', align: 'MIN', gap: 12, pad: [16, 24, 16, 24], stroke: 'border', bottomOnly: true });
  add(parent, title, 'FILL');
  var left = box({ name: 'heading', dir: 'V', gap: 2 });
  add(title, left, 'FILL');
  lines(left);
  title.appendChild(closeButton());
  return title;
}

var newDialog = box({ component: true, name: 'NewApplicationDialog', dir: 'V', w: 600, radius: 8, fill: 'surface', clip: true });
newDialog.effects = SHADOW;
dialogTitle(newDialog, function (left) {
  left.appendChild(tx('New application', { size: 16, weight: 'Medium', lh: 24 }));
  add(left, tx('Paste a job posting link. Your resume and cover letter are tailored to it and compiled, usually in under a minute.', { name: 'intro', size: 12.5, color: 'ink2', lh: 19 }), 'FILL');
});
var newBody = box({ name: 'content', dir: 'V', gap: 12, pad: [20, 24, 20, 24] });
add(newDialog, newBody, 'FILL');
add(newBody, field('link', 'Job posting URL', 'https://www.indeed.com/viewjob?jk=…', { placeholder: true }), 'FILL');
var paste = box({ name: 'paste the text', h: 36, justify: 'SPACE_BETWEEN', align: 'CENTER' });
paste.appendChild(tx('Link blocked? Paste the posting text instead', { size: 12, weight: 'Medium', color: 'ink2' }));
paste.appendChild(icon('ExpandMore', 24, 'ink2'));
add(newBody, paste, 'FILL');
add(newBody, action('Tailor with AI', { icon: 'AutoAwesome', large: true, disabled: true }), 'FILL');
dialogSection.appendChild(newDialog);

// ApplicationDialog: maxWidth md (900px). document=yes shows the compiled page, no the empty state.
var appDialogs = ['yes', 'no'].map(function (has) {
  var d = box({ component: true, name: 'document=' + has, dir: 'V', w: 900, h: 760, radius: 8, fill: 'surface', clip: true });
  d.effects = SHADOW;
  dialogTitle(d, function (left) {
    left.appendChild(tx('Northwind Labs', { name: 'company', size: 16, weight: 'Medium', lh: 24 }));
    left.appendChild(tx('Backend Engineer', { name: 'role', size: 12.5, color: 'ink2', lh: 19 }));
    var posting = box({ name: 'posting', gap: 5, align: 'CENTER', pad: [4, 0, 0, 0] });
    posting.appendChild(icon('OpenInNew', 13, 'ink2'));
    posting.appendChild(tx('View posting', { size: 11.5, color: 'ink2', lh: 17 }));
    left.appendChild(posting);
  });
  var body = box({ name: 'content', dir: 'V', gap: 14, pad: [24, 20, 20, 20] });
  add(d, body, 'FILL', 'FILL');
  var grid = box({ name: 'fields', gap: 10 });
  add(body, grid, 'FILL');
  add(grid, field('text', 'Date', '10/07/2026'), 'FILL');
  add(grid, field('select', 'Status', 'Pending'), 'FILL');
  add(grid, field('select', 'Applied via', 'LinkedIn'), 'FILL');
  add(body, field('text', 'Posting link', 'https://', { placeholder: true }), 'FILL');
  var notes = box({ name: 'notes', pad: [8, 10, 8, 10], radius: 16, fill: 'surface2' });
  add(body, notes, 'FILL');
  add(notes, tx('Notes', { name: 'notes text', size: 12, color: 'ink2', lh: 18 }), 'FILL');

  var card = box({ name: 'documents', dir: 'V', radius: 20, stroke: 'border', clip: true });
  add(body, card, 'FILL', 'FILL');
  var tabs = box({ name: 'tabs', gap: 10, pad: [6, 10, 6, 10], align: 'CENTER', justify: 'CENTER', fill: 'surface2', stroke: 'border', bottomOnly: true });
  add(card, tabs, 'FILL');
  var previous = box({ name: 'previous', w: 30, h: 30, align: 'CENTER', justify: 'CENTER' });
  previous.appendChild(icon('ChevronLeft', 20, 'ink2'));
  tabs.appendChild(previous);
  [['Resume', true], ['Cover Letter', false]].forEach(function (tab) {
    var t = box({ name: tab[0], h: 32, pad: [0, 16, 0, 16], align: 'CENTER', stroke: tab[1] ? 'accent' : undefined, bottomOnly: true });
    if (tab[1]) t.strokeBottomWeight = 2;
    t.appendChild(tx(tab[0], { size: 12.5, weight: 'Medium', color: tab[1] ? 'accent' : 'ink2' }));
    tabs.appendChild(t);
  });
  var next = box({ name: 'next', w: 30, h: 30, align: 'CENTER', justify: 'CENTER' });
  next.appendChild(icon('ChevronRight', 20, 'ink2'));
  tabs.appendChild(next);

  var preview = box({ name: 'preview', dir: 'V', gap: 10, align: 'CENTER', justify: 'CENTER', fill: has === 'yes' ? 'surface2' : undefined, pad: 16, clip: true });
  add(card, preview, 'FILL', 'FILL');
  if (has === 'yes') {
    // Stands in for the PDF that PdfPreview renders from the stored LaTeX.
    var sheetOfPaper = box({ name: 'compiled page', dir: 'V', w: 250, h: 324, align: 'CENTER', justify: 'CENTER', fill: 'surface', stroke: 'border' });
    sheetOfPaper.appendChild(tx('Compiled PDF', { size: 11.5, color: 'muted' }));
    preview.appendChild(sheetOfPaper);
  } else {
    preview.appendChild(tx('No resume on file', { size: 12.5, color: 'muted' }));
    preview.appendChild(tx('Add the LaTeX source and the PDF is compiled on demand, so nothing is stored.', { size: 11.5, color: 'muted', opacity: 0.85, align: 'CENTER', w: 320 }));
    preview.appendChild(action('Add LaTeX', { outlined: true, small: true }));
  }
  var foot = box({ name: 'actions', gap: 8, pad: [12, 14, 12, 14], justify: 'CENTER', align: 'CENTER', stroke: 'border' });
  foot.strokeTopWeight = 1; foot.strokeBottomWeight = 0; foot.strokeLeftWeight = 0; foot.strokeRightWeight = 0;
  add(card, foot, 'FILL');
  foot.appendChild(action('Download resume', { icon: 'Download', disabled: has === 'no' }));
  if (has === 'yes') foot.appendChild(action('Edit LaTeX', { outlined: true }));
  return d;
});
variants(dialogSection, 'ApplicationDialog', appDialogs);

// ---- Pieces of the Account, Templates and Plans pages ------------------------------------------

var pageSection = section('Page pieces', 'pages/AccountPage.tsx, pages/TemplatesPage.tsx, pages/BillingPage.tsx');

// The back arrow, title and optional line under it that opens every page but the dashboard.
var pageHeader = box({ component: true, name: 'PageHeader', w: 696, gap: 12, align: 'CENTER' });
var back = box({ name: 'back', w: 40, h: 40, align: 'CENTER', justify: 'CENTER', radius: 999 });
back.appendChild(icon('ArrowBack', 24, 'ink2'));
pageHeader.appendChild(back);
var heading = box({ name: 'heading', dir: 'V' });
add(pageHeader, heading, 'FILL');
heading.appendChild(tx('Account', { name: 'title', size: 18, weight: 'Medium', ls: -0.1, lh: 27 }));
para(heading, 'Tracking applications is free and unlimited on every plan.', { name: 'subtitle', size: 12.5, color: 'ink2', lh: 19 });
pageSection.appendChild(pageHeader);

// MUI Chip, size small.
var chipSet = variants(pageSection, 'Chip', ['filled', 'outlined'].map(function (kind) {
  var c = box({ component: true, name: 'kind=' + kind, h: 24, pad: [0, 8, 0, 8], radius: 16, align: 'CENTER', fill: kind === 'filled' ? 'accent' : undefined, stroke: kind === 'outlined' ? 'border' : undefined });
  c.appendChild(tx(kind === 'filled' ? 'Current plan' : 'Off', { name: 'label', size: 12, color: kind === 'filled' ? 'accentInk' : 'ink', lh: 18 }));
  return c;
}));

// The two slots on /templates.
variants(pageSection, 'TemplateSlot', [
  ['resume', 'Resume', 'Description', 'Every run tailors this to the posting.'],
  ['cover_letter', 'Cover letter', 'MailOutline', 'Written for each posting on plans that include cover letters.']
].map(function (s) {
  var c = box({ component: true, name: 'kind=' + s[0], dir: 'V', w: 432, h: 260, pad: 32, justify: 'SPACE_BETWEEN', radius: 24, fill: 'surface', stroke: 'border' });
  var tile = box({ name: 'tile', w: 56, h: 56, radius: 20, align: 'CENTER', justify: 'CENTER', fill: 'accent', fillOpacity: 0.12 });
  tile.appendChild(icon(s[2], 30, 'accent'));
  c.appendChild(tile);
  var text = box({ name: 'text', dir: 'V', gap: 8 });
  add(c, text, 'FILL');
  text.appendChild(tx(s[1], { name: 'title', size: 20, weight: 'Medium', lh: 30 }));
  para(text, s[3], { name: 'description', size: 12.5, color: 'ink2', lh: 19 });
  var state = box({ name: 'state', align: 'CENTER', pad: [8, 0, 0, 0] });
  add(text, state, 'FILL');
  para(state, 'Edited Oct 7, 2026', { name: 'edited', size: 11.5, color: 'muted', lh: 17 });
  state.appendChild(icon('ChevronRight', 20, 'muted'));
  return c;
}));

// PlanCard as the seeded dev account sees it: on Pro, and without a .edu address.
// Prices are the plan rows in backend/Data/ResumesxDb.cs, features PLAN_FEATURES in hooks/useBilling.ts.
var PLANS = [
  ['free', 'Free', 'Free', ['2 tailored resumes a day', 'Unlimited application tracking', 'Template workspace']],
  ['student', 'Student', '$5.99', ['Unlimited tailored resumes', 'Tailored cover letters', 'Unlimited application tracking', 'Template workspace', 'Needs a confirmed .edu email']],
  ['pro', 'Pro', '$10.99', ['Unlimited tailored resumes', 'Tailored cover letters', 'Unlimited application tracking', 'Template workspace']]
];
variants(pageSection, 'PlanCard', PLANS.map(function (p) {
  var current = p[0] === 'pro';
  var c = box({ component: true, name: 'plan=' + p[0], dir: 'V', w: 288, pad: 20, justify: 'SPACE_BETWEEN', radius: 24, fill: 'surface', stroke: current ? 'accent' : 'border' });
  if (current) c.strokeWeight = 2;
  var top = box({ name: 'top', dir: 'V' });
  add(c, top, 'FILL');
  var head = box({ name: 'head', gap: 8, align: 'CENTER' });
  if (p[0] === 'student') head.appendChild(icon('School', 18, 'ink2'));
  head.appendChild(tx(p[1], { name: 'label', size: 16, weight: 'Medium', lh: 24 }));
  if (current) head.appendChild(chipSet.children.filter(function (v) { return v.name === 'kind=filled'; })[0].createInstance());
  top.appendChild(head);
  top.appendChild(space(8));
  var price = box({ name: 'price', gap: 4, align: 'MAX' });
  price.appendChild(tx(p[2], { name: 'amount', size: 26, weight: 'Medium', lh: 31 }));
  if (p[0] !== 'free') price.appendChild(tx('/ month', { size: 13, color: 'ink2', lh: 26 }));
  top.appendChild(price);
  top.appendChild(space(16));
  var features = box({ name: 'features', dir: 'V', gap: 6 });
  add(top, features, 'FILL');
  p[3].forEach(function (feature) {
    var f = box({ name: feature, gap: 8, align: 'MIN' });
    add(features, f, 'FILL');
    var tick = box({ name: 'tick', pad: [2, 0, 0, 0] });
    tick.appendChild(icon('Check', 16, 'good'));
    f.appendChild(tick);
    para(f, feature, { size: 13, lh: 19.5 });
  });
  top.appendChild(space(16));
  if (p[0] === 'student') {
    var blocked = box({ name: 'unavailable', dir: 'V', gap: 8 });
    add(c, blocked, 'FILL');
    para(blocked, 'The Student plan needs an account registered with a .edu email address.', { name: 'reason', size: 12, color: 'ink2', lh: 18 });
    blocked.appendChild(action('Update email', { outlined: true, small: true }));
  }
  return c;
}));

figma.viewport.scrollAndZoomIntoView([sheet]);
await png(sheet, 'figma-components.png', 1);

var made = sheet.findAll(function (n) { return n.type === 'COMPONENT_SET' || (n.type === 'COMPONENT' && n.parent.type !== 'COMPONENT_SET'); });
return { variables: variablesInfo, mono: FONT.mono, components: made.map(function (n) { return n.name + (n.type === 'COMPONENT_SET' ? ' (' + n.children.length + ' variants)' : ''); }) };
