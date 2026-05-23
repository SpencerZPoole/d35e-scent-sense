# UX Improvement Plan

This document captures future user-experience work for `d35e-scent-sense`.
It does not change the `v1.0.0` runtime behavior.

## Goal

Make the module easier for a new GM to install, understand, diagnose, and use at
the table without reducing GM control or weakening player privacy.

## Current UX Baseline

The stable release already provides the core product surfaces:

- Module settings for alert scope, wall respect, notifications, and rings.
- Token HUD ring toggles for owned or GM-viewed Scent sources.
- GM-only **Scent Menu** plus a separate **View Scent Trails** toggle in Token Controls.
- Chat/dialog alerts for presence, direction requests, and pinpoint events.
- Public API diagnostics such as `getScentRangeBreakdown` and dry-run migration.

The likely friction is not missing RAW coverage; it is discoverability,
explanation, and confidence. A GM can do the work, but the module should make the
next step more obvious.

## Product Testing First

Before implementing UX changes, run a scratch-world product pass focused on a
new GM's first hour:

- Install from the manifest URL and enable the module.
- Add Scent to a test actor and confirm the ring/detection mode appears.
- Trigger a presence alert, direction request, and pinpoint alert.
- Open **Scent Menu**, use **Advanced Scent Context**, set scene defaults, add
  token overrides, then reset them with `inherit`.
- Create, preview, prompt, show/hide, record movement for, and delete a Scent
  trail.
- Run `getScentRangeBreakdown` on a working token and on a deliberately broken
  setup.
- Record every place where the next action is unclear, the label is too terse,
  or the GM has to open documentation to continue.

## Prioritized Improvements

### 1. First-Run GM Onboarding

Add a GM-only first-run checklist that appears once per world or can be reopened
from settings. It should link to the user manual, module settings, Scent Menu,
View Scent Trails, Advanced Scent Context, and basic diagnostics.

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

Continue improving the **Scent Menu** and **Advanced Scent Context** surfaces with compact help
text, clearer empty states, and hover/tooltips for fields that are easy to
misread:

- `inherit`
- `false odor`
- `odor tags`
- `GM Marked`
- tracker eligibility
- water state
- competing odor

### 4. Clearer Direction Flow

Improve the wording around direction requests so the player and GM understand
the handshake:

- player receives presence and may request direction
- GM receives context and decides what to reveal
- GM marks the request as revealed after adjudication

This should remain GM-assisted and should not automate action spending.

### 5. Trail Preview Confidence

Make trail results easier to understand by showing short reason text beside DC
previews and prompt buttons:

- tracker has Scent and Track
- tracker is missing Track
- trail is inactive
- trail has no path segments yet
- trail is hidden from players
- water state prevents tracking for this tracker
- roll prompt created instead of rolled directly

### 6. Support Bundle

Add a GM-only copyable support summary that includes non-secret module facts:

- Foundry version
- D35E version
- module version
- alert settings
- selected token Scent source breakdown
- active scene context summary
- recent diagnostic reason labels

Do not include world secrets, private campaign notes, hidden target identity, or
local machine paths.

## Release Shape

Treat these improvements as candidates for a future `v1.1.0` release after
scratch-world product testing. Keep changes incremental and preserve the stable
`v1.0.0` public API.

## Acceptance Criteria For Future UX Work

- A new GM can install the module, identify the main tools, and diagnose a
  missing Scent source without reading code.
- Player-facing messages still do not reveal hidden target identity.
- Existing settings, APIs, context flags, odor profile flags, trails, and
  migration helpers remain backward compatible.
- `npm test`, public-surface scan, localization check, and local security gate
  pass before release.
