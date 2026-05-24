# UX Improvement Plan

This document captures future user-experience work for `d35e-scent-sense`
after the `v1.2.0` Scent Source workflow release and the 2026-05-24 hard live Scent Source QA pass.

## Goal

Make the module easier for a new GM to install, understand, diagnose, and use at
the table without reducing GM control or weakening player privacy.

## Current UX Baseline

The current product surface already provides:

- Module settings for alert scope, wall respect, notifications, and rings.
- Token HUD ring toggles for owned or GM-viewed Scent sources.
- GM-only **Scent Menu** plus a separate **View Scent Trails** toggle in Token Controls.
- Chat/dialog alerts for presence, direction requests, and pinpoint events.
- Public API diagnostics such as `getScentRangeBreakdown` and dry-run migration.

The 2026-05-24 polish pass also established these UI rules:

- The menu is one page: **Create New Scent Source** followed by **Scene Scent Sources**.
- Masking odor stays visible in the main workflow because it suppresses Scent detection.
- False odor, odor tags, and notes live under **Advanced GM details** because they are helper/metadata fields.
- **Source leaves trail** is the user-facing label for movement recording.

The likely friction is not missing RAW coverage; it is discoverability,
explanation, and confidence. A GM can do the work, but the module should make the
next step more obvious.

## Product Testing First

Before implementing UX changes, run a scratch-world product pass focused on a
new GM's first hour:

- Install from the manifest URL and enable the module.
- Add Scent to a test actor and confirm the ring/detection mode appears.
- Trigger a presence alert, direction request, and pinpoint alert.
- Open **Scent Menu**, create a Scent Source, edit its source-specific odor and
  wind fields, then save it.
- Show/hide, record movement for, and delete a Scent Source that leaves a trail.
- Run `getScentRangeBreakdown` on a working token and on a deliberately broken
  setup.
- Record every place where the next action is unclear, the label is too terse,
  or the GM has to open documentation to continue.

## Prioritized Improvements

### 1. First-Run GM Onboarding

Add a GM-only first-run checklist that appears once per world or can be reopened
from settings. It should link to the user manual, module settings, Scent Menu,
View Scent Trails, Scent Source setup, and basic diagnostics.

Keep it concise. The goal is orientation, not an in-game manual wall.

### 2. Built-In Diagnostics Panel

Add a "Why is Scent not working?" panel that wraps existing diagnostics:

- selected token Scent range and source breakdown
- ignored item/source reasons
- token detection-mode sync status
- alert scope and wall setting summary
- context values that can suppress or change detection

The panel should be GM-only by default and should avoid exposing hidden target
identity to players.

### 3. Manager Help And Empty States

Continue improving the **Scent Menu** source table with compact help text,
clearer empty states, and hover/tooltips for fields that are easy to misread:

- **Source leaves trail**
- water state
- competing odor

False odor and odor tags should remain documented and discoverable, but they should stay visually secondary unless a future familiar-odor workflow makes them more central.

### 4. Clearer Direction Flow

Improve the wording around direction requests so the player and GM understand
the handshake:

- player receives presence and may request direction
- GM receives context and decides what to reveal
- GM marks the request as revealed after adjudication

This should remain GM-assisted and should not automate action spending.

### 5. Trail Visibility Confidence

Make source trail results easier to understand by showing short reason text
beside path and trackability facts:

- source is inactive
- source has no path segments yet
- source is hidden from players
- **Source leaves trail** is disabled
- water state affects tracking helper results

### 6. Support Bundle

Add a GM-only copyable support summary that includes non-secret module facts:

- Foundry version
- D35E version
- module version
- alert settings
- selected token Scent source breakdown
- active Scent Source summary
- recent diagnostic reason labels

Do not include world secrets, private campaign notes, hidden target identity, or
local machine paths.

## Release Shape

Treat these improvements as candidates for a future `v1.3.0` release after
scratch-world product testing. Keep changes incremental and preserve the stable
`v1.x` public API.

## Acceptance Criteria For Future UX Work

- A new GM can install the module, identify the main tools, and diagnose a
  missing Scent source without reading code.
- Player-facing messages still do not reveal hidden target identity.
- Existing settings, APIs, context flags, odor profile flags, source/trail records, and
  migration helpers remain backward compatible.
- `npm run validate`, public-surface scan, localization check, and local security gate
  pass before release.
