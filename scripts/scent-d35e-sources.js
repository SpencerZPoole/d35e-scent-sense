(() => {
  "use strict";

  const SENSE_ID = "scent";
  const DETECTION_MODE_ID = "scentPinpoint";
  const FALLBACK_ITEM_RANGE_PATH = "flags.world.d35eScentSenseRange";
  const ACTOR_TYPES = Object.freeze(["character", "npc"]);
  const ALWAYS_ELIGIBLE_ITEM_TYPES = Object.freeze(["race", "class", "feat"]);
  const ACTIVE_ITEM_TYPES = Object.freeze(["buff", "aura"]);

  function readProperty(object, path) {
    if (!object || !path) return undefined;
    if (globalThis.foundry?.utils?.getProperty) return foundry.utils.getProperty(object, path);

    return path.split(".").reduce((current, key) => current?.[key], object);
  }

  function positiveNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function collectionValues(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (typeof collection.values === "function") return Array.from(collection.values());
    if (typeof collection === "object") return Object.values(collection);
    return [];
  }

  function getActor(actorOrToken) {
    return actorOrToken?.actor ?? actorOrToken?.document?.actor ?? actorOrToken ?? null;
  }

  function getTokenDocument(actorOrToken) {
    if (actorOrToken?.document?.detectionModes) return actorOrToken.document;
    if (actorOrToken?.detectionModes) return actorOrToken;
    return null;
  }

  function isSupportedActor(actor) {
    return !!actor && ACTOR_TYPES.includes(actor.type);
  }

  function isBroken(item) {
    return item?.broken === true || item?.system?.broken === true;
  }

  function itemEligibility(item) {
    if (!item) return { eligible: false, reason: "missing-item" };
    if (item.system?.melded === true) return { eligible: false, reason: "melded" };
    if (isBroken(item)) return { eligible: false, reason: "broken" };
    if (ALWAYS_ELIGIBLE_ITEM_TYPES.includes(item.type)) return { eligible: true, reason: "inherent-item" };
    if (ACTIVE_ITEM_TYPES.includes(item.type)) {
      return item.system?.active === true
        ? { eligible: true, reason: "active-item" }
        : { eligible: false, reason: "inactive-item" };
    }
    if (item.system?.equipped === true) return { eligible: true, reason: "equipped-item" };
    return { eligible: false, reason: "not-eligible" };
  }

  function readItemScentRange(item, { senseId = SENSE_ID } = {}) {
    const directRange = positiveNumber(readProperty(item, `system.senses.${senseId}`), 0);
    if (directRange > 0) return { range: directRange, rangeSource: `system.senses.${senseId}` };

    const fallbackRange = positiveNumber(readProperty(item, FALLBACK_ITEM_RANGE_PATH), 0);
    if (fallbackRange > 0) return { range: fallbackRange, rangeSource: FALLBACK_ITEM_RANGE_PATH };

    return { range: 0, rangeSource: null };
  }

  function summarizeItem(item, { senseId = SENSE_ID } = {}) {
    const eligibility = itemEligibility(item);
    const range = readItemScentRange(item, { senseId });
    const summary = {
      kind: "item",
      id: item?.id ?? "",
      name: item?.name ?? "",
      type: item?.type ?? "",
      range: range.range,
      rangeSource: range.rangeSource,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
    };

    return summary;
  }

  function detectionModeStatus(tokenDocument, { detectionModeId = DETECTION_MODE_ID, pinpointRange = 5, range = 0 } = {}) {
    if (!tokenDocument) return { available: false, synchronized: false, reason: "no-token" };

    const expectedRange = range > 0 ? Math.min(pinpointRange, range) : 0;
    const current = tokenDocument.detectionModes;
    if (Array.isArray(current)) {
      const matches = current.filter((mode) => mode?.id === detectionModeId);
      const enabledMatches = matches.filter((mode) => mode.enabled === true);
      return {
        available: true,
        representation: "array",
        count: matches.length,
        duplicateCount: Math.max(0, matches.length - 1),
        enabled: enabledMatches.length > 0,
        range: matches[0]?.range ?? null,
        expectedRange,
        synchronized: range > 0
          ? matches.length === 1 && matches[0]?.enabled === true && matches[0]?.range === expectedRange
          : matches.length === 0,
        reason: "checked",
      };
    }

    const mode = current?.[detectionModeId];
    return {
      available: true,
      representation: "object",
      count: mode ? 1 : 0,
      duplicateCount: 0,
      enabled: mode?.enabled === true,
      range: mode?.range ?? null,
      expectedRange,
      synchronized: range > 0
        ? mode?.enabled === true && mode?.range === expectedRange
        : mode === undefined,
      reason: "checked",
    };
  }

  function getScentRangeBreakdown(actorOrToken, options = {}) {
    const actor = getActor(actorOrToken);
    const tokenDocument = options.tokenDocument ?? getTokenDocument(actorOrToken);
    const senseId = options.senseId ?? SENSE_ID;
    const contributors = [];
    const ignored = [];

    if (!isSupportedActor(actor)) {
      return {
        actorId: actor?.id ?? "",
        actorName: actor?.name ?? "",
        actorType: actor?.type ?? "",
        supported: false,
        range: 0,
        contributors,
        ignored: [{ kind: "actor", reason: actor ? "unsupported-actor-type" : "missing-actor" }],
        tokenDetection: detectionModeStatus(tokenDocument, options),
      };
    }

    const preparedRange = positiveNumber(readProperty(actor, `system.senses.${senseId}`), 0);
    if (preparedRange > 0) {
      contributors.push({
        kind: "actor",
        source: "prepared",
        path: `system.senses.${senseId}`,
        range: preparedRange,
      });
    }

    const baseRange = positiveNumber(readProperty(actor, `system.attributes.senses.${senseId}`), 0);
    if (baseRange > 0) {
      contributors.push({
        kind: "actor",
        source: "base",
        path: `system.attributes.senses.${senseId}`,
        range: baseRange,
      });
    }

    for (const item of collectionValues(actor.items)) {
      const summary = summarizeItem(item, { senseId });
      if (summary.range <= 0) continue;
      if (summary.eligible) contributors.push(summary);
      else ignored.push(summary);
    }

    const range = contributors.reduce((max, entry) => Math.max(max, entry.range), 0);
    const noVisionOverride = readProperty(actor, "system.noVisionOverride") === true;

    return {
      actorId: actor.id ?? "",
      actorName: actor.name ?? "",
      actorType: actor.type ?? "",
      supported: true,
      noVisionOverride,
      range,
      contributors,
      ignored,
      tokenDetection: {
        ...detectionModeStatus(tokenDocument, { ...options, range }),
        noVisionOverride,
      },
    };
  }

  function getScentRange(actorOrToken, options = {}) {
    return getScentRangeBreakdown(actorOrToken, options).range;
  }

  const api = Object.freeze({
    constants: Object.freeze({
      ACTOR_TYPES,
      ACTIVE_ITEM_TYPES,
      ALWAYS_ELIGIBLE_ITEM_TYPES,
      DETECTION_MODE_ID,
      FALLBACK_ITEM_RANGE_PATH,
      SENSE_ID,
    }),
    collectionValues,
    detectionModeStatus,
    getActor,
    getScentRange,
    getScentRangeBreakdown,
    itemEligibility,
    positiveNumber,
    readItemScentRange,
    readProperty,
    summarizeItem,
  });

  globalThis.d35eScentSenseD35ESources = api;
})();
