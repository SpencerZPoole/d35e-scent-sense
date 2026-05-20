(() => {
  "use strict";

  const MODULE_ID = "d35e-scent-sense";
  const INHERIT = "inherit";

  const ODOR_STRENGTHS = Object.freeze(["normal", "strong", "overpowering"]);
  const PROFILE_KEYS = Object.freeze(["odorStrength", "maskingOdor", "falseOdor", "odorTags", "familiarOdorTags"]);

  function normalizeToken(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
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

  function explicitEntry(explicit, keys) {
    for (const key of keys) {
      const value = explicit?.[key];
      if (isExplicit(value)) return { value, source: "explicit" };
    }
    return null;
  }

  function normalizeOdorProfile(profile = {}) {
    return {
      odorStrength: normalizeOdorStrength(profile.odorStrength ?? profile.odor ?? profile.scentStrength),
      maskingOdor: normalizeBoolean(profile.maskingOdor ?? profile.maskedByOdor ?? profile.powerfulMaskingOdor, false),
      falseOdor: normalizeBoolean(profile.falseOdor ?? profile.falseScent ?? profile.decoyOdor, false),
      odorTags: normalizeOdorTags(profile.odorTags ?? profile.tags),
    };
  }

  function getOdorProfile({
    explicit = {},
    targetDocument = null,
    targetActor = null,
    scene = null,
  } = {}) {
    const odorStrength = firstEntry(
      explicitEntry(explicit, ["odorStrength", "odor", "scentStrength"]),
      getFlagEntry(targetDocument, "odorStrength", "token"),
      getFlagEntry(targetActor, "odorStrength", "actor"),
      getFlagEntry(scene, "odorStrength", "scene")
    );
    const maskingOdor = firstEntry(
      explicitEntry(explicit, ["maskingOdor", "maskedByOdor", "powerfulMaskingOdor"]),
      getFlagEntry(targetDocument, "maskingOdor", "token"),
      getFlagEntry(targetActor, "maskingOdor", "actor"),
      getFlagEntry(scene, "maskingOdor", "scene")
    );
    const falseOdor = firstEntry(
      explicitEntry(explicit, ["falseOdor", "falseScent", "decoyOdor"]),
      getFlagEntry(targetDocument, "falseOdor", "token"),
      getFlagEntry(targetActor, "falseOdor", "actor"),
      getFlagEntry(scene, "falseOdor", "scene")
    );
    const odorTags = firstEntry(
      explicitEntry(explicit, ["odorTags", "tags"]),
      getFlagEntry(targetDocument, "odorTags", "token"),
      getFlagEntry(targetActor, "odorTags", "actor"),
      getFlagEntry(scene, "odorTags", "scene")
    );

    const profile = normalizeOdorProfile({
      odorStrength: odorStrength?.value,
      maskingOdor: maskingOdor?.value,
      falseOdor: falseOdor?.value,
      odorTags: odorTags?.value,
    });

    return {
      profile,
      sources: {
        odorStrength: odorStrength?.source ?? "default",
        maskingOdor: maskingOdor?.source ?? "default",
        falseOdor: falseOdor?.source ?? "default",
        odorTags: odorTags?.source ?? "default",
      },
      values: {
        odorStrength: odorStrength?.value,
        maskingOdor: maskingOdor?.value,
        falseOdor: falseOdor?.value,
        odorTags: odorTags?.value,
      },
    };
  }

  function getFamiliarOdorTags(actor, options = {}) {
    const explicit = options.familiarOdorTags ?? options.familiarTags;
    if (isExplicit(explicit)) return normalizeOdorTags(explicit);
    return normalizeOdorTags(readFlag(actor, "familiarOdorTags"));
  }

  function identifyFamiliarOdor(actor, targetProfile = {}, options = {}) {
    const profile = targetProfile.profile ?? targetProfile;
    const targetTags = normalizeOdorTags(profile.odorTags ?? profile.tags);
    const actorTags = getFamiliarOdorTags(actor, options);
    const matchedTags = targetTags.filter((tag) => actorTags.includes(tag));

    return {
      familiar: matchedTags.length > 0,
      matchedTags,
      actorTags,
      targetTags,
    };
  }

  function normalizeFlagValue(key, value) {
    if (!isExplicit(value)) return INHERIT;
    if (key === "odorStrength") return normalizeOdorStrength(value);
    if (key === "maskingOdor" || key === "falseOdor") return normalizeBoolean(value, false);
    if (key === "odorTags" || key === "familiarOdorTags") {
      const tags = normalizeOdorTags(value);
      return tags.length > 0 ? tags : INHERIT;
    }
    return value;
  }

  function buildFlagChanges(values = {}) {
    const set = {};
    const unset = [];

    for (const key of PROFILE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(values, key)) continue;

      const value = normalizeFlagValue(key, values[key]);
      if (value === INHERIT) unset.push(key);
      else set[key] = value;
    }

    return { set, unset };
  }

  const api = Object.freeze({
    constants: Object.freeze({
      INHERIT,
      ODOR_STRENGTHS,
      PROFILE_KEYS,
    }),
    buildFlagChanges,
    getFamiliarOdorTags,
    getOdorProfile,
    identifyFamiliarOdor,
    normalizeBoolean,
    normalizeFlagValue,
    normalizeOdorProfile,
    normalizeOdorStrength,
    normalizeOdorTags,
    readFlag,
  });

  globalThis.d35eScentSenseOdorProfile = api;
})();
