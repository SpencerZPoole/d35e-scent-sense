# Changelog

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
