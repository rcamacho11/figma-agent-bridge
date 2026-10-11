// Makes the dashboard clickable. Figma lets a plugin set click interactions but not overlay
// settings, so every open state (menu, dialog, add form, status list) is its own frame: a
// clone of DashboardPage with the open piece on top, linked by click.
//
//   node run.js icons.js lib.js prototype.js --out <folder>     (after components.js, dashboard.js and screens.js)
//
// Press Play on "resumesx / Screens" to use it. It also links the dashboard to the pages
// screens.js builds (Account, Templates, Plans) and their back arrows. Not wired: the menu's
// Show the tailoring guide and Sign out, and the cover letter slot, which have no screen yet.

// backend/Services/DevAccount.cs, in table order: status, source, documents, link, notes, date.
var DETAILS = [
  ['pending', 'LinkedIn', 2, 'https://example.com/jobs/northwind-backend-engineer', '', '10/07/2026'],
  ['pending', 'Indeed', 1, '', '', '10/07/2026'],
  ['interview', 'Glassdoor', 2, 'https://example.com/jobs/initech-software-engineer-ii', 'Phone screen went well. Technical round is next week.', '10/06/2026'],
  ['pending', 'Handshake', 0, '', '', '10/04/2026'],
  ['rejected', 'LinkedIn', 1, 'https://example.com/jobs/hooli-senior-backend-engineer', 'Wanted more years with distributed systems.', '10/04/2026'],
  ['pending', 'ZipRecruiter', 0, 'https://example.com/jobs/stark-freight-api-engineer', '', '10/04/2026'],
  ['offer', 'Other', 2, '', 'Referred by a former teammate. Offer is open until the end of the month.', '10/01/2026'],
  ['withdrawn', 'Indeed', 0, 'https://example.com/jobs/acme-analytics-data-engineer', 'Withdrew after learning the role is on site only.', '09/29/2026'],
  ['rejected', 'LinkedIn', 1, '', '', '09/28/2026'],
  ['interview', 'Handshake', 2, 'https://example.com/jobs/pied-piper-infrastructure-engineer', '', '09/24/2026'],
  ['pending', 'Greenhouse', 0, '', 'Recruiter said to expect a reply in two weeks.', '09/24/2026'],
  ['rejected', 'ZipRecruiter', 1, 'https://example.com/jobs/tyrell-systems-junior-software-engineer', '', '09/20/2026']
];

var screens = await h.page(PAGE_SCREENS);
var base = screens.children.filter(function (n) { return n.name === 'DashboardPage'; })[0];
if (!base) throw new Error('Run dashboard.js first: there is no DashboardPage frame.');
screens.children.filter(function (n) { return n.name.indexOf('DashboardPage / ') === 0 || n.type === 'RECTANGLE'; }).forEach(function (n) { n.remove(); });
base.x = 0; base.y = 0;

function screenNamed(name) {
  var found = screens.children.filter(function (n) { return n.name === name; })[0];
  if (!found) throw new Error('Run screens.js first: there is no ' + name + ' frame.');
  return found;
}
var accountPage = screenNamed('AccountPage');
var templatesPage = screenNamed('TemplatesPage');
var resumePage = screenNamed('TemplatesPage / Resume');
var billingPage = screenNamed('BillingPage');
function layer(root, name) {
  var found = root.findOne(function (n) { return n.name === name; });
  if (!found) throw new Error('No layer named "' + name + '" in ' + root.name + '.');
  return found;
}
base.clipsContent = true;

var FADE = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.12 };
var wired = 0;
// toTop opens the destination scrolled to its top, where the dialogs sit: Figma has no way for
// a plugin to pin a layer to the view.
async function go(node, destination, toTop) {
  await node.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: destination.id, navigation: 'NAVIGATE', transition: FADE, resetScrollPosition: toTop === true }] }]);
  wired++;
}

var made = 0;
function state(name) {
  var s = base.clone();
  s.name = 'DashboardPage / ' + name;
  s.x = (base.width + 100) * (1 + made % 6);
  s.y = (base.height + 200) * Math.floor(made / 6);
  made++;
  return s;
}

// Puts a node on top of a screen at a fixed spot, outside its auto layout.
function float(screen, node, x, y) {
  screen.appendChild(node);
  node.layoutPositioning = 'ABSOLUTE';
  node.x = Math.round(x);
  node.y = Math.round(y);
  return node;
}

// The layer behind an open menu or dialog. Clicking it closes, as clicking away does on the site.
function backdrop(screen, opacity) {
  var r = figma.createRectangle();
  r.name = 'backdrop';
  r.resize(screen.width, screen.height);
  r.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: opacity }];
  return float(screen, r, 0, 0);
}

function parts(screen) {
  var header = screen.findOne(function (n) { return n.type === 'INSTANCE' && n.name === 'AppHeader'; });
  var actions = header.findOne(function (n) { return n.name === 'actions'; });
  var table = screen.findOne(function (n) { return n.name === 'applications-list'; });
  return {
    templates: actions.children[0],
    newApplication: actions.children[1],
    account: actions.children[2],
    add: table.findOne(function (n) { return n.name === 'add'; }),
    rows: table.children.filter(function (n) { return n.name === 'ApplicationsTable/Row'; })
  };
}

// Where a node sits inside the base screen.
function spot(node) {
  var a = node.absoluteBoundingBox, b = base.absoluteBoundingBox;
  return { x: a.x - b.x, y: a.y - b.y, w: a.width, h: a.height };
}

var baseParts = parts(base);
var where = {
  account: spot(baseParts.account),
  rows: baseParts.rows.map(function (r) { return spot(r); }),
  chips: baseParts.rows.map(function (r) { return spot(r.findOne(function (n) { return n.name === 'status cell'; }).children[0]); })
};
var texts = baseParts.rows.map(function (r) {
  return {
    company: r.findOne(function (n) { return n.type === 'TEXT' && n.name === 'company'; }).characters,
    role: r.findOne(function (n) { return n.type === 'TEXT' && n.name === 'role'; }).characters
  };
});

// ---- Account menu --------------------------------------------------------------------------
var menuState = state('Account menu');
var menuBackdrop = backdrop(menuState, 0);
var menu = float(menuState, await instance('AccountMenu'), where.account.x + where.account.w - 250, where.account.y + where.account.h);
await go(menuBackdrop, base);
await go(layer(menu, 'Account'), accountPage, true);
await go(layer(menu, 'Plans and billing'), billingPage, true);

// ---- New application dialog ----------------------------------------------------------------
var newState = state('New application');
var newBackdrop = backdrop(newState, 0.5);
var newDialog = float(newState, await instance('NewApplicationDialog'), (base.width - 600) / 2, 96);
await go(newBackdrop, base);
await go(newDialog.findOne(function (n) { return n.name === 'close'; }), base);

// ---- Add application form ------------------------------------------------------------------
var addState = state('Add application');
var addFoot = parts(addState).add;
addFoot.layoutMode = 'VERTICAL';
addFoot.itemSpacing = 10;
add(addFoot, await instance('AddApplicationForm'), 'FILL');

// ---- One status list and one application dialog per row --------------------------------------
var statusStates = [];
var dialogStates = [];
for (var i = 0; i < DETAILS.length; i++) {
  var d = DETAILS[i];

  var st = state('Status, ' + texts[i].company);
  var stBackdrop = backdrop(st, 0);
  var list = float(st, await instance('StatusMenu', { selected: d[0] }), where.chips[i].x, where.chips[i].y + where.chips[i].h + 2);
  await go(stBackdrop, base);
  // Picking a status closes the list. The row itself cannot change in a prototype.
  await go(list, base);
  statusStates.push(st);

  var ds = state('Application, ' + texts[i].company);
  var dsBackdrop = backdrop(ds, 0.5);
  var dialog = await instance('ApplicationDialog', { document: d[2] > 0 ? 'yes' : 'no' });
  float(ds, dialog, (base.width - 900) / 2, 40);
  setText(dialog, 'company', texts[i].company);
  setText(dialog, 'role', texts[i].role);
  setVisible(dialog, 'posting', d[3] !== '');
  var named = function (name) { return dialog.findOne(function (n) { return n.type === 'INSTANCE' && n.name === name; }); };
  setText(named('Date'), 'value', d[5]);
  setText(named('Status'), 'value', STATUS[d[0]].label);
  setText(named('Applied via'), 'value', d[1]);
  if (d[3] !== '') paintTo(setText(named('Posting link'), 'value', d[3]), 'fills', 'ink');
  if (d[4] !== '') setText(dialog, 'notes text', d[4]); else setVisible(dialog, 'notes', false);
  await go(dsBackdrop, base);
  await go(dialog.findOne(function (n) { return n.name === 'close'; }), base);
  dialogStates.push(ds);
}

// ---- Wire the two screens every button lives on ----------------------------------------------
async function wire(screen, addTarget) {
  var p = parts(screen);
  await go(p.templates, templatesPage, true);
  await go(p.newApplication, newState, true);
  await go(p.account, menuState);
  await go(p.add.children[0], addTarget);
  for (var r = 0; r < p.rows.length; r++) {
    await go(p.rows[r], dialogStates[r], true);
    await go(p.rows[r].findOne(function (n) { return n.name === 'status cell'; }).children[0], statusStates[r]);
  }
}
await wire(base, addState);
await wire(addState, base);

// ---- The pages behind the dashboard ----------------------------------------------------------
await go(layer(accountPage, 'back'), base, true);
await go(layer(templatesPage, 'back'), base, true);
await go(layer(billingPage, 'back'), base, true);
await go(layer(resumePage, 'back'), templatesPage, true);
await go(templatesPage.findOne(function (n) { return n.type === 'INSTANCE' && n.name === 'TemplateSlot'; }), resumePage, true);
await go(layer(accountPage, 'Change plan'), billingPage, true);
await go(layer(billingPage, 'Update email'), accountPage, true);
await go(layer(billingPage, 'account page'), accountPage, true);

screens.flowStartingPoints = [{ nodeId: base.id, name: 'Dashboard' }];
figma.viewport.scrollAndZoomIntoView([base]);

await png(newState, 'figma-state-new.png', 1);
await png(menuState, 'figma-state-menu.png', 1);
await png(addState, 'figma-state-add.png', 1);
await png(dialogStates[2], 'figma-state-application.png', 1);
await png(statusStates[6], 'figma-state-status.png', 1);
return { states: made, interactions: wired, frames: screens.children.length };
