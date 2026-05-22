# D35E Scent Sense

`d35e-scent-sense` is a Foundry Virtual Tabletop module for the D35E system. It adds conservative 3.5e SRD Scent support for tokens and actors, including presence alerts, optional owner/GM range rings, and 5 ft pinpoint detection.

This repository contains module code, public-safe documentation, and validation tooling only. It does not include copied rulebook prose, stat blocks, adventure text, setting lore, compendium data, artwork, audio, fonts, or private campaign material.

## Compatibility

- Foundry Virtual Tabletop: minimum `14`, verified `14.361`
- D35E system: minimum `3.0.2`, verified `3.0.2`
- Module version: `1.0.0`

## Release Status

This repository is release-manifest-ready for stable version `1.0.0`.

Install through this manifest URL:

```text
https://github.com/SpencerZPoole/d35e-scent-sense/releases/latest/download/module.json
```

For development testing, copy or clone this folder into your Foundry `Data/modules` directory, then enable **D35E Scent Sense** in a D35E world.

## Features

- Registers `scent` as a D35E sense label when the D35E system is active.
- Adds a Foundry detection mode for 5 ft Scent pinpoint handling.
- Reads Scent range from D35E prepared actor senses, base actor senses, and eligible item senses.
- Provides Scent range source diagnostics and module-owned flag migration helpers.
- Adds owner/GM-local Scent range rings.
- Sends owner and GM alerts for presence, direction requests, and pinpoint events.
- Keeps GM adjudication in the loop for direction and exact-location calls.
- Tracks Scent detection state for presence, available direction requests, requested direction, GM-revealed direction, and 5 ft pinpoint.
- Provides RAW-aware helper calculations for wind, odor strength, masking odors, and tracking by Scent.
- Adds odor profiles for odor strength, masking odors, false odor sources, and familiar odor tags.
- Adds a GM-only Scent Context manager for scene defaults, token odor profile context, masking odors, false odors, odor tags, and GM-marked Scent relevance.
- Adds GM-authored scene Scent trails, a Trail Manager, Scent tracking DC previews, and optional Survival roll prompts.
- Documents the v1 RAW coverage target and splits runtime behavior into focused modules for safer future development.
- Freezes the public API shape intended to remain stable through `v1.0.0`.
- Adds localization coverage checks and continuous validation for stable-release review.

## Usage

Give a D35E actor a positive Scent range through the actor sense data or an active item sense value. The module uses `30` as the default SRD-derived Scent range where its own helper constants are needed, and `5` for pinpoint handling.

The module exposes `game.d35eScentSense` after initialization:

```js
game.d35eScentSense.getScentRange(actor);
game.d35eScentSense.getScentRangeBreakdown(actor);
game.d35eScentSense.hasScent(actor);
game.d35eScentSense.getEffectiveScentRange(sourceToken, targetToken);
game.d35eScentSense.evaluateScentDetection(sourceToken, targetToken);
game.d35eScentSense.evaluateScentState(sourceToken, targetToken);
game.d35eScentSense.getTrackingByScentDc({ trailAgeHours: 2 });
game.d35eScentSense.getScentContext(sourceToken, targetToken);
game.d35eScentSense.getOdorProfile(targetToken);
game.d35eScentSense.identifyFamiliarOdor(sourceToken.actor, { odorTags: ["wolf"] });
game.d35eScentSense.setScentContextFlags(token.document, { odorStrength: "strong" });
game.d35eScentSense.setOdorProfileFlags(token.document, { falseOdor: true, odorTags: "wolf, smoke" });
game.d35eScentSense.openContextManager();
game.d35eScentSense.openTrailManager();
game.d35eScentSense.createScentTrail(canvas.scene, { sourceToken: token });
game.d35eScentSense.getScentTrailDc(trail, trackerToken);
game.d35eScentSense.rollTrackByScent(trackerToken, trail.id);
game.d35eScentSense.migrateFlags({ dryRun: true });
game.d35eScentSense.refresh({ persist: true });
```

The rules helper is also available at `game.d35eScentSense.rules` and `globalThis.d35eScentSenseRules`. Context flag normalization is available at `game.d35eScentSense.context` and `globalThis.d35eScentSenseContext`. Odor profile helpers are available at `game.d35eScentSense.odorProfile` and `globalThis.d35eScentSenseOdorProfile`. Detection-state helpers are available at `game.d35eScentSense.state` and `globalThis.d35eScentSenseState`. Trail helpers are available at `game.d35eScentSense.trails` and `globalThis.d35eScentSenseTrails`.

`evaluateScentDetection` returns a compatibility object with `detectable`, `pinpoint`, `band`, `reason`, `reasons`, `baseRange`, `effectiveRange`, `distance`, `context`, `state`, `states`, `directionAvailable`, `directionRequested`, `directionRevealed`, `directionStatus`, `requiresGmDirection`, and `notificationBand`. `evaluateScentState` returns the same state metadata and should be preferred by consumers that need to distinguish presence, direction request, revealed direction, and pinpoint.

Lightweight Scent context can be supplied through API options or flags on the target token, target actor, or scene:

```js
await token.document.setFlag("d35e-scent-sense", "windBand", "upwind");
await token.document.setFlag("d35e-scent-sense", "odorStrength", "strong");
await token.document.setFlag("d35e-scent-sense", "maskingOdor", true);
await token.document.setFlag("d35e-scent-sense", "falseOdor", true);
await token.document.setFlag("d35e-scent-sense", "odorTags", ["wolf", "smoke"]);
```

Supported context values are `normal`, `upwind`, and `downwind` for wind; `normal`, `strong`, and `overpowering` for odor strength; booleans for masking and false odors; and comma-separated or array odor tags for familiar-odor helpers. Tracking helpers compute RAW-derived DCs only; they do not roll Survival or replace GM adjudication.

GMs can also open **Scent Context** from Token Controls to edit scene defaults and current-scene token flags. Selecting `inherit` clears the module flag and returns that value to the normal precedence chain. Familiar odor matching is GM-facing helper data only; the module does not automatically identify a hidden creature for players.

GMs can open **Scent Trails** from Token Controls to create scene-level trail records from current-scene tokens, preview tracking DCs for a selected scent-capable tracker, and create a redacted Survival prompt. Trails are not generated automatically by movement; they are GM/API-authored records stored on the scene under this module's flags.

## Development Roadmap

The current release is a conservative Scent helper, not complete silent automation of every table ruling. See:

- `docs/RAW_COVERAGE_MATRIX.md` for current RAW coverage and gaps.
- `docs/ARCHITECTURE.md` for the runtime split and design rules.
- `docs/API_REFERENCE.md` for the stable public API shape.
- `docs/USER_GUIDE.md` for installation and table-facing use.
- `docs/D35E_INTEGRATION_NOTE.md` for D35E integration boundaries.
- `docs/RELEASE_PROCESS.md` for release and validation gates.
- `docs/V1_ROADMAP.md` for the milestone history behind stable `v1.0.0`.

## Content And License Boundary

Original code and documentation are licensed under MIT. SRD-derived Scent mechanics are handled under the Open Game License v1.0a; see `OGL-1.0a.txt`.

This module is an independent community module. It is not affiliated with Foundry Gaming LLC, the D35E system maintainers, or any tabletop publisher.

## Public Safety Checks

Run the local validation suite before publishing or packaging:

```bash
npm test
```

The checks verify manifest structure, required legal files, script syntax, localization coverage, RAW helper behavior, odor profile behavior, trail behavior, D35E integration helpers, migration helpers, and public-surface cleanliness.

## Support

If D35E Scent Sense helps your table or your module work, optional support is welcome: [paypal.me/mrpooley92](https://paypal.me/mrpooley92).

The module remains free, independent, and bound by the license boundaries documented above.
