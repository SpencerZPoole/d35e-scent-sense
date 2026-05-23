(() => {
  "use strict";

  const MODULE_ID = "d35e-scent-sense";
  const TRAIL_FLAG = "scentTrails";
  const SCHEMA_VERSION = 1;
  const MAX_TRAIL_SEGMENTS = 240;
  const TRAIL_FADE_HOURS = 72;

  const WATER_STATES = Object.freeze({
    NONE: "none",
    FLOWING_WATER: "flowingWater",
    WATER: "water",
  });

  const DEFAULT_ODOR_PROFILE = Object.freeze({
    odorStrength: "normal",
    maskingOdor: false,
    falseOdor: false,
    odorTags: [],
  });

  function normalizeToken(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  }

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function integerNumber(value, fallback = 0) {
    return Math.trunc(finiteNumber(value, fallback));
  }

  function normalizeBoolean(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;
    const token = normalizeToken(value);
    if (["true", "yes", "y", "on"].includes(token)) return true;
    if (["false", "no", "n", "off"].includes(token)) return false;
    return fallback;
  }

  function normalizeWaterState(value) {
    const token = normalizeToken(value);
    if (token === "flowingwater" || token === "flowing" || token === "stream") return WATER_STATES.FLOWING_WATER;
    if (token === "water" || token === "underwater" || token === "aquatic") return WATER_STATES.WATER;
    return WATER_STATES.NONE;
  }

  function normalizeOdorStrength(value) {
    const token = normalizeToken(value);
    if (token === "strong") return "strong";
    if (token === "overpowering" || token === "overpower") return "overpowering";
    return "normal";
  }

  function normalizeOdorTag(value) {
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function normalizeOdorTags(value) {
    const values = Array.isArray(value)
      ? value
      : String(value ?? "")
        .split(",")
        .map((entry) => entry.trim());

    return Array.from(new Set(values.map(normalizeOdorTag).filter(Boolean)));
  }

  function normalizeText(value, fallback = "") {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text || fallback;
  }

  function normalizeId(value, fallback = "") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function normalizePoint(value = {}) {
    return {
      x: finiteNumber(value.x, 0),
      y: finiteNumber(value.y, 0),
    };
  }

  function resolveTokenMovementPosition(tokenDocument = {}, changes = {}) {
    return {
      x: finiteNumber(changes.x ?? tokenDocument.x, 0),
      y: finiteNumber(changes.y ?? tokenDocument.y, 0),
    };
  }

  function hasMeaningfulMovement(start = {}, end = {}, threshold = 2) {
    const startPoint = normalizePoint(start);
    const endPoint = normalizePoint(end);
    return Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) >= finiteNumber(threshold, 2);
  }

  function normalizePathSegment(segment = {}, options = {}) {
    const worldTime = Math.max(0, finiteNumber(options.worldTime, 0));
    const createdWorldTime = Math.max(0, finiteNumber(segment.createdWorldTime ?? segment.createdAt ?? worldTime, worldTime));

    return {
      id: normalizeId(segment.id ?? options.idFactory?.(), `segment-${createdWorldTime}`),
      trailId: normalizeId(segment.trailId ?? options.trailId, ""),
      sourceTokenId: normalizeId(segment.sourceTokenId ?? options.sourceTokenId, ""),
      sceneId: normalizeId(segment.sceneId ?? options.sceneId, ""),
      createdWorldTime,
      start: normalizePoint(segment.start),
      end: normalizePoint(segment.end),
    };
  }

  function normalizePathSegments(value = [], options = {}) {
    const segments = Array.isArray(value) ? value : Object.values(value ?? {});
    return segments
      .map((segment) => normalizePathSegment(segment, options))
      .filter((segment) => segment.trailId && segment.sourceTokenId)
      .slice(-MAX_TRAIL_SEGMENTS);
  }

  function normalizeOdorProfile(profile = {}) {
    const externalNormalizer = globalThis.d35eScentSenseOdorProfile?.normalizeOdorProfile;
    if (externalNormalizer) return externalNormalizer(profile);

    return {
      odorStrength: normalizeOdorStrength(profile.odorStrength ?? profile.odor ?? profile.scentStrength),
      maskingOdor: normalizeBoolean(profile.maskingOdor ?? profile.maskedByOdor ?? profile.powerfulMaskingOdor, false),
      falseOdor: normalizeBoolean(profile.falseOdor ?? profile.falseScent ?? profile.decoyOdor, false),
      odorTags: normalizeOdorTags(profile.odorTags ?? profile.tags),
    };
  }

  function readFlag(document, key) {
    try {
      const value = document?.getFlag?.(MODULE_ID, key);
      if (value !== undefined) return value;
    } catch (_error) {
      // Plain object tests use direct flag storage.
    }

    return document?.flags?.[MODULE_ID]?.[key];
  }

  function getSceneTrailData(scene) {
    const value = readFlag(scene, TRAIL_FLAG);
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  }

  function makeFallbackId(data = {}) {
    const seed = normalizeText(data.label ?? data.sourceName ?? "trail", "trail").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `trail-${seed || "scent"}`;
  }

  function normalizeTrail(data = {}, options = {}) {
    const worldTime = Math.max(0, finiteNumber(options.worldTime, 0));
    const id = normalizeId(data.id ?? options.id ?? options.idFactory?.(), makeFallbackId(data));
    const sourceName = normalizeText(data.sourceName ?? data.sourceActorName, "");
    const label = normalizeText(data.label ?? data.name, sourceName ? `${sourceName} trail` : "Scent trail");
    const createdWorldTime = Math.max(0, finiteNumber(data.createdWorldTime ?? data.createdAt ?? worldTime, worldTime));
    const updatedWorldTime = Math.max(createdWorldTime, finiteNumber(data.updatedWorldTime ?? data.updatedAt ?? worldTime, createdWorldTime));
    const odorProfile = normalizeOdorProfile(data.odorProfile ?? data.profile ?? DEFAULT_ODOR_PROFILE);

    return {
      schemaVersion: SCHEMA_VERSION,
      id,
      active: normalizeBoolean(data.active, true),
      label,
      sourceTokenId: normalizeId(data.sourceTokenId ?? data.tokenId, ""),
      sourceActorId: normalizeId(data.sourceActorId ?? data.actorId, ""),
      sourceName,
      createdWorldTime,
      updatedWorldTime,
      waterState: normalizeWaterState(data.waterState),
      powerfulCompetingOdor: normalizeBoolean(data.powerfulCompetingOdor ?? data.competingOdor, false),
      odorDcModifier: integerNumber(data.odorDcModifier, 0),
      recordMovement: normalizeBoolean(data.recordMovement ?? data.autoRecord, false),
      visibleToPlayers: normalizeBoolean(data.visibleToPlayers ?? data.playerVisible, false),
      sizeNotes: normalizeText(data.sizeNotes, ""),
      countNotes: normalizeText(data.countNotes, ""),
      notes: normalizeText(data.notes, ""),
      odorProfile,
      pathSegments: normalizePathSegments(data.pathSegments ?? data.segments, {
        trailId: id,
        sourceTokenId: normalizeId(data.sourceTokenId ?? data.tokenId, ""),
        sceneId: normalizeId(data.sceneId ?? options.sceneId, ""),
        worldTime,
        idFactory: options.idFactory,
      }),
    };
  }

  function normalizeTrails(value = [], options = {}) {
    const list = Array.isArray(value) ? value : Object.values(value ?? {});
    const seen = new Set();
    const trails = [];

    for (const entry of list) {
      const trail = normalizeTrail(entry, options);
      if (seen.has(trail.id)) continue;
      seen.add(trail.id);
      trails.push(trail);
    }

    return trails;
  }

  function getSceneTrails(scene, options = {}) {
    return normalizeTrails(getSceneTrailData(scene), options);
  }

  function upsertTrail(trails = [], trail, options = {}) {
    const normalizedTrail = normalizeTrail(trail, options);
    const normalizedTrails = normalizeTrails(trails, options).filter((entry) => entry.id !== normalizedTrail.id);
    normalizedTrails.push(normalizedTrail);
    return normalizedTrails;
  }

  function deleteTrail(trails = [], trailId) {
    const id = normalizeId(trailId, "");
    return normalizeTrails(trails).filter((trail) => trail.id !== id);
  }

  function addTrailSegment(trails = [], trailId, segment = {}, options = {}) {
    const id = normalizeId(trailId, "");
    const normalizedTrails = normalizeTrails(trails, options);
    return normalizedTrails.map((trail) => {
      if (trail.id !== id) return trail;
      const pathSegments = normalizePathSegments([
        ...trail.pathSegments,
        {
          ...segment,
          trailId: trail.id,
          sourceTokenId: trail.sourceTokenId,
        },
      ], {
        ...options,
        trailId: trail.id,
        sourceTokenId: trail.sourceTokenId,
      });
      return normalizeTrail({ ...trail, pathSegments, updatedWorldTime: options.worldTime ?? trail.updatedWorldTime }, options);
    });
  }

  function calculateTrailAgeHours(trail, options = {}) {
    const normalizedTrail = normalizeTrail(trail, options);
    const worldTime = Math.max(0, finiteNumber(options.worldTime, normalizedTrail.createdWorldTime));
    return Math.max(0, Math.floor((worldTime - normalizedTrail.createdWorldTime) / 3600));
  }

  function calculateSegmentAgeHours(segment, options = {}) {
    const normalizedSegment = normalizePathSegment(segment, options);
    const worldTime = Math.max(0, finiteNumber(options.worldTime, normalizedSegment.createdWorldTime));
    return Math.max(0, Math.floor((worldTime - normalizedSegment.createdWorldTime) / 3600));
  }

  function getTrailDisplayState(segmentOrTrail, options = {}) {
    const createdWorldTime = segmentOrTrail?.createdWorldTime ?? 0;
    const ageHours = Math.max(0, Math.floor((Math.max(0, finiteNumber(options.worldTime, createdWorldTime)) - createdWorldTime) / 3600));
    if (ageHours >= TRAIL_FADE_HOURS) return { visible: false, ageHours, opacity: 0, state: "faded" };
    if (ageHours >= 48) return { visible: true, ageHours, opacity: 0.18, state: "old" };
    if (ageHours >= 24) return { visible: true, ageHours, opacity: 0.32, state: "faint" };
    if (ageHours >= 8) return { visible: true, ageHours, opacity: 0.5, state: "stale" };
    if (ageHours >= 1) return { visible: true, ageHours, opacity: 0.72, state: "aging" };
    return { visible: true, ageHours, opacity: 0.95, state: "fresh" };
  }

  function getTrackerActor(tracker) {
    return tracker?.actor ?? tracker?.document?.actor ?? tracker ?? null;
  }

  function readTrackerBreathesWater(actor, options = {}) {
    if (options.trackerBreathesWater !== undefined) return normalizeBoolean(options.trackerBreathesWater, false);
    if (normalizeBoolean(readFlag(actor, "trackerBreathesWater"), false)) return true;
    if (normalizeBoolean(readFlag(actor, "breathesWater"), false)) return true;
    if (normalizeBoolean(actor?.system?.traits?.breathesWater, false)) return true;
    if (normalizeBoolean(actor?.system?.attributes?.breathing?.water, false)) return true;
    if (normalizeBoolean(actor?.system?.details?.breathesWater, false)) return true;
    return false;
  }

  function evaluateTrackerEligibility(actor, options = {}) {
    if (options.requireTracker === false) return { eligible: true, reason: "not-required" };
    if (!actor) return { eligible: false, reason: "missing-tracker" };

    if (typeof options.canTrackByScent === "function") {
      return options.canTrackByScent(actor) === true
        ? { eligible: true, reason: "eligible" }
        : { eligible: false, reason: "tracker-not-eligible" };
    }

    const rules = options.rules ?? globalThis.d35eScentSenseRules;
    if (typeof rules?.canTrackByScent === "function") {
      return rules.canTrackByScent(actor) === true
        ? { eligible: true, reason: "eligible" }
        : { eligible: false, reason: "tracker-not-eligible" };
    }

    return { eligible: true, reason: "unchecked" };
  }

  function getScentTrailDc(trail, tracker, options = {}) {
    const normalizedTrail = normalizeTrail(trail, options);
    if (normalizedTrail.active !== true) {
      return {
        trackable: false,
        dc: null,
        reason: "inactive-trail",
        trail: normalizedTrail,
      };
    }

    const actor = getTrackerActor(tracker);
    const eligibility = evaluateTrackerEligibility(actor, options);
    if (!eligibility.eligible) {
      return {
        trackable: false,
        dc: null,
        reason: eligibility.reason,
        trail: normalizedTrail,
        trackerEligible: false,
      };
    }

    const rules = options.rules ?? globalThis.d35eScentSenseRules;
    if (typeof rules?.getTrackingByScentDc !== "function") {
      return {
        trackable: false,
        dc: null,
        reason: "rules-unavailable",
        trail: normalizedTrail,
        trackerEligible: eligibility.eligible,
      };
    }

    const trailAgeHours = options.trailAgeHours !== undefined
      ? Math.max(0, Math.floor(finiteNumber(options.trailAgeHours, 0)))
      : calculateTrailAgeHours(normalizedTrail, options);
    const result = rules.getTrackingByScentDc({
      trailAgeHours,
      powerfulCompetingOdor: normalizedTrail.powerfulCompetingOdor,
      odorDcModifier: normalizedTrail.odorDcModifier,
      waterState: normalizedTrail.waterState,
      trackerBreathesWater: readTrackerBreathesWater(actor, options),
    });

    return {
      ...result,
      trail: normalizedTrail,
      trailAgeHours,
      trackerEligible: eligibility.eligible,
    };
  }

  function buildRollPromptData(trail, tracker, dcResult = {}, options = {}) {
    const normalizedTrail = normalizeTrail(trail, options);
    const trackerName = normalizeText(tracker?.name ?? tracker?.actor?.name ?? tracker?.document?.name, "Tracker");
    const trailLabel = options.revealTrailLabel === true ? normalizedTrail.label : "Scent trail";
    const shared = {
      trackerName,
      trailLabel,
      dc: dcResult.dc ?? null,
      trackable: dcResult.trackable === true,
      reason: dcResult.reason ?? "unknown",
      trailAgeHours: dcResult.trailAgeHours ?? calculateTrailAgeHours(normalizedTrail, options),
      waterState: normalizedTrail.waterState,
      powerfulCompetingOdor: normalizedTrail.powerfulCompetingOdor,
      odorDcModifier: normalizedTrail.odorDcModifier,
    };

    return {
      player: shared,
      gm: {
        ...shared,
        trailLabel: normalizedTrail.label,
        sourceName: normalizedTrail.sourceName,
        sourceTokenId: normalizedTrail.sourceTokenId,
        sourceActorId: normalizedTrail.sourceActorId,
        sizeNotes: normalizedTrail.sizeNotes,
        countNotes: normalizedTrail.countNotes,
        notes: normalizedTrail.notes,
        odorProfile: normalizedTrail.odorProfile,
      },
    };
  }

  const api = Object.freeze({
    constants: Object.freeze({
      MODULE_ID,
      TRAIL_FLAG,
      SCHEMA_VERSION,
      MAX_TRAIL_SEGMENTS,
      TRAIL_FADE_HOURS,
      WATER_STATES,
      DEFAULT_ODOR_PROFILE,
    }),
    addTrailSegment,
    buildRollPromptData,
    calculateTrailAgeHours,
    calculateSegmentAgeHours,
    deleteTrail,
    getSceneTrails,
    getScentTrailDc,
    getTrailDisplayState,
    hasMeaningfulMovement,
    normalizeBoolean,
    normalizeOdorProfile,
    normalizePathSegment,
    normalizePathSegments,
    resolveTokenMovementPosition,
    normalizeTrails,
    normalizeTrail,
    normalizeWaterState,
    readFlag,
    upsertTrail,
  });

  globalThis.d35eScentSenseTrails = api;
})();
