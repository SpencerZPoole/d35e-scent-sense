# V1 Roadmap

This roadmap turns the current Scent helper into a stable `v1.0.0` module with documented RAW coverage and conservative GM-assisted automation.

## v0.4.0 Foundation

- Add this roadmap, the RAW coverage matrix, and architecture notes.
- Split the Foundry runtime into focused modules while preserving current behavior and public APIs.
- Keep `d35e-scent-sense.js` as the lifecycle and scan orchestrator.

## v0.5.0 Detection State

- Add explicit detection states: `presence`, `directionAvailable`, `directionRequested`, `directionRevealed`, and `pinpoint`.
- Add `game.d35eScentSense.evaluateScentState(sourceToken, targetToken, options)`.
- Keep `evaluateScentDetection` as a compatibility wrapper with non-breaking state metadata.
- Track direction-request and GM-revealed events cleanly for GM adjudication without automatically spending actions.

## v0.6.0 Odor Profiles

- Add token, actor, and scene odor profiles.
- Add familiar odor tags and identification helpers.
- Add false/powerful odor source flags and context-manager controls.
- Add `getOdorProfile`, `setOdorProfileFlags`, and `identifyFamiliarOdor`.

## v0.7.0 Scent Tracking

- Store scene-level trail records under module-owned scene flags.
- Track source identity, age/world time, water state, competing odor, odor modifier, and optional size/count notes.
- Add a GM Trail Manager.
- Add optional owner/GM Survival roll prompts for tracking by Scent.
- Add `openTrailManager`, trail CRUD helpers, `getScentTrailDc`, and `rollTrackByScent`.

## v0.8.0 D35E Integration Hardening

- Normalize Scent range discovery across prepared actor data, item senses, active buffs, active auras, and token detection modes.
- Add migration helpers for module flags.
- Reduce runtime patch risk where D35E exposes a cleaner integration path.
- Prepare an upstream-ready integration note or PR proposal after the module behavior is stable.

## v0.9.0 Release Candidate

- Freeze the public API for v1.
- Finish user and maintainer docs.
- Improve localization coverage.
- Add CI for `npm test`.
- Run scratch-world Foundry validation, downloaded artifact validation, and local security scanning.

## v1.0.0 Stable Release

- Publish a release whose docs accurately state automated, GM-assisted, and manual-adjudication boundaries.
- Ship fresh manifest and zip assets.
- Keep the release public-safe: no private campaign data, compendia, bundled media, copied sourcebook prose, or local paths.
