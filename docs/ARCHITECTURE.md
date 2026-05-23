# Architecture

`d35e-scent-sense` is organized around small browser-loaded runtime modules. The module does not use a bundler; script order in `module.json` is the load contract.

## Runtime Shape

The main `scripts/d35e-scent-sense.js` file is now the orchestrator. It owns constants, settings registration, public API wiring, lifecycle hooks, and scan coordination.

Supporting runtime modules own the specialized behavior:

- `scent-rules.js`: pure SRD-derived Scent calculations and tracking helpers.
- `scent-context.js`: pure context flag normalization and precedence.
- `scent-odor-profile.js`: pure odor profile normalization, familiar odor tag matching, and profile flag planning.
- `scent-trails.js`: pure trail record normalization, age/DC helpers, and prompt redaction.
- `scent-d35e-sources.js`: pure D35E Scent source discovery and range diagnostics.
- `scent-migration.js`: pure migration planning for module-owned scene, token, and trail flags.
- `scent-state.js`: pure detection-state normalization for presence, direction request/reveal status, and pinpoint.
- `scent-detection.js`: Foundry-aware target filtering, distance measurement, and wall blocking.
- `scent-overlay.js`: local Scent rings, pinpoint cues, Token HUD overlay toggles, and visual trail path rendering.
- `scent-alerts.js`: sockets, owner alerts, GM whispers, direction requests, and pinpoint notifications.
- `scent-d35e-integration.js`: D35E sense registration, detection mode registration, token detection mode syncing, and refresh patching.
- `scent-context-manager.js`: GM-only ApplicationV2 context manager used by the Advanced Scent Context path.
- `scent-trail-manager.js`: GM-only Scent Menu, active trail list, trail CRUD, View Scent Trails toolbar registration, DC previews, and roll prompt actions.
- `scent-api.js`: public API object construction for `game.d35eScentSense`.

## Design Rules

- Pure rules stay free of Foundry globals so they can be tested with Node.
- Foundry-specific code is grouped by responsibility instead of accumulated in the bootstrap script.
- Player-facing alerts must not reveal hidden target identity unless the GM has already adjudicated it.
- GM tools may write module-owned scene and token flags; actor flags are read as inherited context but not edited by the context manager.
- Trail records are GM/API-authored scene data. Movement path segments are recorded only for active trails whose GM-controlled `recordMovement` flag is enabled.
- Trail path visibility is client-local for the overlay toggle and GM-controlled for player access through each trail's `visibleToPlayers` flag.
- Release artifacts must not include private world data, compendia, media assets, fonts, sourcebook prose, or local machine paths.

## Future Architecture Work

The next major architecture changes should continue adding stateful service boundaries without changing existing APIs:

- Additional migration helpers for future schema changes.
- `v1.0.0` freezes the public API shape in `docs/API_REFERENCE.md`; new helper additions should remain backward compatible unless a later major release says otherwise.
