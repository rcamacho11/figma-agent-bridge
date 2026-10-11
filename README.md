# Claude Script Runner

A Figma plugin that runs scripts sent from the terminal, so UI and UX screens can be
built in the open Figma file and exported as PNG for a design doc.

Figma is for UI and UX work only: screens, mockups, click-through flows. Diagrams
(architecture, sequence, state, ERD, CFG) are draw.io, never Figma.

```
run.js  --POST /run-->  bridge.js (127.0.0.1:3055)  <--long-poll--  plugin window in Figma
```

## Set up, once

1. Figma desktop: Plugins > Development > Import plugin from manifest, and pick
   `manifest.json` in this folder.
2. Open the file to draw in, then Plugins > Development > Claude Script Runner. Keep its
   window open.

## Use

```bash
node run.js --status                             # no bridge, no plugin, or connected
node run.js scripts/<screen>.js --out <folder for PNGs>
node run.js -e "return figma.currentPage.name"
node --test                                      # the bridge tests, no Figma needed
```

## resumesx

`scripts/resumesx/` holds the resumesx design library. Files are joined in order:

```bash
cd scripts/resumesx
node ../../run.js icons.js lib.js components.js --out <folder>   # page "resumesx / Components"
node ../../run.js icons.js lib.js dashboard.js --out <folder>    # page "resumesx / Screens"
```

- `icons.js`: Material icon paths, generated from the app's `node_modules/@mui/icons-material`.
- `lib.js`: theme tokens as Figma variables (named as in `theme.ts`), fonts, and builders.
- `components.js`: one Figma component per React component, under the same name. It
  rebuilds the page, so re-run every screen script after it.
- `dashboard.js`: `DashboardPage`, made only of instances. Copy it to start a new screen.
- `screens.js`: the pages behind the dashboard, each its own frame: `AccountPage`,
  `TemplatesPage`, `TemplatesPage / Resume` and `BillingPage`. Run it after `components.js`.
- `prototype.js`: makes the dashboard clickable and links it to the pages from `screens.js`. Each open state (menu, dialogs, add form,
  status list) is a clone of the screen, linked by click. Run it after `dashboard.js` and `screens.js`.
- `interactions.js`: click behaviour on the components (delete arms, filter chips toggle).
  Run it after `components.js`.

Full rebuild order: `components.js`, `interactions.js`, `dashboard.js`, `screens.js`,
`prototype.js`.

`run.js` starts the bridge in the background when it is not running and leaves it running; what
the bridge prints then goes to `.bridge.log`. `node bridge.js` still works when you want it in a
terminal. To stop a background bridge, end its process; `http://127.0.0.1:3055/status` shows
the process id as `pid`.

With the plugin window closed, a script is turned away within 10 seconds instead of waiting for
its `--timeout`. A script may run for up to 600 seconds.

The plugin window can be open in more than one Figma file. `node run.js --status` lists the
files, and `--file "<name>"` sends a script to one of them; the name is matched without regard
to case. With two files connected and no `--file`, `run.js` refuses to guess and lists them.

The plugin window shows the file it is in, what is running and for how long, and under that
how the last script ended; an error stays there in red until another script takes its place.
The bridge prints one line when a plugin window connects or goes, and one when a script starts,
saves a PNG, ends, fails or is turned away.

Scripts run one at a time in each file. A second `run.js` waits until the first script has finished in
Figma, even when the first one has passed its `--timeout`: `run.js` then exits with code 2 and
says the script is still running, and the next script starts when it really ends. Closing and
reopening the plugin window drops a script that never ends.

If the bridge is restarted while a script runs, the plugin window keeps its result and sends it
again until the bridge answers.

PNG exports stall while the Figma window is minimised or covered. `exportPng` skips an export
after 15 seconds, says so and returns `null`; bring Figma to the front and run again to get the
PNG. Each PNG is written to the `--out` folder the moment it is exported, so a script that fails
later keeps the ones it had made. One PNG can be up to 96 MB.

A script is the body of an async function with `figma`, `h`, `exportPng` and `log` in
scope. The helpers in `h` are defined at the top of `code.js`: `font`, `page`, `board`,
`frame`, `text`, `box`, `arrow`, `hex`, `paint`. Re-running a script replaces the board
of the same name.

Scripts run in Figma's sandbox: no object spread, no `?.`, no `??`.

After changing `code.js` or `ui.html`, close the plugin window and run it again.
