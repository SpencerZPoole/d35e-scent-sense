(() => {
  "use strict";

  const MODULE_ID = "d35e-scent-sense";
  const SCENE_CONTEXT_KEYS = Object.freeze(["windBand", "odorStrength", "maskingOdor"]);
  const TOKEN_CONTEXT_KEYS = Object.freeze(["windBand", "odorStrength", "maskingOdor", "scentRelevant"]);
  const ODOR_KEYS = Object.freeze(["odorStrength", "maskingOdor", "falseOdor", "odorTags", "familiarOdorTags"]);
  const TRAIL_FLAG = "scentTrails";
  const ACTOR_REPORT_KEYS = Object.freeze([
    "windBand",
    "odorStrength",
    "maskingOdor",
    "falseOdor",
    "odorTags",
    "familiarOdorTags",
    TRAIL_FLAG,
  ]);

  function readModuleFlags(document, moduleId = MODULE_ID) {
    return document?.flags?.[moduleId] ?? {};
  }

  function collectionValues(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (typeof collection.values === "function") return Array.from(collection.values());
    if (typeof collection === "object") return Object.values(collection);
    return [];
  }

  function isEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function addChange(report, key, currentValue, nextValue) {
    if (nextValue === undefined) {
      if (currentValue !== undefined) report.unset.push(key);
      return;
    }

    if (!isEqual(currentValue, nextValue)) report.set[key] = nextValue;
  }

  function normalizeFlagSet(document, { contextApi, odorProfileApi, token = true, moduleId = MODULE_ID } = {}) {
    const flags = readModuleFlags(document, moduleId);
    const contextKeys = token ? TOKEN_CONTEXT_KEYS : SCENE_CONTEXT_KEYS;
    const contextValues = {};
    const odorValues = {};
    const report = {
      documentId: document?.id ?? "",
      documentName: document?.name ?? "",
      set: {},
      unset: [],
      changed: false,
    };

    for (const key of contextKeys) {
      if (Object.prototype.hasOwnProperty.call(flags, key)) contextValues[key] = flags[key];
    }
    for (const key of ODOR_KEYS) {
      if (Object.prototype.hasOwnProperty.call(flags, key)) odorValues[key] = flags[key];
    }

    const contextChanges = contextApi?.buildFlagChanges?.(contextValues, { token }) ?? { set: {}, unset: [] };
    const odorChanges = odorProfileApi?.buildFlagChanges?.(odorValues) ?? { set: {}, unset: [] };

    for (const key of Object.keys(contextValues)) {
      if (contextChanges.unset?.includes(key)) addChange(report, key, flags[key], undefined);
      else if (Object.prototype.hasOwnProperty.call(contextChanges.set ?? {}, key)) addChange(report, key, flags[key], contextChanges.set[key]);
    }

    for (const key of Object.keys(odorValues)) {
      if (odorChanges.unset?.includes(key)) addChange(report, key, flags[key], undefined);
      else if (Object.prototype.hasOwnProperty.call(odorChanges.set ?? {}, key)) addChange(report, key, flags[key], odorChanges.set[key]);
    }

    report.changed = Object.keys(report.set).length > 0 || report.unset.length > 0;
    return report;
  }

  function normalizeTrailFlag(scene, { trailApi, moduleId = MODULE_ID, worldTime = 0 } = {}) {
    const flags = readModuleFlags(scene, moduleId);
    if (!Object.prototype.hasOwnProperty.call(flags, TRAIL_FLAG)) {
      return { set: {}, unset: [], changed: false, count: 0 };
    }

    const normalized = trailApi?.normalizeTrails?.(flags[TRAIL_FLAG], { worldTime }) ?? [];
    const report = { set: {}, unset: [], changed: false, count: normalized.length };
    if (!isEqual(flags[TRAIL_FLAG], normalized)) {
      report.set[TRAIL_FLAG] = normalized;
      report.changed = true;
    }

    return report;
  }

  function reportActorFlags(actor, { moduleId = MODULE_ID } = {}) {
    const flags = readModuleFlags(actor, moduleId);
    const keys = ACTOR_REPORT_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(flags, key));
    return {
      actorId: actor?.id ?? "",
      actorName: actor?.name ?? "",
      keys,
      action: keys.length > 0 ? "report-only" : "none",
    };
  }

  function planMigration({
    scene = null,
    tokens = null,
    contextApi,
    odorProfileApi,
    trailApi,
    moduleId = MODULE_ID,
    worldTime = 0,
  } = {}) {
    const tokenDocuments = collectionValues(tokens ?? scene?.tokens);
    const sceneReport = normalizeFlagSet(scene, { contextApi, odorProfileApi, token: false, moduleId });
    const trailReport = normalizeTrailFlag(scene, { trailApi, moduleId, worldTime });

    for (const [key, value] of Object.entries(trailReport.set)) sceneReport.set[key] = value;
    sceneReport.unset.push(...trailReport.unset);
    sceneReport.changed = sceneReport.changed || trailReport.changed;

    const tokenReports = tokenDocuments.map((token) => normalizeFlagSet(token, { contextApi, odorProfileApi, token: true, moduleId }));
    const actorReports = tokenDocuments
      .map((token) => token.actor)
      .filter(Boolean)
      .map((actor) => reportActorFlags(actor, { moduleId }))
      .filter((report, index, reports) => report.keys.length > 0 && reports.findIndex((entry) => entry.actorId === report.actorId) === index);

    return {
      sceneId: scene?.id ?? "",
      sceneName: scene?.name ?? "",
      scene: sceneReport,
      trails: trailReport,
      tokens: tokenReports,
      actors: actorReports,
      changed: sceneReport.changed || tokenReports.some((report) => report.changed),
    };
  }

  const api = Object.freeze({
    constants: Object.freeze({
      ACTOR_REPORT_KEYS,
      ODOR_KEYS,
      SCENE_CONTEXT_KEYS,
      TOKEN_CONTEXT_KEYS,
      TRAIL_FLAG,
    }),
    collectionValues,
    normalizeFlagSet,
    normalizeTrailFlag,
    planMigration,
    readModuleFlags,
    reportActorFlags,
  });

  globalThis.d35eScentSenseMigration = api;
})();
