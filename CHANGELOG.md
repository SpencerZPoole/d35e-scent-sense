# Changelog

## Unreleased

## 1.1.1 - 2026-05-23

- Replaced public package-page screenshots with live Foundry captures from a neutral scratch D35E world.
- Added GitHub release packaging automation and Foundry Package Release API publishing support.
- Updated release notes, release process docs, package-page description, validation tooling, and release audit for the live-screenshot release workflow.
- Kept runtime Scent behavior and public APIs unchanged from `v1.1.0`.

## 1.1.0 - 2026-05-23

- Redesigned the GM trail workflow around one Scent Menu plus a separate View Scent Trails toggle.
- Added path-aware Scent trail records with movement recording, GM/player visibility controls, path segment storage, and age-based trail display states.
- Fixed automatic trail movement recording to derive destination centers from Foundry token update coordinates when available.
- Fixed View Scent Trails toolbar synchronization so the toolbar toggle and Scent Menu preview button share the same visible overlay state.
- Fixed the Scent Menu toolbar callback path so opening and closing the menu does not make View Scent Trails open the menu.
- Fixed explicit odor-profile masking in `evaluateScentDetection`.
- Merged advanced context access into the Scent Menu and removed the separate Scent Context toolbar button.
- Updated trail validation, localization, styles, public documentation, and release-surface wording for the new visual trail workflow.
- Verified live behavior against Foundry VTT `14.362` and D35E `3.0.2`.

## 1.0.0 - 2026-05-21

- Promoted the release-candidate feature set to the stable public release.
- Updated release metadata, validation expectations, documentation, and release audit for `v1.0.0`.
- Preserved the `v0.9.0` public API and runtime behavior without adding new RAW automation.
- Revalidated local checks, packaged assets, downloaded release artifacts, and scratch-world runtime behavior for the stable release.

## 0.9.0 - 2026-05-21

- Added release-candidate documentation for the stable public API, user workflow, and release process.
- Added GitHub Actions validation for `npm test`.
- Added localization coverage validation and wired it into the normal test suite.
- Updated release metadata and validation expectations for `v0.9.0`.
- Kept runtime Scent mechanics unchanged after `v0.8.2` scratch-world product testing.

## 0.8.2 - 2026-05-20

- Fixed D35E `noVisionOverride` handling so it is reported diagnostically but does not suppress Scent range or `scentPinpoint` sync.
- Kept unsupported actor-type guards intact while allowing character and npc actors with manually controlled token vision to use Scent.
- Updated D35E integration/source tests for the live D35E flag behavior.

## 0.8.1 - 2026-05-20

- Fixed token detection-mode sync to include both linked and unlinked active tokens.
- Added a regression test for Foundry's linked-token filter argument.
- Rebuilt release assets after scratch-world runtime validation found the linked-only sync path.

## 0.8.0 - 2026-05-20

- Added a focused D35E source helper for Scent range diagnostics across prepared actor senses, base actor senses, and eligible item senses.
- Hardened `scentPinpoint` detection-mode reconciliation for duplicate modes, unsupported actor types, unlinked tokens, and D35E `noVisionOverride`.
- Added `game.d35eScentSense.getScentRangeBreakdown`, `migrateFlags`, and an integration-status diagnostic.
- Added a GM-only dry-run-first flag migration helper for module-owned scene, token, and trail data.
- Added D35E integration, migration tests, and an upstream-ready integration note.

## 0.7.1 - 2026-05-20

- Removed the legacy `renderChatMessage` hook registration now that the module targets Foundry 14 and uses `renderChatMessageHTML`.
- Kept `v0.7.0` Scent trail APIs and behavior unchanged while cleaning the live runtime warning surfaced during scratch-world validation.

## 0.7.0 - 2026-05-20

- Added a pure Scent trail helper layer for GM-authored scene trails, age calculation, Scent tracking DC previews, water-state handling, Track/Scent eligibility, and prompt redaction.
- Added `game.d35eScentSense.trails`, `openTrailManager`, `createScentTrail`, `updateScentTrail`, `deleteScentTrail`, `getScentTrailDc`, and `rollTrackByScent`.
- Added a GM-only Scent Trails manager in Token Controls for scene trail records and optional Survival roll prompts.
- Updated validation, tests, documentation, and release metadata for the tracking layer.

## 0.6.3 - 2026-05-20

- Preserved false odor and odor tag metadata on detection results after RAW range evaluation normalizes wind, odor strength, and masking context.
- Completed final scratch-world product validation for the odor profile detection context path.

## 0.6.2 - 2026-05-20

- Fixed Scent range discovery for D35E actors with `noVisionOverride` enabled; that D35E option controls token vision override behavior and should not suppress Scent.
- Completed scratch-world product validation for item-granted Scent ranges, odor profiles, masking, context-manager controls, and scan execution.

## 0.6.1 - 2026-05-20

- Fixed runtime Scent range discovery for D35E item collections so item-granted Scent ranges are read correctly in live worlds.
- Kept the `v0.6.0` odor profile API and GM context manager behavior unchanged.

## 0.6.0 - 2026-05-20

- Added a pure odor-profile helper layer for odor strength, masking odors, false odor sources, and familiar odor tags.
- Added `game.d35eScentSense.getOdorProfile`, `setOdorProfileFlags`, `identifyFamiliarOdor`, and `game.d35eScentSense.odorProfile`.
- Extended the GM Scent Context manager with false odor and odor tag controls for scene and token flags.
- Added GM-facing odor profile details to Scent context output without changing player-facing identity privacy.
- Updated validation, tests, documentation, and release metadata for the odor profile layer.

## 0.5.0 - 2026-05-20

- Added a pure detection-state helper for presence, available direction requests, requested direction, GM-revealed direction, and 5 ft pinpoint.
- Added `game.d35eScentSense.evaluateScentState(sourceToken, targetToken, options)` and `game.d35eScentSense.state`.
- Kept `evaluateScentDetection` backward compatible while adding non-breaking state metadata.
- Added runtime-only direction request and reveal tracking with a GM-only reveal action.
- Updated validation, tests, documentation, and release metadata for the new state layer.

## 0.4.0 - 2026-05-20

- Added RAW coverage, architecture, and v1 roadmap documentation.
- Split the Foundry runtime into focused helper modules for detection, overlay, alerts/socket handling, D35E integration, context manager UI, and API construction.
- Preserved the existing public API and behavior while reducing the size and responsibility of the main lifecycle script.
- Updated validation to require the new helper scripts and release metadata.

## 0.3.0 - 2026-05-20

- Added a GM-only Scent Context manager in Token Controls for scene defaults, token odor context, masking odors, and GM-marked Scent relevance.
- Added context helper APIs for opening the manager, reading effective context, and setting module context flags.
- Added a pure context helper script with Node tests for flag precedence, normalization, and inherit/unset behavior.
- Added module stylesheet and template validation coverage for the new manager.

## 0.2.0 - 2026-05-20

- Added a pure RAW-aware Scent rules helper layer for wind, odor strength, masking odors, pinpoint detection, and tracking-by-scent DCs.
- Added public API helpers under `game.d35eScentSense.rules` and direct convenience methods for effective range, detection evaluation, and tracking DCs.
- Added lightweight token, actor, and scene flag support for Scent context without adding new UI.
- Added an `allCreatures` alert scope for broader non-hostile Scent adjudication.
- Added pure Node tests for the new Scent rules helpers.

## 0.1.1 - 2026-05-20

- Added the required Foundry module socket manifest flag for owner/GM alert messaging.
- Pointed the Foundry manifest license field at `LICENSE.md`.
- Hardened validation so socket-using scripts require `"socket": true`.

## 0.1.0 - 2026-05-20

- Staged a public-safe source copy of the local D35E Scent Sense module.
- Added MIT licensing for original code and documentation.
- Added OGL v1.0a notices for SRD-derived Scent mechanics.
- Rewrote publish-facing metadata to use 3.5e SRD and D35E Foundry system wording.
- Added validation and public-surface scan tooling.
