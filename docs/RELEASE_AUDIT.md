# Release Readiness Audit

Date: 2026-05-21
Updated: 2026-05-24 after Scent Source hard live QA and documentation audit

## Scope

This audit covers the public release copy of `d35e-scent-sense`.

## Findings

- Public package-page screenshot assets are live Foundry captures from the scratch D35E world and are present under `docs/assets/foundry-page/`.
- No non-documentation media assets are present.
- No compendium packs, stat blocks, adventure text, setting lore, or private campaign data are present.
- Public metadata uses `3.5e SRD` and `D35E Foundry system` wording.
- Original code and documentation are covered by `LICENSE.md`.
- SRD-derived Scent mechanics are identified under `OGL-1.0a.txt`.
- The manifest includes release `manifest` and `download` URLs for tag `v1.2.0`.
- Corrective `v0.8.1` runtime validation caught and fixed a linked-token-only sync path so D35E Scent detection modes now reconcile linked and unlinked active tokens.
- Corrective `v0.8.2` runtime validation caught and fixed `noVisionOverride` handling so manually controlled D35E token vision no longer suppresses Scent sync.
- The manifest enables the package socket namespace required by owner/GM Scent alerts.
- The rules helper layer covers wind range, odor strength, masking odor, pinpoint, and tracking-by-scent DC calculations without copying source prose.
- The Scent Menu writes source-specific scene records for created Scent Sources while older scene/token/actor odor flags remain compatible.
- The odor profile layer adds false odor and familiar odor tag helpers without automatically revealing target identity to players.
- The Scent source/trail layer stores GM-authored scene source records, computes Scent tracking DC helper results, and redacts player-facing roll prompts by default when API users invoke the roll helper.
- `v1.1.0` adds a unified Scent Menu, a separate View Scent Trails toggle, GM-enabled movement path recording, age-based trail display states, and explicit GM/player trail visibility controls.
- `v1.1.1` keeps `v1.1.0` runtime behavior stable while replacing staged package-page screenshots with live scratch-world captures and adding automated GitHub/Foundry publishing.
- `v1.2.0` completes the public Scent Source workflow with a one-page GM menu, source-specific odor controls, Scent Source API aliases, backward-compatible trail APIs, and updated public docs/screenshots.
- Live validation on Foundry VTT `14.362` and D35E `3.0.2` verified module load, public APIs, odor masking, trail recording, overlay rendering, toolbar/menu preview synchronization, and cleanup behavior.
- Hard live QA on 2026-05-24 verified actor Scent setup, no-Scent behavior, normal/double/triple range, upwind/downwind, 5 ft pinpoint, hidden targets, wall blocking, masking suppression, false odor metadata, odor-tag familiar matching, token HUD ring toggles, Scent Source creation/edit/delete, source path recording, trail overlay rendering, scene switching, reload, and module disable/re-enable recovery.
- The current Scent Menu copy treats masking odor as a primary mechanical control and moves false odor, odor tags, and notes into Advanced GM details so the table workflow stays readable.
- The D35E integration helper reports Scent range sources, ignored item sources, and token detection-mode status for diagnostics.
- The migration helper provides dry-run-first normalization for module-owned scene, token, and trail flags without editing actor flags.
- Live scratch-world product testing verifies item-granted Scent ranges on D35E actors with token vision override disabled, odor profile precedence, masking suppression, Scent Source controls, source/menu render controls, Scent trail helper results, roll prompt cleanup, scan execution, and cleanup after temporary QA data.
- Template and stylesheet files are included in validation and public-surface scanning.
- Runtime responsibilities are split across focused helper scripts before the main lifecycle script.
- The detection-state layer distinguishes presence, direction availability, direction requests, GM-revealed direction, and pinpoint without writing ordinary scan state to world data.
- RAW coverage, architecture, and v1 roadmap docs are present for publication review.
- The public API reference, user guide, package-page description, and release process docs are present for stable-release review.
- Localization coverage is checked by `tools/check-localization.mjs` and included in `npm run validate`.
- GitHub Actions runs the same validation suite on pushes and pull requests.

## Remaining Human Review

This repository is ready for technical publication review, but final public release should still receive human legal/content review before listing or broad distribution.
