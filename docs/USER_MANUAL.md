# D35E Scent Sense User Manual

This manual is the table-facing guide for installing, configuring, and using
`d35e-scent-sense` in a Foundry VTT world running the D35E system.

The module is intentionally conservative. It automates repeatable Scent checks
where the 3.5e SRD mechanics are clear, gives the GM tools for context and
tracking, and keeps judgment calls visible instead of silently deciding every
table ruling.

## Table Of Contents

- [1. Overview](#1-overview)
- [2. Requirements](#2-requirements)
- [3. Installation](#3-installation)
- [4. Updating, Disabling, And Uninstalling](#4-updating-disabling-and-uninstalling)
- [5. First Setup Checklist](#5-first-setup-checklist)
- [6. Giving A Creature Scent](#6-giving-a-creature-scent)
- [7. Scent Detection At The Table](#7-scent-detection-at-the-table)
- [8. Settings And Controls](#8-settings-and-controls)
- [9. GM Scent Context Manager](#9-gm-scent-context-manager)
- [10. Odor Profiles](#10-odor-profiles)
- [11. Scent Trails And Tracking](#11-scent-trails-and-tracking)
- [12. Diagnostics And Admin Helpers](#12-diagnostics-and-admin-helpers)
- [13. Troubleshooting](#13-troubleshooting)
- [14. Support Checklist](#14-support-checklist)
- [15. Legal And Content Boundary](#15-legal-and-content-boundary)

## 1. Overview

`d35e-scent-sense` adds Scent support for the D35E Foundry system. It registers
the Scent sense, adds 5 ft pinpoint handling, scans active scene tokens, sends
owner and GM alerts, and gives the GM context tools for wind, odor strength,
masking odors, false odors, familiar odor tags, and GM-authored scent trails.

### What The Module Automates

- Scent range discovery from supported D35E actor and item data.
- Scent presence checks against current scene tokens.
- 5 ft pinpoint detection and token detection-mode syncing.
- Effective range helpers for wind and odor strength.
- Masking odor suppression when the GM marks it active.
- Owner and GM alert routing.
- Runtime state for presence, direction request, direction reveal, and pinpoint.
- Scent tracking DC helper values for GM-authored trails.

### What Stays GM-Assisted

- Whether a player spends the needed table action to request direction.
- What direction or location detail the GM reveals.
- Whether a false odor or familiar odor tag should matter in the scene.
- Whether a trail exists, when it starts, and what it represents.
- Whether a roll prompt should become a real table roll.

### What Remains Manual

- Automatic movement-based trail creation.
- Automatic hidden-creature identification for players.
- Automatic action-spending enforcement.
- Complete environmental modeling beyond the module's context fields.
- Any ruling that depends on table-specific circumstances.

## 2. Requirements

- Foundry VTT: minimum `14`, verified with `14.361`.
- D35E system: minimum `3.0.2`, verified with `3.0.2`.
- A D35E world where the module is enabled.
- GM permissions for context editing, trail management, migration helpers, and
  most diagnostics.

The module is distributed through GitHub releases. The current stable module
version is `1.0.0`.

## 3. Installation

### Recommended Manifest Install

1. Open Foundry VTT Setup.
2. Go to **Add-on Modules**.
3. Choose **Install Module**.
4. Paste this manifest URL:

   ```text
   https://github.com/SpencerZPoole/d35e-scent-sense/releases/latest/download/module.json
   ```

5. Confirm the install.
6. Launch a D35E world.
7. Open **Game Settings** and then **Manage Modules**.
8. Enable **D35E Scent Sense**.
9. Save module settings and reload the world when Foundry asks.

### Manual Zip Install

Use this path only if the manifest installer is unavailable.

1. Open the latest GitHub release for `SpencerZPoole/d35e-scent-sense`.
2. Download the release zip named like `d35e-scent-sense-v1.0.0.zip`.
3. Extract the zip into your Foundry user data module folder so the module
   folder is named `d35e-scent-sense`.
4. Confirm that `module.json` is directly inside that folder, not inside an
   extra nested folder.
5. Restart Foundry VTT or reload Setup.
6. Enable **D35E Scent Sense** in your D35E world.

Expected folder shape:

```text
Data/modules/d35e-scent-sense/module.json
Data/modules/d35e-scent-sense/scripts/
Data/modules/d35e-scent-sense/templates/
Data/modules/d35e-scent-sense/styles/
```

## 4. Updating, Disabling, And Uninstalling

### Updating

For a manifest install, use Foundry's normal module update flow. The stable
manifest URL always resolves to the latest published release.

For a manual zip install, replace the existing `d35e-scent-sense` module folder
with the contents of the newer release zip. Keep the same folder name and
confirm that `module.json` is still at the module root.

Module-owned scene and token flags are stored in the world, not in the module
folder, so replacing the module folder does not delete your scene context or
trail records.

### Disabling

Open **Manage Modules** in the world and uncheck **D35E Scent Sense**. The
module stops registering its runtime behavior after the world reloads. Existing
module flags remain inert unless the module is enabled again.

### Uninstalling

Disable the module in every world that uses it, then remove the
`d35e-scent-sense` module folder or uninstall it through Foundry Setup. If you
want to remove stored scene/token flags too, use Foundry's normal document tools
or a deliberate migration/cleanup script after making a world backup.

## 5. First Setup Checklist

After enabling the module in a D35E world:

1. Reload the world once.
2. Confirm **D35E Scent Sense** appears in **Manage Modules** as active.
3. Confirm the world uses the D35E system.
4. Add or verify one actor with a positive Scent range.
5. Place that actor as a token in a test scene.
6. Select the token and confirm the Token HUD can toggle the local Scent ring.
7. As GM, open Token Controls and confirm **Scent Context** and **Scent Trails**
   tools are available.
8. Use the console diagnostic below if Scent is not working as expected:

   ```js
   game.d35eScentSense.getScentRangeBreakdown(canvas.tokens.controlled[0])
   ```

## 6. Giving A Creature Scent

The module treats an actor or token as a Scent source when it finds a positive
Scent range from supported D35E data.

Supported sources include:

- D35E prepared actor senses.
- D35E base actor sense data.
- Eligible item-granted senses.
- A compatibility fallback world flag on an otherwise eligible item.

The module chooses the highest valid Scent range it finds. If a source is
ignored, the range breakdown diagnostic reports why.

### Eligible Item Sources

The item-source helper is conservative. It accepts appropriate race, class,
feat, active buff, active aura, and equipped usable equipment sources. It ignores
sources that are not active or are otherwise marked as unavailable, such as
broken, melded, or unequipped equipment.

### Pinpoint Detection Mode

When a token has Scent, the module reconciles a `scentPinpoint` token detection
mode at 5 ft. The sync is intended to be idempotent: one token should not collect
duplicate `scentPinpoint` entries.

If the token loses Scent, the module removes the synced pinpoint mode during
refresh.

## 7. Scent Detection At The Table

The module scans current scene tokens and evaluates Scent in bands and states.

### Detection States

- `none`: no Scent detection.
- `presence`: the source can smell something nearby.
- `directionAvailable`: the source can request direction information.
- `directionRequested`: the player has requested direction and the GM has been
  prompted.
- `directionRevealed`: the GM has marked the direction request resolved.
- `pinpoint`: the target is within 5 ft.

### Presence Alerts

Presence alerts tell a token owner that something is nearby. They do not reveal
the hidden target's identity to the player.

### Direction Requests

When a player chooses to request direction, the module whispers supporting
details to the GM. The GM decides what direction to reveal and can mark the
request as revealed. The module tracks the state, but it does not spend actions
or decide the direction automatically.

### Pinpoint Alerts

Within 5 ft, the module can notify the owner and GM that the source is in the
pinpoint band. The GM still controls how exact location information is described
at the table.

### Privacy Boundary

Player-facing messages are deliberately vague. GM-facing messages can include
target names, range details, context values, and trail notes so the GM can
adjudicate clearly.

## 8. Settings And Controls

Open **Configure Settings** for the module to adjust alert and overlay behavior.

### Scent Alert Scope

- **Unknown hostiles**: default. Alerts focus on hostile targets that are not
  already plainly known to the source.
- **All hostiles**: alerts can trigger for any hostile target.
- **All creatures**: alerts can trigger for all actor tokens.
- **GM-marked hostiles**: alerts use the GM's `scentRelevant` marking.

### Respect Walls

When enabled, automated Scent alerts are blocked through walls and closed
barriers. The GM can still override or adjudicate unusual circumstances manually.

### Presence And Pinpoint Alerts

The GM can enable or disable presence alerts and pinpoint alerts separately.
These settings affect automated notifications, not the underlying API helpers.

### Notification Mode

Each client can choose dialog alerts or chat-only alerts. This is a client
preference so different users can receive Scent notifications in different ways.

### Scent Rings

The module can draw local Scent range rings for tokens the current user owns or
that the GM can view. The Token HUD includes a Scent ring toggle for individual
tokens.

## 9. GM Scent Context Manager

The **Scent Context** tool is GM-only and appears in Token Controls. It edits
module-owned scene and token flags.

Use it to:

- Set scene defaults for wind, odor strength, and masking odor.
- Override individual token context.
- Mark a token as Scent-relevant for the GM-marked alert scope.
- Add false odor and odor tag data.
- Preview effective Scent context from a selected scent-capable source token.

### Inherit Values

Selecting `inherit` clears the value at that document level. The module then
falls back through its normal precedence chain:

1. Explicit API options.
2. Target token flags.
3. Target actor flags.
4. Scene flags.
5. Neutral defaults.

The manager writes scene and token flags only. Actor flags are readable for
inheritance but are not edited by this UI.

### Scene Defaults

Scene defaults are useful when the entire scene shares a wind band, odor
condition, or masking odor state.

### Token Overrides

Token overrides are useful when one creature or object has a stronger odor,
false odor, specific familiar odor tags, or a masking odor state that differs
from the scene.

## 10. Odor Profiles

Odor profiles let the GM describe how a target smells without revealing identity
to players automatically.

### Odor Strength

Supported strengths are:

- `normal`
- `strong`
- `overpowering`

Strength affects helper range calculations and previews.

### Masking Odor

When masking odor is active, the detection helper suppresses detection for that
target/context. Use this for table situations where another odor overwhelms or
conceals the relevant scent.

### False Odor

False odor is GM-facing metadata. It helps the GM track that an odor is
misleading, but it does not automatically lie to players or identify a creature.

### Odor Tags

Odor tags are short GM-authored labels such as `wolf` or `smoke`. They support
familiar-odor helper checks and previews. Tags are helper data, not automatic
creature identification.

## 11. Scent Trails And Tracking

The **Scent Trails** tool is GM-only and appears in Token Controls. It manages
GM-authored scene trail records.

The module does not create trails from movement automatically. A trail exists
only when the GM or API creates it.

### Creating A Trail

1. Open **Scent Trails** from Token Controls.
2. Choose a source token when available.
3. Enter a trail label and any notes the GM needs.
4. Set water state, competing odor, odor DC modifier, size notes, or count notes
   if useful.
5. Create the trail.

The trail stores a source reference, creation time, active state, context fields,
and an odor profile snapshot.

### Previewing A DC

Select a scent-capable tracker in the manager to preview tracking eligibility
and DC details. The helper considers Scent, Track eligibility, trail age, water
state, competing odor, and odor modifier fields.

### Roll Prompts

The manager can create a redacted Survival prompt. Player-facing prompt text is
kept limited by default. GM-facing details can include the trail label, source,
and notes.

If a native D35E skill roll method is available, the module may attempt to use
it. Otherwise it creates a prompt and returns a `not-rolled` result so the GM can
resolve the roll manually.

### Deleting Or Inactivating Trails

Delete trails that are no longer needed, or mark them inactive when the record
should remain visible to the GM but stop being treated as trackable.

## 12. Diagnostics And Admin Helpers

These helpers are useful for GMs, module maintainers, and support reports.

### Confirm The API Is Loaded

```js
game.d35eScentSense
```

### Check A Token's Scent Sources

```js
game.d35eScentSense.getScentRangeBreakdown(canvas.tokens.controlled[0])
```

The result reports the chosen range, contributing sources, ignored sources, and
token sync diagnostics.

### Evaluate A Pair Of Tokens

```js
const [source, target] = canvas.tokens.controlled;
game.d35eScentSense.evaluateScentState(source, target);
```

Use this when you want to inspect effective range, detection state, direction
status, and pinpoint status for a specific source/target pair.

### Dry-Run Flag Migration

```js
game.d35eScentSense.migrateFlags({ dryRun: true })
```

This reports module-owned scene, token, and trail normalization work without
writing changes. Actual writes require GM permissions and `dryRun: false`.

### Open Managers From The Console

```js
game.d35eScentSense.openContextManager();
game.d35eScentSense.openTrailManager();
```

These helpers are GM-only and return `null` for users who cannot open the
manager.

## 13. Troubleshooting

### The Module Will Not Install From The Manifest

- Confirm the manifest URL is copied exactly.
- Confirm Foundry can access GitHub release assets.
- Try the manual zip install path.
- If manual install works but manifest install does not, include the manifest
  URL and Foundry setup error in the support report.

### The Module Is Installed But Not Active

- Open the world and check **Manage Modules**.
- Confirm **D35E Scent Sense** is enabled.
- Reload the world after changing module activation.
- Confirm the world is running the D35E system.

### A Token With Scent Is Not Detecting Anything

- Confirm the source token has an actor.
- Confirm the actor has a positive Scent range.
- Run `getScentRangeBreakdown` on the token.
- Confirm the target is inside the effective range.
- Check whether **Respect Walls** is blocking the alert.
- Check whether masking odor is active on the target or scene.
- Check the alert scope setting; the default does not alert for every creature.
- Try the **All creatures** scope in a scratch scene to isolate targeting logic.

### The Scent Ring Does Not Show

- Confirm **Show Scent Rings** is enabled in module settings.
- Confirm you own the token, or you are viewing as GM.
- Select the token and use the Token HUD Scent ring toggle.
- Confirm the token has a positive Scent range.

### I Get Too Many Alerts

- Use **Unknown hostiles** or **GM-marked hostiles** instead of **All creatures**.
- Disable presence alerts if you only want pinpoint alerts.
- Mark only important targets with `scentRelevant` when using GM-marked scope.
- Use scene or token context to mark masking odor where appropriate.

### No Alerts Appear

- Confirm presence and pinpoint alerts are enabled.
- Check notification mode on the current client.
- Confirm a GM user is active for GM-only alert details.
- Confirm the source and target are on the active scene.
- Run a direct `evaluateScentState` check for the source and target.

### `scentPinpoint` Is Missing Or Duplicated

- Reload the world once.
- Run `game.d35eScentSense.refresh({ persist: true })` as GM.
- Check `getScentRangeBreakdown` for sync diagnostics.
- If duplicates remain, include the token's detection modes and diagnostic
  output in the support report.

### The Context Manager Does Not Open

- Confirm you are logged in as GM.
- Confirm the world is on a supported Foundry VTT version.
- Try `game.d35eScentSense.openContextManager()` from the console.
- Check the browser console for an error beginning with `d35e-scent-sense`.

### The Trail Manager Does Not Show A DC

- Select a scent-capable tracker in the manager.
- Confirm the tracker has Scent and a Track feat item.
- Confirm the trail is active.
- Check whether the water state makes the trail unavailable for that tracker.
- Review the reason label shown by the manager.

### A Survival Roll Does Not Automatically Roll

The roll helper is best-effort. If the D35E actor does not expose a compatible
native roll method, the module creates a prompt and returns a `not-rolled`
result. Resolve the roll manually using the shown DC.

### Direction Requests Are Confusing

The module does not decide direction automatically. The player can request
direction, the GM receives context, and the GM tells the player the appropriate
direction. The GM can then mark the request as revealed.

### Updating Did Not Seem To Change Anything

Foundry keeps loaded module code in the active client until reload. After
updating the module folder or release version, fully reload the world or restart
Foundry VTT before testing.

## 14. Support Checklist

When reporting an issue, include:

- Foundry VTT version.
- D35E system version.
- `d35e-scent-sense` module version.
- Install method: manifest or manual zip.
- Whether the issue occurs after a full reload.
- Active module settings related to alert scope, walls, alerts, and rings.
- Whether the current user is GM or token owner.
- A short reproduction scene description using non-private names if possible.
- Screenshots of the relevant manager or token settings if safe to share.
- Browser console errors that mention `d35e-scent-sense`.
- Output from:

  ```js
  game.d35eScentSense.getScentRangeBreakdown(canvas.tokens.controlled[0])
  ```

- If trail-related, include the Trail Manager reason label and whether the trail
  is active.
- If context-related, include whether the value is set on scene, token, actor,
  or inherited default.

## 15. Legal And Content Boundary

Original code and documentation are licensed under MIT. SRD-derived Scent
mechanics are identified under `OGL-1.0a.txt`.

This repository and release package contain module code, templates, styles,
language strings, public-safe documentation, and validation tooling. They do not
include copied rules prose, stat blocks, adventure text, setting lore, compendium
data, artwork, audio, fonts, or private campaign material.

This is an independent community module. It is not affiliated with Foundry
Gaming LLC, the D35E system maintainers, or any tabletop publisher.
