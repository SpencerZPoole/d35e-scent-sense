# Release Readiness Audit

Date: 2026-05-20

## Scope

This audit covers the public release copy of `d35e-scent-sense`.

## Findings

- No bundled media assets are present.
- No compendium packs, stat blocks, adventure text, setting lore, or private campaign data are present.
- Public metadata uses `3.5e SRD` and `D35E Foundry system` wording.
- Original code and documentation are covered by `LICENSE.md`.
- SRD-derived Scent mechanics are identified under `OGL-1.0a.txt`.
- The manifest includes release `manifest` and `download` URLs for tag `v0.8.2`.
- Corrective `v0.8.1` runtime validation caught and fixed a linked-token-only sync path so D35E Scent detection modes now reconcile linked and unlinked active tokens.
- Corrective `v0.8.2` runtime validation caught and fixed `noVisionOverride` handling so manually controlled D35E token vision no longer suppresses Scent sync.
- The manifest enables the package socket namespace required by owner/GM Scent alerts.
- The rules helper layer covers wind range, odor strength, masking odor, pinpoint, and tracking-by-scent DC calculations without copying source prose.
- The GM Scent Context manager writes only module-owned scene and token flags.
- The odor profile layer adds false odor and familiar odor tag helpers without automatically revealing target identity to players.
- The Scent trail layer stores GM-authored scene trail records, computes Scent tracking DC previews, and redacts player-facing roll prompts by default.
- The D35E integration helper reports Scent range sources, ignored item sources, and token detection-mode status for diagnostics.
- The migration helper provides dry-run-first normalization for module-owned scene, token, and trail flags without editing actor flags.
- Live scratch-world product testing verifies item-granted Scent ranges on D35E actors with token vision override disabled, odor profile precedence, masking suppression, context-manager render controls, trail-manager render controls, Scent trail DC previews, roll prompt cleanup, and scan execution.
- Template and stylesheet files are included in validation and public-surface scanning.
- Runtime responsibilities are split across focused helper scripts before the main lifecycle script.
- The detection-state layer distinguishes presence, direction availability, direction requests, GM-revealed direction, and pinpoint without writing ordinary scan state to world data.
- RAW coverage, architecture, and v1 roadmap docs are present for publication review.

## Remaining Human Review

This repository is ready for technical publication review, but final public release should still receive human legal/content review before listing or broad distribution.
