# Architecture

`d35e-scent-sense` is organized around small browser-loaded runtime modules. The module does not use a bundler; script order in `module.json` is the load contract.

## Runtime Shape

The main `scripts/d35e-scent-sense.js` file is now the orchestrator. It owns constants, settings registration, public API wiring, lifecycle hooks, and scan coordination.

Supporting runtime modules own the specialized behavior:

- `scent-rules.js`: pure SRD-derived Scent calculations and tracking helpers.
- `scent-context.js`: pure context flag normalization and precedence.
- `scent-odor-profile.js`: pure odor profile normalization, familiar odor tag matching, and profile flag planning.
- `scent-trails.js`: pure compatible source/trail record normalization, age/DC helpers, and prompt redaction.
- `scent-d35e-sources.js`: pure D35E Scent source discovery and range diagnostics.
- `scent-migration.js`: pure migration planning for module-owned scene, token, and trail flags.
- `scent-state.js`: pure detection-state normalization for presence, direction request/reveal status, and pinpoint.
- `scent-detection.js`: Foundry-aware target filtering, distance measurement, and wall blocking.
- `scent-overlay.js`: local Scent rings, pinpoint cues, Token HUD overlay toggles, and visual trail path rendering.
- `scent-alerts.js`: socket payloads, private owner+GM alerts, GM-only detail whispers, direction requests, pinpoint notifications, and chat privacy guards.
- `scent-d35e-integration.js`: D35E sense registration, detection mode registration, token detection mode syncing, and refresh patching.
- `scent-context-manager.js`: legacy compatibility runtime for the older standalone context manager path. It is retained for API compatibility, but the user-facing workflow is the unified Scent Menu.
- `scent-trail-manager.js`: GM-only Scent Menu, Scent Source CRUD, source table editing, the Show/Hide Trail Preview menu button, and View Scent Trails toolbar registration.
- `scent-api.js`: public API object construction for `game.d35eScentSense`.

## Design Rules

- Pure rules stay free of Foundry globals so they can be tested with Node.
- Foundry-specific code is grouped by responsibility instead of accumulated in the bootstrap script.
- Player-facing alerts must not reveal hidden target identity unless the GM has already adjudicated it. Module-created Scent chat cards must be private whispers; secret-bearing cards must be GM-only and fail closed if recipients are unsafe.
- The current GM menu writes source-specific scene records. Older scene, token, and actor context flags remain readable for compatibility.
- Scent Source records are GM/API-authored scene data stored in the legacy `scentTrails` flag. Movement path segments are recorded only for active sources whose GM-controlled `recordMovement` flag is enabled.
- Trail path visibility is client-local for the overlay toggle and GM-controlled for player access through each source's `visibleToPlayers` flag.
- Masking odor is kept in the main source workflow because it suppresses detection. False odor, odor tags, and notes are advanced GM details because they are metadata/helper fields rather than primary detection controls.
- Release artifacts must not include private world data, compendia, media assets, fonts, sourcebook prose, or local machine paths.

## Future Architecture Work

The next major architecture changes should continue adding stateful service boundaries without changing existing APIs:

- Additional migration helpers for future schema changes.
- The `v1.x` line keeps the public API shape in `docs/API_REFERENCE.md` backward compatible unless a later major release says otherwise.
