# API Reference

This document records the stable public API for the `v1.x` release line as of `v1.1.0`. New helpers may be added later, but the names and result fields below should remain backward compatible unless a future major version says otherwise.

## Entry Points

- `game.d35eScentSense` and `globalThis.d35eScentSense`: main module API after Foundry initialization.
- `game.d35eScentSense.rules` and `globalThis.d35eScentSenseRules`: pure Scent rule helpers.
- `game.d35eScentSense.context` and `globalThis.d35eScentSenseContext`: context flag normalization helpers.
- `game.d35eScentSense.odorProfile` and `globalThis.d35eScentSenseOdorProfile`: odor profile helpers.
- `game.d35eScentSense.state` and `globalThis.d35eScentSenseState`: detection state helpers.
- `game.d35eScentSense.trails` and `globalThis.d35eScentSenseTrails`: trail record helpers.

## Stable Runtime API

- `getScentRange(actorOrToken)`: returns the highest valid Scent range found for a D35E actor or token.
- `getScentRangeBreakdown(actorOrToken, options)`: returns `range`, contributing sources, ignored sources, and token detection-mode sync diagnostics.
- `hasScent(actorOrToken)`: returns `true` when the effective range is positive.
- `getEffectiveScentRange(sourceToken, targetToken, options)`: returns the RAW-aware effective range after wind, odor strength, and masking context.
- `evaluateScentDetection(sourceToken, targetToken, options)`: compatibility detection helper.
- `evaluateScentState(sourceToken, targetToken, options)`: preferred state helper for consumers that need presence, direction, and pinpoint distinctions.
- `getScentContext(sourceToken, targetToken, options)`: returns effective wind, odor, masking, false odor, and tag context with source metadata.
- `setScentContextFlags(document, values, options)`: GM-only setter for module-owned scene or token context flags.
- `getOdorProfile(documentOrToken, options)`: returns effective odor profile values and source metadata.
- `setOdorProfileFlags(document, values, options)`: GM-only setter for module-owned odor profile flags.
- `identifyFamiliarOdor(actor, targetProfile, options)`: returns familiar tag matches without revealing identity automatically.
- `getTrackingByScentDc(options)`: returns a RAW-derived Scent tracking DC helper result.
- `canTrackByScent(actor)`: returns `true` only when the actor has Scent and a Track feat item.
- `getScentTrails(scene, options)`: returns normalized scene trail records.
- `createScentTrail(scene, data)`, `updateScentTrail(scene, trailId, data)`, and `deleteScentTrail(scene, trailId)`: GM-only scene trail CRUD helpers.
- `getScentTrailDc(trailOrId, tracker, options)`: returns tracking eligibility and DC details for one trail.
- `getScentTrailDisplayState(segmentOrTrail, options)`: returns age, fade state, visibility, and opacity metadata for trail display.
- `rollTrackByScent(trackerToken, trailId, options)`: attempts a compatible native Survival roll or creates a redacted prompt.
- `openContextManager(options)` and `openTrailManager(options)`: GM-only ApplicationV2 tools. The primary toolbar entry is the unified Scent Menu; Advanced Scent Context remains available through that menu and the API.
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

The module reads scene, token, and actor flags for context inheritance, but the GM managers write only scene and token flags. `migrateFlags` normalizes module-owned scene, token, and trail data; it reports actor flag anomalies without editing actors.

Trail records are scene flags. Normalized records include `active`, `recordMovement`, `visibleToPlayers`, `sourceTokenId`, `createdWorldTime`, `updatedWorldTime`, water/odor/DC fields, notes, an odor profile snapshot, and `pathSegments`. Path segments store `trailId`, `sourceTokenId`, `sceneId`, `createdWorldTime`, `start`, and `end` canvas coordinates.
