(() => {
  "use strict";

  const PINPOINT_RANGE = 5;

  const WIND_BANDS = Object.freeze({
    NORMAL: "normal",
    UPWIND: "upwind",
    DOWNWIND: "downwind",
  });

  const ODOR_STRENGTHS = Object.freeze({
    NORMAL: "normal",
    STRONG: "strong",
    OVERPOWERING: "overpowering",
  });

  const WATER_STATES = Object.freeze({
    NONE: "none",
    FLOWING_WATER: "flowingWater",
    WATER: "water",
  });

  const RANGE_BANDS = Object.freeze({
    PRESENCE: "presence",
    PINPOINT: "pinpoint",
  });

  const WIND_MULTIPLIERS = Object.freeze({
    [WIND_BANDS.NORMAL]: 1,
    [WIND_BANDS.UPWIND]: 2,
    [WIND_BANDS.DOWNWIND]: 0.5,
  });

  const ODOR_MULTIPLIERS = Object.freeze({
    [ODOR_STRENGTHS.NORMAL]: 1,
    [ODOR_STRENGTHS.STRONG]: 2,
    [ODOR_STRENGTHS.OVERPOWERING]: 3,
  });

  const DEFAULT_CONTEXT = Object.freeze({
    windBand: WIND_BANDS.NORMAL,
    odorStrength: ODOR_STRENGTHS.NORMAL,
    maskingOdor: false,
  });

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function positiveNumber(value, fallback = 0) {
    const number = finiteNumber(value, fallback);
    return number > 0 ? number : fallback;
  }

  function normalizeToken(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  }

  function normalizeWindBand(value) {
    const token = normalizeToken(value);
    if (token === "upwind" || token === "up") return WIND_BANDS.UPWIND;
    if (token === "downwind" || token === "down") return WIND_BANDS.DOWNWIND;
    return WIND_BANDS.NORMAL;
  }

  function normalizeOdorStrength(value) {
    const token = normalizeToken(value);
    if (token === "strong") return ODOR_STRENGTHS.STRONG;
    if (token === "overpowering" || token === "overpower") return ODOR_STRENGTHS.OVERPOWERING;
    return ODOR_STRENGTHS.NORMAL;
  }

  function normalizeWaterState(value) {
    const token = normalizeToken(value);
    if (token === "flowingwater" || token === "flowing" || token === "stream") return WATER_STATES.FLOWING_WATER;
    if (token === "water" || token === "underwater" || token === "aquatic") return WATER_STATES.WATER;
    return WATER_STATES.NONE;
  }

  function booleanValue(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;
    const token = normalizeToken(value);
    if (["true", "yes", "y", "on"].includes(token)) return true;
    if (["false", "no", "n", "off"].includes(token)) return false;
    return fallback;
  }

  function normalizeContext(context = {}) {
    return {
      windBand: normalizeWindBand(context.windBand ?? context.wind ?? context.airflow),
      odorStrength: normalizeOdorStrength(context.odorStrength ?? context.odor ?? context.scentStrength),
      maskingOdor: booleanValue(context.maskingOdor ?? context.maskedByOdor ?? context.powerfulMaskingOdor, false),
    };
  }

  function calculateEffectiveRange(baseRange, context = {}) {
    const normalizedBaseRange = positiveNumber(baseRange, 0);
    if (normalizedBaseRange <= 0) return 0;

    const normalized = normalizeContext(context);
    if (normalized.maskingOdor) return 0;

    return normalizedBaseRange * WIND_MULTIPLIERS[normalized.windBand] * ODOR_MULTIPLIERS[normalized.odorStrength];
  }

  function evaluateDetection({ baseRange = 0, distance = Infinity, context = {}, pinpointRange = PINPOINT_RANGE } = {}) {
    const normalizedContext = normalizeContext(context);
    const normalizedBaseRange = positiveNumber(baseRange, 0);
    const normalizedDistance = finiteNumber(distance, Infinity);
    const normalizedPinpointRange = positiveNumber(pinpointRange, PINPOINT_RANGE);
    const effectiveRange = calculateEffectiveRange(normalizedBaseRange, normalizedContext);
    const reasons = [];

    if (normalizedBaseRange <= 0) reasons.push("no-scent-range");
    if (normalizedContext.maskingOdor) reasons.push("masking-odor");
    if (!Number.isFinite(normalizedDistance) || normalizedDistance < 0) reasons.push("invalid-distance");
    if (Number.isFinite(normalizedDistance) && normalizedDistance > effectiveRange) reasons.push("out-of-range");

    const detectable = reasons.length === 0;
    const pinpointThreshold = Math.min(normalizedPinpointRange, effectiveRange);
    const pinpoint = detectable && normalizedDistance <= pinpointThreshold;
    const band = detectable ? pinpoint ? RANGE_BANDS.PINPOINT : RANGE_BANDS.PRESENCE : null;

    return {
      detectable,
      pinpoint,
      band,
      reason: detectable ? "detectable" : reasons[0],
      reasons,
      baseRange: normalizedBaseRange,
      effectiveRange,
      distance: normalizedDistance,
      context: normalizedContext,
      pinpointRange: normalizedPinpointRange,
    };
  }

  function getTrackingByScentDc({
    trailAgeHours = 0,
    powerfulCompetingOdor = false,
    odorDcModifier = 0,
    waterState = WATER_STATES.NONE,
    trackerBreathesWater = false,
  } = {}) {
    const normalizedWaterState = normalizeWaterState(waterState);
    const breathesWater = booleanValue(trackerBreathesWater, false);

    if (normalizedWaterState === WATER_STATES.FLOWING_WATER && !breathesWater) {
      return {
        trackable: false,
        dc: null,
        reason: "flowing-water-ruins-trail",
        waterState: normalizedWaterState,
        trackerBreathesWater: breathesWater,
      };
    }

    const ageHours = Math.max(0, Math.floor(finiteNumber(trailAgeHours, 0)));
    const ageModifier = ageHours * 2;
    const baseDc = booleanValue(powerfulCompetingOdor, false) ? 20 : 10;
    const odorModifier = finiteNumber(odorDcModifier, 0);

    return {
      trackable: true,
      dc: baseDc + ageModifier + odorModifier,
      reason: "trackable",
      baseDc,
      ageModifier,
      odorDcModifier: odorModifier,
      trailAgeHours: ageHours,
      waterState: normalizedWaterState,
      trackerBreathesWater: breathesWater,
    };
  }

  function actorHasTrackFeat(actor) {
    const items = actor?.items;
    if (!items) return false;

    for (const item of items.values?.() ?? items) {
      const name = normalizeToken(item?.name);
      const tag = normalizeToken(item?.system?.tag ?? item?.system?.slug ?? item?.system?.identifier);
      if (item?.type === "feat" && (name === "track" || tag === "track")) return true;
    }

    return false;
  }

  function actorHasScent(actor) {
    const directRange = positiveNumber(actor?.system?.attributes?.senses?.scent, positiveNumber(actor?.system?.senses?.scent, 0));
    if (directRange > 0) return true;

    const items = actor?.items;
    if (!items) return false;
    for (const item of items.values?.() ?? items) {
      if (positiveNumber(item?.system?.senses?.scent, 0) > 0) return true;
    }
    return false;
  }

  function canTrackByScent(actor, options = {}) {
    const scentCapable = typeof options.hasScent === "boolean" ? options.hasScent : actorHasScent(actor);
    return scentCapable && actorHasTrackFeat(actor);
  }

  const api = Object.freeze({
    constants: Object.freeze({
      PINPOINT_RANGE,
      WIND_BANDS,
      ODOR_STRENGTHS,
      WATER_STATES,
      RANGE_BANDS,
      DEFAULT_CONTEXT,
    }),
    normalizeContext,
    calculateEffectiveRange,
    evaluateDetection,
    getTrackingByScentDc,
    canTrackByScent,
  });

  globalThis.d35eScentSenseRules = api;
})();
