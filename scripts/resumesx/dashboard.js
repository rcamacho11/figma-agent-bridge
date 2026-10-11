// The dashboard screen (pages/DashboardPage.tsx, route "/"), composed only from instances of
// the components on "resumesx / Components", with the seeded dev account's applications.
//
//   node run.js scripts/resumesx/icons.js scripts/resumesx/lib.js scripts/resumesx/dashboard.js --out <folder>

// backend/Services/DevAccount.cs: date, company, role, source, fit, status, documents, has a link.
var APPLICATIONS = [
  ['Oct 7', 'Northwind Labs', 'Backend Engineer', 'LinkedIn', 'target', 'pending', 2, true],
  ['Oct 7', 'Globex', 'Platform Engineer', 'Indeed', 'stretch', 'pending', 1, false],
  ['Oct 6', 'Initech', 'Software Engineer II', 'Glassdoor', 'target', 'interview', 2, true],
  ['Oct 4', 'Umbrella Health', 'Full Stack Developer', 'Handshake', 'target', 'pending', 0, false],
  ['Oct 4', 'Hooli', 'Senior Backend Engineer', 'LinkedIn', 'stretch', 'rejected', 1, true],
  ['Oct 4', 'Stark Freight', 'API Engineer', 'ZipRecruiter', 'target', 'pending', 0, true],
  ['Oct 1', 'Wayne Robotics', 'Software Engineer', 'Other', 'target', 'offer', 2, false],
  ['Sep 29', 'Acme Analytics', 'Data Engineer', 'Indeed', 'stretch', 'withdrawn', 0, true],
  ['Sep 28', 'Soylent Foods', 'Backend Developer', 'LinkedIn', 'target', 'rejected', 1, false],
  ['Sep 24', 'Pied Piper', 'Infrastructure Engineer', 'Handshake', 'stretch', 'interview', 2, true],
  ['Sep 24', 'Wonka Logistics', '.NET Developer', 'Greenhouse', 'target', 'pending', 0, false],
  ['Sep 20', 'Tyrell Systems', 'Junior Software Engineer', 'ZipRecruiter', 'target', 'rejected', 1, true]
];

await h.page(PAGE_SCREENS);
figma.currentPage.children.filter(function (n) { return n.name === 'DashboardPage'; }).forEach(function (n) { n.remove(); });

// maxWidth 1160 with padding 24px 32px 56px, as the page's outer Box.
var screen = box({ name: 'DashboardPage', dir: 'V', w: 1160, pad: [24, 32, 56, 32], fill: 'page' });
figma.currentPage.appendChild(screen);

add(screen, await instance('AppHeader'), 'FILL');
screen.appendChild(space(20));
add(screen, await instance('SearchField'), 'FILL');
screen.appendChild(space(18));

var tiles = box({ name: 'KpiTiles', gap: 12 });
add(screen, tiles, 'FILL');
var kinds = ['Total sent', 'Awaiting response', 'Interviewing', 'Offers', 'Rejected', 'Response rate'];
for (var k = 0; k < kinds.length; k++) add(tiles, await instance('KpiTile', { kind: kinds[k] }), 'FILL');
screen.appendChild(space(20));

var panels = box({ name: 'panels', gap: 12 });
add(screen, panels, 'FILL');
add(panels, await instance('PerDayChart'), 'FILL');
panels.appendChild(await instance('SourcePanel'));
screen.appendChild(space(20));

var filters = box({ name: 'filters', gap: 8, align: 'CENTER' });
add(screen, filters, 'FILL');
var CHIPS = [['All statuses', 12, true], ['Pending', 5, false], ['Interview', 2, false], ['Offer', 1, false], ['Rejected', 3, false], ['Withdrawn', 1, false], ['All fits', 12, true], ['Target', 8, false], ['Stretch', 4, false]];
for (var c = 0; c < CHIPS.length; c++) {
  var chip = await instance('FilterChip', { active: String(CHIPS[c][2]) });
  setText(chip, 'label', CHIPS[c][0] + ' · ' + CHIPS[c][1]);
  filters.appendChild(chip);
}
var push = box({ name: 'push', h: 1 });
add(filters, push, 'FILL');
filters.appendChild(tx('12 / 12', { name: 'showing-count', size: 11.5, color: 'muted', mono: true }));
screen.appendChild(space(14));

var table = box({ name: 'applications-list', dir: 'V', radius: 24, fill: 'surface', stroke: 'border', clip: true });
add(screen, table, 'FILL');
add(table, await instance('ApplicationsTable/Head'), 'FILL');
for (var r = 0; r < APPLICATIONS.length; r++) {
  var a = APPLICATIONS[r];
  var line = await instance('ApplicationsTable/Row');
  add(table, line, 'FILL');
  setText(line, 'date', a[0]);
  setText(line, 'company', a[1]);
  setText(line, 'role', a[2]);
  line.findOne(function (n) { return n.name === 'source cell'; }).children[0].setProperties({ source: a[3] });
  line.findOne(function (n) { return n.name === 'fit cell'; }).children[0].setProperties({ fit: a[4] });
  line.findOne(function (n) { return n.name === 'status cell'; }).children[0].setProperties({ status: a[5] });
  if (a[6] > 0) setText(line, 'count', a[6]); else setVisible(line, 'documents', false);
  if (!a[7]) setVisible(line, 'open', false);
  if (r === APPLICATIONS.length - 1) line.strokes = [];
}
var foot = box({ name: 'add', pad: [10, 14, 14, 14] });
add(table, foot, 'FILL');
add(foot, await instance('Button', { kind: 'dashed' }), 'FILL');

screen.appendChild(space(22));
add(screen, tx('Click a row to open, edit and preview documents. PDFs are compiled fresh each time from the stored LaTeX, so nothing is kept on the server.', { name: 'footnote', size: 11.5, color: 'muted', align: 'CENTER' }), 'FILL');

figma.viewport.scrollAndZoomIntoView([screen]);
await png(screen, 'figma-dashboard.png', 2);
return { screen: screen, size: Math.round(screen.width) + ' x ' + Math.round(screen.height), instances: screen.findAll(function (n) { return n.type === 'INSTANCE'; }).length };
