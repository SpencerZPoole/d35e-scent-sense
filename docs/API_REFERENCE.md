# API Reference

This document records the stable public API for the `v1.x` release line as of `v1.2.2`. New helpers may be added later, but the names and result fields below should remain backward compatible unless a future major version says otherwise.

## Entry Points

- `game.d35eScentSense` and `globalThis.d35eScentSense`: main module API after Foundry initialization.
- `game.d35eScentSense.rules` and `globalThis.d35eScentSenseRules`: pure Scent rule helpers.
- `game.d35eScentSense.context` and `globalThis.d35eScentSenseContext`: context flag normalization helpers.
- `game.d35eScentSense.odorProfile` and `globalThis.d35eScentSenseOdorProfile`: odor profile helpers.
- `game.d35eScentSense.state` and `globalThis.d35eScentSenseState`: detection state helpers.
- `game.d35eScentSense.trails` and `globalThis.d35eScentSenseTrails`: compatible source/trail record helpers.

## D35E Sheet Data

The normal D35E sheet path is **Attributes > Senses > pencil > Scent**. That
editor writes the base range to `system.attributes.senses.scent`. During actor
preparation, D35E may also expose the prepared value at `system.senses.scent`.
The range helpers below read both locations and use the highest positive value.

## Stable Runtime API

- `getScentRange(actorOrToken)`: returns the highest valid Scent range found for a D35E actor or token.
- `getScentRangeBreakdown(actorOrToken, options)`: returns `range`, contributing sources, ignored sources, and token detection-mode sync diagnostics.
- `hasScent(actorOrToken)`: returns `true` when the effective range is positive.
- `getEffectiveScentRange(sourceToken, targetToken, options)`: returns the RAW-aware effective range after wind, odor strength, and masking context.
- `evaluateScentDetection(sourceToken, targetToken, options)`: compatibility detection helper.
- `evaluateScentState(sourceToken, targetToken, options)`: preferred state helper for consumers that need presence, direction, and pinpoint distinctions.
- `getScentContext(sourceToken, targetToken, options)`: returns effective wind, odor, masking, false odor, and tag context with source metadata. Created Scent Sources take precedence for their source token.
- `setScentContextFlags(document, values, options)`: GM-only setter for module-owned scene or token context flags. This remains supported for macros and legacy data; the normal GM UI stores source-specific values on Scent Source records.
- `getOdorProfile(documentOrToken, options)`: returns effective odor profile values and source metadata.
- `setOdorProfileFlags(document, values, options)`: GM-only setter for module-owned odor profile flags.
- `identifyFamiliarOdor(actor, targetProfile, options)`: returns familiar tag matches without revealing identity automatically.
- `getTrackingByScentDc(options)`: returns a RAW-derived Scent tracking DC helper result.
- `canTrackByScent(actor)`: returns `true` only when the actor has Scent and a Track feat item.
- `getScentSources(scene, options)`: returns normalized scene Scent Source records.
- `createScentSource(scene, data)`, `updateScentSource(scene, sourceId, data)`, and `deleteScentSource(scene, sourceId)`: GM-only scene source CRUD helpers. Create/update return compatibility objects containing the normalized record under `trail`; delete returns `{ deleted: true }` on success.
- `getScentSourceDc(sourceOrId, tracker, options)`: returns tracking eligibility and DC details for one source/trail.
- `getScentSourceDisplayState(segmentOrSource, options)`: returns age, fade state, visibility, and opacity metadata for source trail display.
- `getScentTrails(scene, options)`, `createScentTrail(scene, data)`, `updateScentTrail(scene, trailId, data)`, `deleteScentTrail(scene, trailId)`, `getScentTrailDc(trailOrId, tracker, options)`, and `getScentTrailDisplayState(segmentOrTrail, options)`: legacy-compatible aliases for the source APIs. Stored scene flags remain `scentTrails` for backward compatibility.
- `rollTrackByScent(trackerToken, trailId, options)`: creates a private redacted owner+GM tracking prompt plus a GM-only detail prompt by default. Pass `nativeRoll: true` only when the caller explicitly wants to use the D35E native roll path.
- `openContextManager(options)` and `openTrailManager(options)`: GM-only ApplicationV2 tools. The primary toolbar entry is the unified Scent Menu; `openContextManager` is preserved for compatibility and now opens that same menu instead of a separate context window.
- `migrateFlags(options)`: GM-only migration helper; dry-run by default.
- `syncActorTokens(actor)`, `refresh(options)`, `scan(options)`, `resetNotificationState(options)`, `isOverlayVisible(actorOrToken)`, and `setOverlayVisible(actorOrToken, visible)`: runtime integration and local Scent-ring presentation helpers.
- `isTrailOverlayVisible()`, `setTrailOverlayVisible(visible)`, and `toggleTrailOverlay()`: client-local trail path preview state helpers used by both the Scent Menu preview button and View Scent Trails toolbar toggle.

## Detection Result Shape

Detection and state helpers return a plain object with these stable fields:

- `detectable`, `pinpoint`, `band`, `reason`, `reasons`
- `baseRange`, `effectiveRange`, `distance`, `pinpointRange`, `context`
- `state`, `states`, `notificationBand`
- `directionAvailable`, `directionRequested`, `directionRevealed`, `directionStatus`, `requiresGmDirection`

Valid `state` values are `none`, `presence`, `directionAvailable`, `directionRequested`, `directionRevealed`, and `pinpoint`.

## Flag Boundary

The module reads older scene, token, and actor flags for context inheritance, but the GM Scent Menu now stores source-specific odor and wind values on created Scent Source records. `migrateFlags` normalizes module-owned scene, token, and trail data; it reports actor flag anomalies without editing actors.

Scent Source records are stored in the legacy `scentTrails` scene flag. Normalized records include `active`, `recordMovement`, `visibleToPlayers`, `sourceTokenId`, `createdWorldTime`, `updatedWorldTime`, `windBand`, water/odor/DC fields, notes, an odor profile snapshot, and `pathSegments`. Path segments store `trailId`, `sourceTokenId`, `sceneId`, `createdWorldTime`, `start`, and `end` canvas coordinates.

Masking odor is a mechanical detection suppressor. False odor and odor tags are preserved in context/profile data and can support familiar-odor checks, but they do not modify range or identify creatures automatically.

## Chat Privacy Boundary

Scent alert and tracking chat cards are private module-flagged whispers. Owner
cards are redacted and sent only to the sensing token's active assigned/owner
user plus active GMs. GM detail cards may include hidden target identity, scene
context, source notes, or exact adjudication details, but those cards are
GM-only. Module-flagged Scent cards with no whisper recipients, public fallback
recipients, or non-GM recipients on secret-bearing cards are rejected before
creation.
