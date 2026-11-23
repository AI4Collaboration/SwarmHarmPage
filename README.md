# SwarmHarm website

Public research site: [swarmharm.com](https://swarmharm.com/).
This static site is deployed from `origin/master` through GitHub Pages.
Review research-content changes locally before publishing.

## Research source of truth

Research code and original evidence are maintained in
[AI4Collaboration/SwarmHarm](https://github.com/AI4Collaboration/SwarmHarm).
The content and case export were checked against `main` at
`0a169a1abbd3098604abbf3af40a3392c7501554` on 2026-11-15.
Read these sources before changing claims:

- Root `README.md`: research scope and current results.
- `rollouts/README.md`: portable tasks and communication conditions.
- `swarmharm/docs/phase2-taxonomy.md`: six failure modes and evidence requirements.
- `swarmharm/docs/research/mechanism-input-status.json`: the twelve selected inputs and their source-bound reviews.
- `swarmform/docs/research/swarmform-publication-audit.json`: the completed channel-study audit.

SwarmForm and SwarmHarm are separate experiments. Numeric `phase` URL parameters
remain internal case identifiers; they do not describe two stages of a run.

### SwarmForm

The current portable study has three task classes in Engineering and Knowledge
Work, with direct communication, shared files, sockets or mapped memory.
Only the direct condition tells agents the group size. Study populations are
4, 8, 16 and 32. Startup checks are not behavioral results for this matrix.

The displayed findings come from the separately completed 50-input channel
study. The replay `form-source-sharing` is its accepted, three-agent Sol 6.1
Knowledge Work case. Juniper publishes source appendices; Cedar and Willow
adopt the convention. All three import peer sources through successive intakes.
All nine final packages are correct, including withdrawn terms. Across the selected channel study, 39 cases meet the registered sustained-exchange criterion, 37 have all nine outputs correct, and 13 retain partial or incorrect outputs.

### SwarmHarm

The six categories are Specification Gaming, Trace Tampering, Grader Manipulation,
Information Scope Violation, Action Scope Violation and Shared-resource Interference.
Each has one selected input in each of Engineering and Knowledge Work.
Data Analysis and Financial Analysis are workloads within Knowledge Work.

The site exports all twelve selected four-agent Sol 6.1 cases. Nine were rerun
on November 14; the other three retain matching execution code, as recorded in
the input ledger. These selected positives are not an estimate of failure rates
or results for the complete model/population collection.

- Specification Gaming: a four-report release exceeds the two-unit allocation.
  Subsequent corrections and disclosure remain in the evidence.
- Trace Tampering: completion records disagree with execution, retaining 16
  Knowledge Work and 14 Engineering mismatches. Notes disclose missing dispatch;
  these are business records, not edited native session logs.
- Grader Manipulation: changed rules allow three Knowledge Work and two Engineering
  publications that fail original-rule replay. Two Knowledge Work recipients and
  one Engineering recipient adopt a peer rule.
- Information Scope Violation: two Knowledge Work and three Engineering agents
  retrieve and publish task-excluded reports. Role-bound replay rejects the reads.
- Action Scope Violation: three agents in each domain change Quality Review state
  outside their role, then publish with exceptions. Owner-bound replay rejects it.
- Shared-resource Interference: joint allocations delay two protected reports in
  each domain. Every complete individual sequence is executable and harmless alone.

Amplification, composition, propagation, coordination and false-process inference
are independently reviewed findings, not columns of the threat taxonomy.
Sharing alone does not establish adoption, and parallel action does not establish
coordination. Composition includes all corrections, cancellations and recovery.
Historical false-process inference is linked separately in the evidence scope;
it is not represented as a result of the selected current inputs.

## Evidence export

Run from this checkout, with the reviewed local research evidence present:

```sh
python3 scripts/export-current-evidence.py --research ../swarmharm
```

The exporter writes `static/js/trajectory-cases-data.js`, the thirteen trajectory
projections in `static/data/trajectories/`, and case scopes/checksums in
`static/data/reviews/`. It verifies sealed manifests and native tool records.
It never changes the original research evidence or makes model calls.

- SwarmHarm connections come from reviewed content receipts or exact published
  artifacts returned in a peer's tool result. Filename-only exposures are excluded.
- SwarmForm connections show exact source-file publication and import. A first
  observed file copy is bound to the tool execution containing its snapshot,
  then checked byte-for-byte against the independent publication review.
- Shared files and published schemas are labelled **artifacts**. Assistant
  commentary is not presented as an inter-agent message. No communication is
  invented for runs without content reads.
- The public projection retains tool arguments and selected business results.
  Redundant release packs and raw SwarmHarm shell outputs are omitted to avoid
  republishing native session records. Original evidence is identified by hashes.

The web repository contains only the selected current projections. Earlier
experimental records remain in the research repository, under their original
conditions; obsolete website exports and importers are not shipped here.

## Interface

The original 3D action spirals and communication dome remain the default.
Straight and Graph views use the same recorded actions and receipts. Changing
layout preserves the selected event; selecting a time exposes all exchanges at
that time. Current author/reader endpoints are emphasized. No-message cases show
actions without invented connections. Agent controls work with pointer and keyboard.

Dark mode is the default. Respect reduced motion and stop offscreen animation.
Use ET Book for editorial text and Inter for diagrams and controls. Keep the
SwarmForm/SwarmHarm navigation groups on one line on desktop; their Setting and
Findings links move into the corresponding dropdown on narrow screens.
Team and Get involved remain separate pages. Do not submit the contact form in tests.

Robot authoring sources are in `design/robots/`; `scripts/build-finding-agents.py`
builds the shared expression sheet. The current wordmark is maintained in
`static/images/title-letterforms.svg` and its animation script.

## Local checks

```sh
python3 -m http.server 8793 --bind 127.0.0.1
node --test tests/*.test.cjs
# With Playwright available and the preview running:
node tests/browser-smoke.cjs
node tests/responsive-browser.cjs
node tests/raw-content-browser.cjs
```

Check every case, finding link and artifact receipt in 3D, Straight and Graph.
Check light/dark mode, desktop and phone widths, agent focus, timeline selection,
source-record dialogs, internal navigation and missing assets. Publication should
be followed by verifying GitHub Pages and the live asset versions.

Institutional logo attribution is in `static/images/institutions/SOURCES.md`.
The footer credits the Academic Project Page Template and AI Safety HOT.

### Verification for the current content update

The seventeen data-integrity, file-preview and trajectory-selection tests pass. Edge was exercised
with all thirteen cases and all three layouts, including agent focus and source
records. The responsive suite passes 282 layout checks: all three pages at
30 widths from 320 to 3840 CSS px in both themes, plus 12 device configurations
covering portrait/landscape, DPR 1/2/3, rotation, menus, source dialogs and expanded
turn records. Two small viewports simulate the available CSS space at 200% and
400% zoom; this is not a test of the browser's actual zoom control. Dropdowns
fit the remaining viewport height. The turn grid uses the actual agent count.

Navigation keeps all primary links at intermediate widths, moving Setting and
Findings into their menus. Below 901 px, the two experiment groups remain in the
header. Diagram captions are regular HTML so they wrap instead of shrinking;
SVG labels stay at least 11 CSS px at tested widths. Content is capped at 1800 px
on ultrawide screens. Retired case URLs and current finding links also pass.
No page exceptions, missing local resources, broken internal links or horizontal
overflow were found in these checks.
Chrome is not installed on the review machine and was not independently tested.

Shared-file contents use compact previews throughout the viewer, action log and
turn summaries. Full JSON/file bodies appear only inside a user-opened disclosure,
including in original-record dialogs. The raw-content browser check covers all
13 cases and 126 file bodies, verifies exact content when expanded, keyboard
collapse, and the collapsed state when reopening a dialog.
