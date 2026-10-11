// The pages behind the dashboard, each as its own frame on "resumesx / Screens":
//   AccountPage             pages/AccountPage.tsx     route /account
//   TemplatesPage           pages/TemplatesPage.tsx   route /templates
//   TemplatesPage / Resume  pages/TemplatesPage.tsx   route /templates/resume
//   BillingPage             pages/BillingPage.tsx     route /billing
// All as the seeded dev account sees them: Dev User, on Pro, two-factor off.
//
//   node run.js icons.js lib.js screens.js --out <folder>     (after components.js, before prototype.js)

var NAMES = ['AccountPage', 'TemplatesPage', 'TemplatesPage / Resume', 'BillingPage'];
var page = await h.page(PAGE_SCREENS);
page.children.filter(function (n) { return NAMES.indexOf(n.name) >= 0; }).forEach(function (n) { n.remove(); });

// The dashboard and its open states fill the rows from y = 0 down; these sit in a row above.
var ROW_Y = -1700;
var nextX = 0;
function screen(name, w, hgt, pad) {
  var s = box({ name: name, dir: 'V', w: w, h: hgt, pad: pad, fill: 'page', clip: true });
  page.appendChild(s);
  s.x = nextX; s.y = ROW_Y;
  nextX += w + 100;
  return s;
}

async function header(parent, title, subtitle) {
  var hd = await instance('PageHeader');
  add(parent, hd, 'FILL');
  setText(hd, 'title', title);
  if (subtitle) setText(hd, 'subtitle', subtitle); else setVisible(hd, 'subtitle', false);
  return hd;
}

// ---- AccountPage ---------------------------------------------------------------------------
// maxWidth 760, padding 24px 32px 56px.
var account = screen('AccountPage', 760, undefined, [24, 32, 56, 32]);
await header(account, 'Account');
account.appendChild(space(24));
var sections = box({ name: 'sections', dir: 'V', gap: 20 });
add(account, sections, 'FILL');

// Section in AccountPage.tsx: an outlined Paper with a title, an optional description and a body.
function section(title, description) {
  var p = box({ name: title, dir: 'V', pad: 24, radius: 24, fill: 'surface', stroke: 'border' });
  add(sections, p, 'FILL');
  p.appendChild(tx(title, { name: 'title', size: 16, weight: 'Medium', lh: 24 }));
  p.appendChild(space(description ? 4 : 16));
  if (description) {
    para(p, description, { name: 'description', size: 12.5, color: 'ink2', lh: 19 });
    p.appendChild(space(16));
  }
  var body = box({ name: 'body', dir: 'V', gap: 16 });
  add(p, body, 'FILL');
  return body;
}

// A field with MUI's helper text under it.
async function helped(parent, kind, label, value, helper, o) {
  var wrap = box({ name: label, dir: 'V', gap: 3 });
  add(parent, wrap, 'FILL');
  add(wrap, await textField(kind, label, value, o), 'FILL');
  var line = box({ name: 'helper', pad: [0, 14, 0, 14] });
  add(wrap, line, 'FILL');
  para(line, helper, { size: 11.5, color: 'ink2', lh: 17 });
  return wrap;
}

var details = section('Your details');
var names = box({ name: 'names', gap: 16 });
add(details, names, 'FILL');
add(names, await textField('text', 'First name', 'Dev'), 'FILL');
add(names, await textField('text', 'Last name', 'User'), 'FILL');
await helped(details, 'text', 'Phone (optional)', '', 'Stored encrypted at rest.', { resting: true });
var emailRow = box({ name: 'email', gap: 12, align: 'MIN' });
add(details, emailRow, 'FILL');
await helped(emailRow, 'text', 'Email', 'dev@resumesx.local', 'The address you sign in with.', { placeholder: true });
var changeWrap = box({ name: 'change', pad: [3, 0, 0, 0] });
changeWrap.appendChild(action('Change', { outlined: true }));
emailRow.appendChild(changeWrap);
details.appendChild(action('Save changes'));

// BillingSection.tsx. The dev account's Pro row mirrors no Stripe subscription, so it has no card
// and no invoices; the renewal date is a sample.
var plan = section('Plan and billing');
var planHead = box({ name: 'plan', dir: 'V', gap: 4 });
add(plan, planHead, 'FILL');
planHead.appendChild(tx('Pro', { name: 'current-plan', size: 15, weight: 'Medium', lh: 22 }));
para(planHead, 'Renews on Nov 7, 2026.', { name: 'status', size: 12.5, color: 'ink2', lh: 19 });
var planActions = box({ name: 'actions', gap: 8, align: 'CENTER' });
plan.appendChild(planActions);
var changePlan = action('Change plan', { outlined: true });
planActions.appendChild(changePlan);
planActions.appendChild(action('Update card', { outlined: true }));
planActions.appendChild(action('Cancel plan', { text: true, tone: 'critical' }));

// TwoFactorSection.tsx, off.
var twoFactor = section('Two-factor authentication', 'An extra code at sign-in, from an app on your phone. Optional, and you can turn it off again at any time.');
twoFactor.appendChild(await instance('Chip', { kind: 'outlined' }));
para(twoFactor, 'With two-factor on, signing in also needs a code from your phone, so a stolen password is not enough on its own.', { size: 13, lh: 19.5 });
twoFactor.appendChild(action('Set up two-factor'));

// AppearanceSection: a ToggleButtonGroup, on System until a choice is saved in the browser.
var appearance = section('Appearance', 'Choose how resumesx looks. System follows your device setting. Saved in this browser.');
appearance.itemSpacing = 10;
var toggle = box({ name: 'theme-toggle', radius: 8, stroke: 'border', clip: true });
appearance.appendChild(toggle);
[['LightMode', 'Light', false], ['DarkMode', 'Dark', false], ['SettingsBrightness', 'System', true]].forEach(function (option, index) {
  if (index > 0) {
    var rule = box({ name: 'rule', w: 1, fill: 'border' });
    add(toggle, rule, 'FIXED', 'FILL');
  }
  var b = box({ name: option[1], gap: 6, pad: [7, 16, 7, 16], align: 'CENTER', fill: option[2] ? 'ink' : undefined, fillOpacity: 0.08 });
  b.appendChild(icon(option[0], 16, option[2] ? 'ink' : 'ink2'));
  b.appendChild(tx(option[1], { size: 13, weight: 'Medium', color: option[2] ? 'ink' : 'ink2', lh: 20 }));
  toggle.appendChild(b);
});
para(appearance, 'Currently showing the light scheme.', { size: 11.5, opacity: 0.75, lh: 17 });

var remove = section('Delete account', 'This permanently removes your account, every application and all stored LaTeX, and cancels any subscription immediately. It cannot be undone.');
remove.appendChild(action('Delete my account', { outlined: true, tone: 'critical' }));

// ---- TemplatesPage, the choice of two --------------------------------------------------------
// maxWidth 1600, padding 24px 32px 32px, at least the height of the window.
var templates = screen('TemplatesPage', 1440, 900, [24, 32, 32, 32]);
await header(templates, 'Templates', 'Every tailoring run starts from these two. Pick one to edit it or replace it.');
templates.appendChild(space(68));
var centre = box({ name: 'centre', justify: 'CENTER' });
add(templates, centre, 'FILL');
var slots = box({ name: 'slots', w: 880, gap: 16 });
centre.appendChild(slots);
add(slots, await instance('TemplateSlot', { kind: 'resume' }), 'FILL');
add(slots, await instance('TemplateSlot', { kind: 'cover_letter' }), 'FILL');

// ---- TemplatesPage / Resume, the editor and its preview ----------------------------------------
var editor = screen('TemplatesPage / Resume', 1440, 900, [24, 32, 32, 32]);
var top = box({ name: 'top', gap: 12, align: 'CENTER' });
add(editor, top, 'FILL');
await header(top, 'Resume', 'Edit the source on the left, see the compiled PDF on the right, or upload a Word, PDF or .tex file to replace it.');
top.appendChild(action('Upload', { outlined: true, icon: 'UploadFile' }));
editor.appendChild(space(20));
var panes = box({ name: 'panes', gap: 16 });
add(editor, panes, 'FILL', 'FILL');

function pane(name, title) {
  var p = box({ name: name, dir: 'V', radius: 20, fill: 'surface', stroke: 'border', clip: true });
  add(panes, p, 'FILL', 'FILL');
  var head = box({ name: 'header', h: 41, gap: 8, pad: [0, 12, 0, 12], align: 'CENTER', justify: 'SPACE_BETWEEN', fill: 'surface2', stroke: 'border', bottomOnly: true });
  add(p, head, 'FILL');
  head.appendChild(tx(title, { size: 12, weight: 'Medium', color: 'ink2', lh: 18 }));
  return { pane: p, head: head };
}

// The opening lines of backend/SeedTemplates/resume.tex, the resume every new account starts with.
var SOURCE = [
  '% Your resume, in LaTeX. Edit it under Templates; a tailoring run starts from it.',
  '%',
  '% The format is frozen: a run rewrites only the bullets inside each itemize block and',
  '% the three skills lines. Everything else here, including this preamble, the heading and',
  '% every employer, title and date, is copied through untouched.',
  '\\documentclass[9pt]{article}',
  '\\usepackage[margin=0.45in]{geometry}',
  '\\usepackage{enumitem}',
  '\\usepackage{hyperref}',
  '\\usepackage{titlesec}',
  '\\hypersetup{',
  '    colorlinks=true,',
  '    urlcolor=blue',
  '}',
  '\\titleformat{\\section}{\\bfseries\\small}{}{0em}{}[\\titlerule]',
  '\\setlist[itemize]{noitemsep, topsep=0pt, leftmargin=2em}',
  '\\setlength{\\parindent}{0pt}',
  '\\begin{document}',
  '\\pagestyle{empty}',
  '\\begin{center}',
  '{\\LARGE \\textbf{Alex Rivera}}\\\\',
  '\\vspace{1mm}',
  '\\href{https://example.com/}{alexrivera.example.com} \\textbar{}',
  'alex@example.com \\textbar{}',
  '(555)-010-0100',
  '\\end{center}',
  '\\section{Education}',
  '\\textbf{State University} \\hfill Aug 2021 - May 2025\\\\',
  'B.S. Computer Science\\\\[4pt]',
  '\\textbf{City Community College} \\hfill Aug 2019 - Jun 2021\\\\',
  'A.S. Mathematics',
  '',
  '\\section{Experience}',
  '\\textbf{Northwind Logistics : Software Engineer} \\hfill Jun 2025 - Present'
];

var source = pane('template-source', 'Resume source');
var code = box({ name: 'LatexEditor', gap: 14, pad: [12, 16, 12, 12], clip: true });
add(source.pane, code, 'FILL', 'FILL');
code.appendChild(tx(SOURCE.map(function (line, index) { return String(index + 1); }).join('\n'), { name: 'line numbers', size: 12, color: 'muted', mono: true, lh: 19, align: 'RIGHT' }));
code.appendChild(tx(SOURCE.join('\n'), { name: 'source', size: 12, mono: true, lh: 19 }));
var bar = box({ name: 'actions', gap: 8, pad: 10, align: 'CENTER', stroke: 'border' });
bar.strokeTopWeight = 1; bar.strokeBottomWeight = 0; bar.strokeLeftWeight = 0; bar.strokeRightWeight = 0;
add(source.pane, bar, 'FILL');
bar.appendChild(action('Recompile', { small: true, icon: 'PlayArrow' }));
bar.appendChild(action('Saved', { small: true, outlined: true, disabled: true }));
bar.appendChild(action('PDF', { small: true, text: true, icon: 'Download' }));
var push = box({ name: 'push', h: 1 });
add(bar, push, 'FILL');
bar.appendChild(tx('⌘/Ctrl + Enter to compile', { size: 11, color: 'muted' }));

var preview = pane('preview', 'Preview');
preview.head.appendChild(action('Add a section', { small: true, outlined: true, icon: 'Add' }));
// Stands in for the PDF that PdfPreview renders, and for the section flags beside it.
var paper = box({ name: 'PdfPreview', dir: 'V', pad: 24, align: 'CENTER', justify: 'CENTER', fill: 'surface2', clip: true });
add(preview.pane, paper, 'FILL', 'FILL');
var sheetOfPaper = box({ name: 'compiled page', dir: 'V', w: 520, h: 673, align: 'CENTER', justify: 'CENTER', fill: 'surface', stroke: 'border' });
sheetOfPaper.appendChild(tx('Compiled PDF', { size: 11.5, color: 'muted' }));
paper.appendChild(sheetOfPaper);

// ---- BillingPage ---------------------------------------------------------------------------
// maxWidth 960, padding 24px 32px 56px.
var billing = screen('BillingPage', 960, undefined, [24, 32, 56, 32]);
await header(billing, 'Plans', 'Tracking applications is free and unlimited on every plan.');
billing.appendChild(space(24));
var cards = box({ name: 'plans', gap: 16 });
add(billing, cards, 'FILL');
var planKeys = ['free', 'student', 'pro'];
for (var i = 0; i < planKeys.length; i++) add(cards, await instance('PlanCard', { plan: planKeys[i] }), 'FILL', 'FILL');
billing.appendChild(space(20));
var manage = box({ name: 'manage', gap: 4, align: 'CENTER' });
billing.appendChild(manage);
manage.appendChild(tx('Manage your card, cancel, or see invoices from your', { size: 12.5, color: 'ink2', lh: 19 }));
manage.appendChild(tx('account page', { name: 'account page', size: 12.5, weight: 'Medium', color: 'accent', lh: 19 }));

var made = [account, templates, editor, billing];
figma.viewport.scrollAndZoomIntoView(made);
await png(account, 'figma-account.png', 2);
await png(templates, 'figma-templates.png', 1);
await png(editor, 'figma-templates-resume.png', 1);
await png(billing, 'figma-billing.png', 2);
return made.map(function (s) { return s.name + ' ' + Math.round(s.width) + ' x ' + Math.round(s.height); });
