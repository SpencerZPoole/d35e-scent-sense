# D35E Integration Note

This note documents how `d35e-scent-sense` integrates with the D35E Foundry system as of `v1.2.1` and the current Scent Source workflow.

## Current Integration Points

- Registers `CONFIG.D35E.senses.scent` when the D35E system is active.
- Registers `CONFIG.Canvas.detectionModes.scentPinpoint` for the module's 5 ft pinpoint overlay behavior.
- Reads Scent range from D35E prepared actor senses, base actor sense data, and eligible item senses.
- The normal D35E actor-sheet workflow writes Scent to `system.attributes.senses.scent` from **Attributes > Senses > pencil > Scent**. D35E may then expose the prepared value at `system.senses.scent`; the module reads both paths and uses the highest valid positive range.
- Reconciles token and prototype-token detection modes only for D35E character and npc actors.
- Reconciles linked and unlinked active tokens.
- Reports D35E `noVisionOverride` in diagnostics without treating it as a Scent-disabled state.

## Refresh Wrapper

D35E refreshes token sight and detection modes through `TokenDocument.refreshDetectionModes()`. The module still wraps that method because no narrower public D35E hook is available for adding a third-party sense-derived detection mode after D35E recalculates token senses.

The wrapper is intentionally narrow:

- It only installs in D35E worlds.
- It is idempotent.
- It only touches this module's `scentPinpoint` detection mode.
- It respects unsupported actor types and leaves D35E sight automation boundaries alone.
- Persistent writes are GM-only and tagged with module sync options to avoid actor update loops.

## Possible Upstream Hook

An upstream D35E integration point could let modules register a callback after token detection modes are rebuilt. A stable hook or service with the token document, actor, current detection modes, and update context would allow this module to stop wrapping `refreshDetectionModes()`.

No upstream pull request is included in this release.

`v1.0.0` promoted the release-candidate feature set to a stable release; the D35E runtime integration behavior remains the `v0.8.2` behavior that passed scratch-world product testing.

`v1.2.0` does not change the D35E sense-source integration path. It completes the public Scent Source workflow around the existing D35E sheet data, `scentPinpoint` sync, and actor range discovery behavior while keeping legacy source/trail APIs compatible.

`v1.2.1` keeps gameplay behavior unchanged. It refreshes the shipped in-game package description and installed documentation/screenshot parity for the current Scent Source workflow.
