(() => {
  "use strict";

  const MODULE_ID = "d35e-scent-sense";
  const INHERIT = "inherit";

  const WIND_BANDS = Object.freeze(["normal", "upwind", "downwind"]);
  const ODOR_STRENGTHS = Object.freeze(["normal", "strong", "overpowering"]);
  const CONTEXT_KEYS = Object.freeze(["windBand", "odorStrength", "maskingOdor"]);
  const TOKEN_KEYS = Object.freeze([...CONTEXT_KEYS, "scentRelevant"]);

  function normalizeToken(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  }

  function normalizeWindBand(value) {
    const token = normalizeToken(value);
    if (token === "upwind" || token === "up") return "upwind";
    if (token === "downwind" || token === "down") return "downwind";
    return "normal";
  }

  function normalizeOdorStrength(value) {
    const token = normalizeToken(value);
    if (token === "strong") return "strong";
    if (token === "overpowering" || token === "overpower") return "overpowering";
    return "normal";
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

  function isExplicit(value) {
    return value !== undefined && value !== null && value !== "" && value !== INHERIT;
  }

  function readFlag(document, key) {
    try {
      const value = document?.getFlag?.(MODULE_ID, key);
      if (value !== undefined) return value;
    } catch (_error) {
      // Fall through to direct flag reads for tests and plain object mocks.
    }

    return document?.flags?.[MODULE_ID]?.[key];
  }

  function getFlagEntry(document, key, source) {
    const value = readFlag(document, key);
    return isExplicit(value) ? { value, source } : null;
  }

  function firstEntry(...entries) {
    return entries.find(Boolean) ?? null;
  }

  function normalizeContext(context = {}) {
    return {
      windBand: normalizeWindBand(context.windBand ?? context.wind ?? context.airflow),
      odorStrength: normalizeOdorStrength(context.odorStrength ?? context.odor ?? context.scentStrength),
      maskingOdor: normalizeBoolean(context.maskingOdor ?? context.maskedByOdor ?? context.powerfulMaskingOdor, false),
    };
  }

  function getScentContext({
    explicit = {},
    targetDocument = null,
    targetActor = null,
    scene = null,
  } = {}) {
    const wind = firstEntry(
      isExplicit(explicit.windBand ?? explicit.wind) ? { value: explicit.windBand ?? explicit.wind, source: "explicit" } : null,
      getFlagEntry(targetDocument, "windBand", "token"),
      getFlagEntry(targetActor, "windBand", "actor"),
      getFlagEntry(scene, "windBand", "scene")
    );
    const odor = firstEntry(
      isExplicit(explicit.odorStrength ?? explicit.odor) ? { value: explicit.odorStrength ?? explicit.odor, source: "explicit" } : null,
      getFlagEntry(targetDocument, "odorStrength", "token"),
      getFlagEntry(targetActor, "odorStrength", "actor"),
      getFlagEntry(scene, "odorStrength", "scene")
    );
    const masking = firstEntry(
      isExplicit(explicit.maskingOdor ?? explicit.maskedByOdor) ? { value: explicit.maskingOdor ?? explicit.maskedByOdor, source: "explicit" } : null,
      getFlagEntry(targetDocument, "maskingOdor", "token"),
      getFlagEntry(targetActor, "maskingOdor", "actor"),
      getFlagEntry(scene, "maskingOdor", "scene")
    );

    const context = normalizeContext({
      windBand: wind?.value,
      odorStrength: odor?.value,
      maskingOdor: masking?.value,
    });

    return {
      context,
      sources: {
        windBand: wind?.source ?? "default",
        odorStrength: odor?.source ?? "default",
        maskingOdor: masking?.source ?? "default",
      },
      values: {
        windBand: wind?.value,
        odorStrength: odor?.value,
        maskingOdor: masking?.value,
      },
    };
  }

  function normalizeFlagValue(key, value) {
    if (!isExplicit(value)) return INHERIT;
    if (key === "windBand") return normalizeWindBand(value);
    if (key === "odorStrength") return normalizeOdorStrength(value);
    if (key === "maskingOdor" || key === "scentRelevant") return normalizeBoolean(value, false);
    return value;
  }

  function buildFlagChanges(values = {}, { token = true } = {}) {
    const allowed = token ? TOKEN_KEYS : CONTEXT_KEYS;
    const set = {};
    const unset = [];

    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(values, key)) continue;

      const value = normalizeFlagValue(key, values[key]);
      if (value === INHERIT || key === "scentRelevant" && value === false) unset.push(key);
      else set[key] = value;
    }

    return { set, unset };
  }

  const api = Object.freeze({
    constants: Object.freeze({
      INHERIT,
      WIND_BANDS,
      ODOR_STRENGTHS,
      CONTEXT_KEYS,
      TOKEN_KEYS,
    }),
    buildFlagChanges,
    getScentContext,
    normalizeBoolean,
    normalizeContext,
    normalizeFlagValue,
    normalizeOdorStrength,
    normalizeWindBand,
    readFlag,
  });

  globalThis.d35eScentSenseContext = api;
})();
