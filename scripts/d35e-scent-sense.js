(() => {
  "use strict";

  const MODULE_ID = "d35e-scent-sense";
  const PACKAGE_TITLE = "D35E Scent Sense";
  const PACKAGE_DESCRIPTION =
    "Adds conservative 3.5e SRD Scent support for the D35E Foundry system: presence alerts, optional owner/GM range rings, and 5 ft pinpoint detection.";
  const SOCKET_NAME = `module.${MODULE_ID}`;
  const SENSE_ID = "scent";
  const DETECTION_MODE_ID = "scentPinpoint";
  const DEFAULT_SCENT_RANGE = 30;
  const PINPOINT_RANGE = 5;
  const CONTEXT_MANAGER_TEMPLATE = `modules/${MODULE_ID}/templates/scent-context-manager.hbs`;
  const TRAIL_MANAGER_TEMPLATE = `modules/${MODULE_ID}/templates/scent-trail-manager.hbs`;
  const HOOKS_REGISTERED = Symbol.for(`${MODULE_ID}.hooksRegistered`);
  const SETTINGS_REGISTERED = Symbol.for(`${MODULE_ID}.settingsRegistered`);
  const BOOTSTRAPPED = Symbol.for(`${MODULE_ID}.bootstrapped`);

  const SETTINGS = {
    TRIGGER_SCOPE: "triggerScope",
    RESPECT_WALLS: "respectWalls",
    ENABLE_PRESENCE_ALERTS: "enablePresenceAlerts",
    ENABLE_PINPOINT_ALERTS: "enablePinpointAlerts",
    NOTIFICATION_MODE: "notificationMode",
    OVERLAY_ENABLED: "overlayEnabled",
    OVERLAY_HIDDEN_ACTORS: "overlayHiddenActors",
  };

  const DEFAULT_SETTINGS = {
    [SETTINGS.TRIGGER_SCOPE]: "unknownHostiles",
    [SETTINGS.RESPECT_WALLS]: true,
    [SETTINGS.ENABLE_PRESENCE_ALERTS]: true,
    [SETTINGS.ENABLE_PINPOINT_ALERTS]: true,
    [SETTINGS.NOTIFICATION_MODE]: "dialog",
    [SETTINGS.OVERLAY_ENABLED]: true,
    [SETTINGS.OVERLAY_HIDDEN_ACTORS]: {},
  };

  const SOCKET_TYPES = {
    PRESENCE_ALERT: "presenceAlert",
    PINPOINT_ALERT: "pinpointAlert",
    MOVE_ACTION_REQUEST: "moveActionRequest",
    DIRECTION_REVEALED: "directionRevealed",
    SCAN_REQUEST: "scanRequest",
  };

  const RANGE_BANDS = {
    PRESENCE: "presence",
    PINPOINT: "pinpoint",
  };

  let scanInProgress = false;
  let scanQueuedDuringRun = false;
  let moduleRuntimes = null;

  const notificationState = new Set();

  function isD35E() {
    return game.system?.id === "D35E";
  }

  function refreshPackageMetadata() {
    const module = game.modules?.get(MODULE_ID);
    if (!module) return;

    module.title = PACKAGE_TITLE;
    module.description = PACKAGE_DESCRIPTION;
  }

  function positiveNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function clone(value) {
    return foundry.utils.deepClone(value);
  }

  function localize(key) {
    return game.i18n?.localize(key) ?? key;
  }

  function format(key, data = {}) {
    return game.i18n?.format(key, data) ?? key;
  }

  function escapeHtml(value) {
    return foundry.utils.escapeHTML(String(value ?? ""));
  }

  function randomId() {
    return foundry.utils.randomID?.() ?? Math.random().toString(36).slice(2);
  }

  function getSetting(key) {
    try {
      return game.settings.get(MODULE_ID, key);
    } catch (_error) {
      return clone(DEFAULT_SETTINGS[key]);
    }
  }

  function getScentRules() {
    return globalThis.d35eScentSenseRules;
  }

  function getContextApi() {
    return globalThis.d35eScentSenseContext;
  }

  function getScentStateApi() {
    return globalThis.d35eScentSenseState;
  }

  function getOdorProfileApi() {
    return globalThis.d35eScentSenseOdorProfile;
  }

  function getScentTrailsApi() {
    return globalThis.d35eScentSenseTrails;
  }

  function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== "");
  }

  function readFlag(document, key) {
    try {
      return document?.getFlag?.(MODULE_ID, key);
    } catch (_error) {
      return undefined;
    }
  }

  function ensureRuntimes() {
    if (moduleRuntimes) return moduleRuntimes;

    const detection = globalThis.d35eScentSenseDetection.create({
      getSetting,
      positiveNumber,
      settings: SETTINGS,
    });

    const overlay = globalThis.d35eScentSenseOverlay.create({
      clone,
      getSetting,
      getScentRange,
      hasScent,
      localize,
      moduleId: MODULE_ID,
      positiveNumber,
      settings: SETTINGS,
    });

    const alerts = globalThis.d35eScentSenseAlerts.create({
      escapeHtml,
      format,
      getSetting,
      localize,
      moduleId: MODULE_ID,
      queueScan,
      randomId,
      rangeBands: RANGE_BANDS,
      roundDistance,
      settings: SETTINGS,
      showLocalPinpointCue,
      socketName: SOCKET_NAME,
      socketTypes: SOCKET_TYPES,
    });

    const integration = globalThis.d35eScentSenseD35EIntegration.create({
      clone,
      detectionModeId: DETECTION_MODE_ID,
      getScentRange,
      isD35E,
      moduleId: MODULE_ID,
      pinpointRange: PINPOINT_RANGE,
      positiveNumber,
      queueScan,
      refreshOverlay,
      senseId: SENSE_ID,
    });

    const contextManagerRuntime = globalThis.d35eScentSenseContextManager.create({
      evaluateScentDetection,
      format,
      getContextApi,
      getOdorProfile,
      getScentContext,
      getScentRange,
      identifyFamiliarOdor,
      localize,
      measureTokenDistance,
      moduleId: MODULE_ID,
      refreshOverlay,
      resetNotificationState,
      roundDistance,
      setOdorProfileFlags,
      setScentContextFlags,
      template: CONTEXT_MANAGER_TEMPLATE,
    });

    const trailManagerRuntime = globalThis.d35eScentSenseTrailManager.create({
      canTrackByScent,
      createScentTrail,
      deleteScentTrail,
      format,
      getScentRange,
      getScentTrailDc,
      getScentTrails,
      localize,
      moduleId: MODULE_ID,
      rollTrackByScent,
      roundDistance,
      template: TRAIL_MANAGER_TEMPLATE,
      updateScentTrail,
    });

    moduleRuntimes = { alerts, contextManager: contextManagerRuntime, detection, integration, overlay, trailManager: trailManagerRuntime };
    return moduleRuntimes;
  }

  function getTargetDocument(targetToken) {
    return targetToken?.document ?? targetToken;
  }

  function getOdorProfileInputs(documentOrToken, options = {}) {
    const document = getTargetDocument(documentOrToken);
    const documentName = document?.documentName;
    let scene = options.scene ?? canvas?.scene ?? null;
    let targetDocument = null;
    let targetActor = null;

    if (documentName === "Scene") {
      scene = document;
    } else if (documentName === "Actor" || document?.items) {
      targetActor = document;
    } else {
      targetDocument = document;
      targetActor = documentOrToken?.actor ?? document?.actor ?? null;
      scene = options.scene ?? document?.parent ?? canvas?.scene ?? null;
    }

    return { targetDocument, targetActor, scene };
  }

  function buildScentContext(sourceToken, targetToken, options = {}) {
    return getScentContext(sourceToken, targetToken, options).context;
  }

  function getScentContext(_sourceToken, targetToken, options = {}) {
    const targetDocument = getTargetDocument(targetToken);
    const targetActor = targetToken?.actor ?? targetDocument?.actor;
    const scene = options.scene ?? targetDocument?.parent ?? canvas?.scene;
    const explicit = options.context ?? options;
    const contextApi = getContextApi();

    if (contextApi?.getScentContext) {
      const scentContext = contextApi.getScentContext({ explicit, targetDocument, targetActor, scene });
      const odorProfile = getOdorProfileApi()?.getOdorProfile?.({ explicit, targetDocument, targetActor, scene });
      if (!odorProfile) return scentContext;

      return {
        ...scentContext,
        context: {
          ...scentContext.context,
          odorStrength: odorProfile.profile.odorStrength,
          maskingOdor: odorProfile.profile.maskingOdor,
          falseOdor: odorProfile.profile.falseOdor,
          odorTags: odorProfile.profile.odorTags,
        },
        sources: {
          ...scentContext.sources,
          odorStrength: odorProfile.sources.odorStrength,
          maskingOdor: odorProfile.sources.maskingOdor,
          falseOdor: odorProfile.sources.falseOdor,
          odorTags: odorProfile.sources.odorTags,
        },
        values: {
          ...scentContext.values,
          odorStrength: odorProfile.values.odorStrength,
          maskingOdor: odorProfile.values.maskingOdor,
          falseOdor: odorProfile.values.falseOdor,
          odorTags: odorProfile.values.odorTags,
        },
        odorProfile: odorProfile.profile,
        odorProfileSources: odorProfile.sources,
      };
    }

    const rules = getScentRules();
    return {
      context: rules?.normalizeContext?.({}) ?? { windBand: "normal", odorStrength: "normal", maskingOdor: false },
      sources: { windBand: "default", odorStrength: "default", maskingOdor: "default" },
      values: {},
    };
  }

  function getOdorProfile(documentOrToken, options = {}) {
    const odorProfileApi = getOdorProfileApi();
    const { targetDocument, targetActor, scene } = getOdorProfileInputs(documentOrToken, options);
    const explicit = options.odorProfile ?? options.context ?? options;

    return odorProfileApi?.getOdorProfile?.({ explicit, targetDocument, targetActor, scene }) ?? {
      profile: { odorStrength: "normal", maskingOdor: false, falseOdor: false, odorTags: [] },
      sources: { odorStrength: "default", maskingOdor: "default", falseOdor: "default", odorTags: "default" },
      values: {},
    };
  }

  function identifyFamiliarOdor(actor, targetProfile, options = {}) {
    const odorProfileApi = getOdorProfileApi();
    const profile = targetProfile?.profile
      ? targetProfile.profile
      : targetProfile?.getFlag || targetProfile?.document || targetProfile?.flags
        ? getOdorProfile(targetProfile, options).profile
        : targetProfile;

    return odorProfileApi?.identifyFamiliarOdor?.(actor, profile, options) ?? {
      familiar: false,
      matchedTags: [],
      actorTags: [],
      targetTags: [],
    };
  }

  function registerSettings() {
    if (globalThis[SETTINGS_REGISTERED] === true) return;

    game.settings.register(MODULE_ID, SETTINGS.TRIGGER_SCOPE, {
      name: "D35EScent.Settings.TriggerScope.Name",
      hint: "D35EScent.Settings.TriggerScope.Hint",
      scope: "world",
      config: true,
      type: String,
      default: DEFAULT_SETTINGS[SETTINGS.TRIGGER_SCOPE],
      choices: {
        unknownHostiles: "D35EScent.Settings.TriggerScope.UnknownHostiles",
        allHostiles: "D35EScent.Settings.TriggerScope.AllHostiles",
        allCreatures: "D35EScent.Settings.TriggerScope.AllCreatures",
        gmMarked: "D35EScent.Settings.TriggerScope.GmMarked",
      },
      onChange: () => resetNotificationState({ scan: true }),
    });

    game.settings.register(MODULE_ID, SETTINGS.RESPECT_WALLS, {
      name: "D35EScent.Settings.RespectWalls.Name",
      hint: "D35EScent.Settings.RespectWalls.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: DEFAULT_SETTINGS[SETTINGS.RESPECT_WALLS],
      onChange: () => resetNotificationState({ scan: true }),
    });

    game.settings.register(MODULE_ID, SETTINGS.ENABLE_PRESENCE_ALERTS, {
      name: "D35EScent.Settings.EnablePresenceAlerts.Name",
      hint: "D35EScent.Settings.EnablePresenceAlerts.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: DEFAULT_SETTINGS[SETTINGS.ENABLE_PRESENCE_ALERTS],
      onChange: () => resetNotificationState({ scan: true }),
    });

    game.settings.register(MODULE_ID, SETTINGS.ENABLE_PINPOINT_ALERTS, {
      name: "D35EScent.Settings.EnablePinpointAlerts.Name",
      hint: "D35EScent.Settings.EnablePinpointAlerts.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: DEFAULT_SETTINGS[SETTINGS.ENABLE_PINPOINT_ALERTS],
      onChange: () => resetNotificationState({ scan: true }),
    });

    game.settings.register(MODULE_ID, SETTINGS.NOTIFICATION_MODE, {
      name: "D35EScent.Settings.NotificationMode.Name",
      hint: "D35EScent.Settings.NotificationMode.Hint",
      scope: "client",
      config: true,
      type: String,
      default: DEFAULT_SETTINGS[SETTINGS.NOTIFICATION_MODE],
      choices: {
        dialog: "D35EScent.Settings.NotificationMode.Dialog",
        chat: "D35EScent.Settings.NotificationMode.Chat",
      },
    });

    game.settings.register(MODULE_ID, SETTINGS.OVERLAY_ENABLED, {
      name: "D35EScent.Settings.OverlayEnabled.Name",
      hint: "D35EScent.Settings.OverlayEnabled.Hint",
      scope: "client",
      config: true,
      type: Boolean,
      default: DEFAULT_SETTINGS[SETTINGS.OVERLAY_ENABLED],
      onChange: () => refreshOverlay(),
    });

    game.settings.register(MODULE_ID, SETTINGS.OVERLAY_HIDDEN_ACTORS, {
      scope: "client",
      config: false,
      type: Object,
      default: {},
      onChange: () => refreshOverlay(),
    });

    globalThis[SETTINGS_REGISTERED] = true;
  }

  function itemContributesScent(item) {
    const fallbackRange = positiveNumber(foundry.utils.getProperty(item, "flags.world.d35eScentSenseRange"), 0);
    const itemRange = positiveNumber(item.system?.senses?.[SENSE_ID], fallbackRange);
    if (itemRange <= 0) return 0;

    if (["aura", "buff"].includes(item.type)) return item.system?.active === true ? itemRange : 0;
    if (item.system?.active === false) return 0;
    return itemRange;
  }

  function getActorItemScentRange(actor) {
    if (!actor?.items) return 0;

    let range = 0;
    for (const item of actor.items.values?.() ?? actor.items) {
      range = Math.max(range, itemContributesScent(item));
    }

    return range;
  }

  function getScentRange(actor) {
    if (!actor || !["character", "npc"].includes(actor.type)) return 0;

    const preparedRange = positiveNumber(
      foundry.utils.getProperty(actor, `system.attributes.senses.${SENSE_ID}`),
      positiveNumber(foundry.utils.getProperty(actor, `system.senses.${SENSE_ID}`), 0)
    );
    if (preparedRange > 0) return preparedRange;

    return getActorItemScentRange(actor);
  }

  function hasScent(actor) {
    return getScentRange(actor) > 0;
  }

  function getTokenActor(tokenOrDocument) {
    return tokenOrDocument?.actor ?? tokenOrDocument?.document?.actor ?? null;
  }

  function getEffectiveScentRange(sourceToken, targetToken, options = {}) {
    const rules = getScentRules();
    const baseRange = options.baseRange !== undefined ? positiveNumber(options.baseRange, 0) : getScentRange(getTokenActor(sourceToken));
    const context = buildScentContext(sourceToken, targetToken, options);
    return rules?.calculateEffectiveRange?.(baseRange, context) ?? baseRange;
  }

  function evaluateBaseScentDetection(sourceToken, targetToken, options = {}) {
    const rules = getScentRules();
    const baseRange = options.baseRange !== undefined ? positiveNumber(options.baseRange, 0) : getScentRange(getTokenActor(sourceToken));
    const distance = options.distance !== undefined ? Number(options.distance) : measureTokenDistance(sourceToken, targetToken);
    const context = buildScentContext(sourceToken, targetToken, options);

    if (rules?.evaluateDetection) {
      const detection = rules.evaluateDetection({ sourceToken, targetToken, baseRange, distance, context, pinpointRange: PINPOINT_RANGE });
      return {
        ...detection,
        context: {
          ...context,
          ...(detection.context ?? {}),
        },
      };
    }

    const effectiveRange = context.maskingOdor ? 0 : baseRange;
    const detectable = Number.isFinite(distance) && distance >= 0 && distance <= effectiveRange;
    const pinpoint = detectable && distance <= Math.min(PINPOINT_RANGE, effectiveRange);
    return {
      detectable,
      pinpoint,
      band: detectable ? pinpoint ? RANGE_BANDS.PINPOINT : RANGE_BANDS.PRESENCE : null,
      reason: detectable ? "detectable" : "out-of-range",
      reasons: detectable ? [] : ["out-of-range"],
      baseRange,
      effectiveRange,
      distance,
      context,
      pinpointRange: PINPOINT_RANGE,
    };
  }

  function getDirectionStatus(sourceToken, targetToken, options = {}) {
    return ensureRuntimes().alerts.getDirectionStatus({
      sceneId: options.scene?.id ?? targetToken?.scene?.id ?? targetToken?.document?.parent?.id ?? canvas?.scene?.id,
      sourceTokenId: sourceToken?.id,
      targetTokenId: targetToken?.id,
    });
  }

  function evaluateScentState(sourceToken, targetToken, options = {}) {
    const stateApi = getScentStateApi();
    const detection = options.detection ?? evaluateBaseScentDetection(sourceToken, targetToken, options);
    const directionStatus = options.directionStatus ?? getDirectionStatus(sourceToken, targetToken, options);

    return stateApi?.evaluateScentState?.({
      detection,
      directionAvailable: options.directionAvailable,
      directionStatus,
    }) ?? {
      ...detection,
      state: detection.detectable ? detection.pinpoint ? RANGE_BANDS.PINPOINT : RANGE_BANDS.PRESENCE : "none",
      states: detection.detectable ? [detection.pinpoint ? RANGE_BANDS.PINPOINT : RANGE_BANDS.PRESENCE] : [],
      notificationBand: detection.band,
      directionAvailable: false,
      directionRequested: false,
      directionRevealed: false,
      directionStatus: "none",
      requiresGmDirection: false,
    };
  }

  function evaluateScentDetection(sourceToken, targetToken, options = {}) {
    const detection = evaluateBaseScentDetection(sourceToken, targetToken, options);
    const state = evaluateScentState(sourceToken, targetToken, { ...options, detection });
    return {
      ...detection,
      state: state.state,
      states: state.states,
      directionAvailable: state.directionAvailable,
      directionRequested: state.directionRequested,
      directionRevealed: state.directionRevealed,
      directionStatus: state.directionStatus,
      requiresGmDirection: state.requiresGmDirection,
      notificationBand: state.notificationBand,
    };
  }

  function getTrackingByScentDc(options = {}) {
    return getScentRules()?.getTrackingByScentDc?.(options) ?? { trackable: false, dc: null, reason: "rules-unavailable" };
  }

  function canTrackByScent(actor) {
    return getScentRules()?.canTrackByScent?.(actor, { hasScent: hasScent(actor) }) ?? false;
  }

  function getScentTrails(scene = canvas?.scene, options = {}) {
    if (!scene) return [];
    return getScentTrailsApi()?.getSceneTrails?.(scene, { worldTime: options.worldTime ?? game.time?.worldTime ?? 0 }) ?? [];
  }

  function getSceneToken(scene, tokenId) {
    if (!tokenId) return null;
    if (scene?.id && scene.id === canvas?.scene?.id) {
      const liveToken = canvas?.tokens?.placeables?.find((token) => token.id === tokenId);
      if (liveToken) return liveToken;
    }

    const tokenDocument = scene?.tokens?.get?.(tokenId) ?? scene?.tokens?.find?.((token) => token.id === tokenId);
    if (!tokenDocument) return null;
    return { id: tokenDocument.id, name: tokenDocument.name, actor: tokenDocument.actor, document: tokenDocument };
  }

  function findScentTrail(scene, trailId) {
    return getScentTrails(scene).find((trail) => trail.id === trailId) ?? null;
  }

  function buildTrailSourceData(data = {}, scene = canvas?.scene) {
    const sourceToken = data.sourceToken ?? getSceneToken(scene, data.sourceTokenId);
    const sourceDocument = sourceToken?.document ?? sourceToken;
    const sourceActor = sourceToken?.actor ?? sourceDocument?.actor ?? null;
    const sourceName = firstDefined(sourceToken?.name, sourceDocument?.name, data.sourceName, data.sourceActorName, "");

    return {
      sourceTokenId: firstDefined(sourceToken?.id, sourceDocument?.id, data.sourceTokenId, ""),
      sourceActorId: firstDefined(sourceActor?.id, data.sourceActorId, ""),
      sourceName,
      odorProfile: data.odorProfile ?? (sourceToken ? getOdorProfile(sourceToken, { scene }).profile : data.odorProfile),
    };
  }

  async function persistScentTrails(scene, trails) {
    if (game.user?.isGM !== true) return { updated: false, reason: "not-gm", trails: getScentTrails(scene) };
    if (!scene?.setFlag) return { updated: false, reason: "invalid-scene", trails: [] };

    const trailApi = getScentTrailsApi();
    const normalizedTrails = trailApi?.normalizeTrails?.(trails, { worldTime: game.time?.worldTime ?? 0 }) ?? [];
    await scene.setFlag(MODULE_ID, trailApi?.constants?.TRAIL_FLAG ?? "scentTrails", normalizedTrails);
    return { updated: true, trails: normalizedTrails };
  }

  async function createScentTrail(scene = canvas?.scene, data = {}) {
    if (game.user?.isGM !== true) return { created: false, reason: "not-gm", trail: null };
    if (!scene?.setFlag) return { created: false, reason: "invalid-scene", trail: null };

    const trailApi = getScentTrailsApi();
    const worldTime = game.time?.worldTime ?? 0;
    const sourceData = buildTrailSourceData(data, scene);
    const trail = trailApi.normalizeTrail({ ...data, ...sourceData }, { idFactory: randomId, worldTime });
    const trails = trailApi.upsertTrail(getScentTrails(scene), trail, { worldTime });
    await persistScentTrails(scene, trails);
    return { created: true, trail };
  }

  async function updateScentTrail(scene = canvas?.scene, trailId, data = {}) {
    if (game.user?.isGM !== true) return { updated: false, reason: "not-gm", trail: null };
    if (!scene?.setFlag) return { updated: false, reason: "invalid-scene", trail: null };

    const trailApi = getScentTrailsApi();
    const trails = getScentTrails(scene);
    const current = trails.find((trail) => trail.id === trailId);
    if (!current) return { updated: false, reason: "missing-trail", trail: null };

    const worldTime = game.time?.worldTime ?? current.updatedWorldTime;
    const sourceData = data.sourceToken || data.sourceTokenId ? buildTrailSourceData(data, scene) : {};
    const trail = trailApi.normalizeTrail({
      ...current,
      ...data,
      ...sourceData,
      id: current.id,
      createdWorldTime: current.createdWorldTime,
      updatedWorldTime: worldTime,
    }, { worldTime });
    await persistScentTrails(scene, trailApi.upsertTrail(trails, trail, { worldTime }));
    return { updated: true, trail };
  }

  async function deleteScentTrail(scene = canvas?.scene, trailId) {
    if (game.user?.isGM !== true) return { deleted: false, reason: "not-gm" };
    if (!scene?.setFlag) return { deleted: false, reason: "invalid-scene" };

    const trailApi = getScentTrailsApi();
    const trails = getScentTrails(scene);
    const remaining = trailApi.deleteTrail(trails, trailId);
    if (remaining.length === trails.length) return { deleted: false, reason: "missing-trail" };

    await persistScentTrails(scene, remaining);
    return { deleted: true };
  }

  function getScentTrailDc(trailOrId, tracker, options = {}) {
    const scene = options.scene ?? tracker?.scene ?? tracker?.document?.parent ?? canvas?.scene;
    const trail = typeof trailOrId === "string" ? findScentTrail(scene, trailOrId) : trailOrId;
    if (!trail) return { trackable: false, dc: null, reason: "missing-trail" };

    return getScentTrailsApi()?.getScentTrailDc?.(trail, tracker, {
      ...options,
      canTrackByScent: options.canTrackByScent ?? canTrackByScent,
      rules: options.rules ?? getScentRules(),
      worldTime: options.worldTime ?? game.time?.worldTime ?? 0,
    }) ?? { trackable: false, dc: null, reason: "trails-unavailable" };
  }

  async function createWhisper(userIds, content) {
    const recipients = Array.from(new Set(userIds.filter(Boolean)));
    if (recipients.length === 0 || !globalThis.ChatMessage?.create) return null;

    return ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ alias: "Scent" }),
      whisper: recipients,
      content,
    });
  }

  function getTrackingReasonLabel(reason) {
    return localize(`D35EScent.TrailManager.Reason.${reason ?? "unknown"}`);
  }

  function buildTrackingPromptContent(data, { gm = false } = {}) {
    const context = format("D35EScent.Trail.RollContext", {
      age: data.trailAgeHours,
      water: localize(`D35EScent.TrailManager.Water.${data.waterState === "flowingWater" ? "FlowingWater" : data.waterState === "water" ? "Water" : "None"}`),
      competing: data.powerfulCompetingOdor ? localize("D35EScent.TrailManager.Yes") : localize("D35EScent.TrailManager.No"),
      modifier: data.odorDcModifier,
    });
    const header = data.trackable
      ? format("D35EScent.Trail.RollPrompt", { tracker: data.trackerName, dc: data.dc })
      : format("D35EScent.Trail.RollUnavailable", { tracker: data.trackerName, reason: getTrackingReasonLabel(data.reason) });

    let content = `<p>${escapeHtml(header)}</p><p>${escapeHtml(context)}</p>`;
    if (gm) {
      content += `<p>${escapeHtml(format("D35EScent.Trail.GmRollContext", {
        trail: data.trailLabel,
        source: data.sourceName || localize("D35EScent.TrailManager.UnknownSource"),
        notes: [data.sizeNotes, data.countNotes, data.notes].filter(Boolean).join("; ") || localize("D35EScent.TrailManager.None"),
      }))}</p>`;
    }

    return content;
  }

  async function tryNativeSurvivalRoll(actor, dcResult, options = {}) {
    if (options.nativeRoll === false) return null;
    if (typeof options.rollFunction === "function") {
      return { rolled: true, method: "custom", result: await options.rollFunction({ actor, dcResult, options }) };
    }

    if (typeof actor?.rollSkill !== "function") return null;

    try {
      return {
        rolled: true,
        method: "actor.rollSkill",
        result: await actor.rollSkill(options.skillId ?? "sur", { dc: dcResult.dc, event: options.event }),
      };
    } catch (error) {
      console.warn(`${MODULE_ID} | Native Survival roll failed; creating tracking prompt instead.`, error);
      return null;
    }
  }

  async function rollTrackByScent(trackerToken, trailId, options = {}) {
    const actor = trackerToken?.actor ?? trackerToken?.document?.actor;
    const allowed = game.user?.isGM === true || actor?.testUserPermission?.(game.user, "OWNER") === true;
    if (!allowed) return { rolled: false, promptCreated: false, reason: "not-authorized" };

    const scene = options.scene ?? trackerToken?.scene ?? trackerToken?.document?.parent ?? canvas?.scene;
    const trail = typeof trailId === "string" ? findScentTrail(scene, trailId) : trailId;
    if (!trail) return { rolled: false, promptCreated: false, reason: "missing-trail" };

    const dcResult = getScentTrailDc(trail, trackerToken, { ...options, scene, requireTracker: true });
    if (dcResult.trackable !== true) {
      return { rolled: false, promptCreated: false, reason: dcResult.reason, dc: dcResult.dc, dcResult };
    }

    const nativeRoll = await tryNativeSurvivalRoll(actor, dcResult, options);
    if (nativeRoll?.rolled === true) return { ...nativeRoll, promptCreated: false, dc: dcResult.dc, dcResult };

    const promptData = getScentTrailsApi().buildRollPromptData(trail, trackerToken, dcResult, {
      worldTime: options.worldTime ?? game.time?.worldTime ?? 0,
      revealTrailLabel: options.revealTrailLabel === true,
    });
    const gmIds = ensureRuntimes().alerts.getActiveGmIds();
    const ownerIds = options.includeOwners === false
      ? []
      : ensureRuntimes().alerts.getActiveOwnerRecipients(trackerToken).filter((userId) => !game.users?.get?.(userId)?.isGM);
    const messages = [];

    const gmMessage = await createWhisper(gmIds, buildTrackingPromptContent(promptData.gm, { gm: true }));
    if (gmMessage) messages.push(gmMessage.id);

    const ownerMessage = await createWhisper(ownerIds, buildTrackingPromptContent(promptData.player, { gm: false }));
    if (ownerMessage) messages.push(ownerMessage.id);

    return {
      rolled: false,
      promptCreated: messages.length > 0,
      reason: "not-rolled",
      dc: dcResult.dc,
      dcResult,
      messageIds: messages,
    };
  }

  async function setScentContextFlags(document, values = {}, options = {}) {
    if (game.user?.isGM !== true) return { updated: false, reason: "not-gm", set: [], unset: [] };
    if (!document?.setFlag || !document?.unsetFlag) return { updated: false, reason: "invalid-document", set: [], unset: [] };

    const contextApi = getContextApi();
    const token = options.token ?? document.documentName !== "Scene";
    const changes = contextApi?.buildFlagChanges?.(values, { token }) ?? { set: {}, unset: [] };
    const setKeys = [];
    const unsetKeys = [];

    for (const key of changes.unset ?? []) {
      if (contextApi?.readFlag?.(document, key) === undefined) continue;
      await document.unsetFlag(MODULE_ID, key);
      unsetKeys.push(key);
    }

    for (const [key, value] of Object.entries(changes.set ?? {})) {
      if (contextApi?.readFlag?.(document, key) === value) continue;
      await document.setFlag(MODULE_ID, key, value);
      setKeys.push(key);
    }

    const updated = setKeys.length > 0 || unsetKeys.length > 0;
    if (updated && options.refresh !== false) {
      resetNotificationState({ scan: true });
      refreshOverlay();
    }

    return { updated, set: setKeys, unset: unsetKeys };
  }

  async function setOdorProfileFlags(document, values = {}, options = {}) {
    if (game.user?.isGM !== true) return { updated: false, reason: "not-gm", set: [], unset: [] };
    if (!document?.setFlag || !document?.unsetFlag) return { updated: false, reason: "invalid-document", set: [], unset: [] };

    const odorProfileApi = getOdorProfileApi();
    const changes = odorProfileApi?.buildFlagChanges?.(values) ?? { set: {}, unset: [] };
    const setKeys = [];
    const unsetKeys = [];

    for (const key of changes.unset ?? []) {
      if (odorProfileApi?.readFlag?.(document, key) === undefined) continue;
      await document.unsetFlag(MODULE_ID, key);
      unsetKeys.push(key);
    }

    for (const [key, value] of Object.entries(changes.set ?? {})) {
      if (JSON.stringify(odorProfileApi?.readFlag?.(document, key)) === JSON.stringify(value)) continue;
      await document.setFlag(MODULE_ID, key, value);
      setKeys.push(key);
    }

    const updated = setKeys.length > 0 || unsetKeys.length > 0;
    if (updated && options.refresh !== false) {
      resetNotificationState({ scan: true });
      refreshOverlay();
    }

    return { updated, set: setKeys, unset: unsetKeys };
  }

  function registerScentSense() {
    return ensureRuntimes().integration.registerScentSense();
  }

  function registerDetectionMode() {
    return ensureRuntimes().integration.registerDetectionMode();
  }

  async function syncActorTokens(actor) {
    return ensureRuntimes().integration.syncActorTokens(actor);
  }

  function queueActorSync(actor) {
    return ensureRuntimes().integration.queueActorSync(actor);
  }
  const debouncedRefreshOverlay = foundry.utils.debounce(refreshOverlay, 50);
  const debouncedScan = foundry.utils.debounce(() => {
    scan().catch((error) => console.error(`${MODULE_ID} | Scent scan failed.`, error));
  }, 150);

  function patchTokenDocumentRefresh() {
    return ensureRuntimes().integration.patchTokenDocumentRefresh();
  }

  function isOverlayVisible(actorOrToken) {
    return ensureRuntimes().overlay.isOverlayVisible(actorOrToken);
  }

  async function setOverlayVisible(actorOrToken, visible) {
    return ensureRuntimes().overlay.setOverlayVisible(actorOrToken, visible);
  }

  function refreshOverlay() {
    if (!isD35E()) return;
    return ensureRuntimes().overlay.refreshOverlay();
  }

  function showLocalPinpointCue(point) {
    return ensureRuntimes().overlay.showLocalPinpointCue(point);
  }

  function isPrimaryActiveGm() {
    return ensureRuntimes().alerts.isPrimaryActiveGm();
  }

  function getActiveGmIds() {
    return ensureRuntimes().alerts.getActiveGmIds();
  }

  function getActiveOwnerRecipients(token) {
    return ensureRuntimes().alerts.getActiveOwnerRecipients(token);
  }

  function shouldEvaluateScentTarget(sourceToken, targetToken) {
    return ensureRuntimes().detection.shouldEvaluateScentTarget(sourceToken, targetToken);
  }

  function measureTokenDistance(sourceToken, targetToken) {
    return ensureRuntimes().detection.measureTokenDistance(sourceToken, targetToken);
  }

  function isWallBlocked(sourceToken, targetToken) {
    return ensureRuntimes().detection.isWallBlocked(sourceToken, targetToken);
  }

  function makeStateKey(sceneId, sourceTokenId, targetTokenId, band) {
    return `${sceneId}|${sourceTokenId}|${targetTokenId}|${band}`;
  }

  function roundDistance(distance) {
    return Math.round(distance * 10) / 10;
  }

  async function dispatchPresenceAlert({ scene, sourceToken, targetToken, distance, recipients, detection }) {
    return ensureRuntimes().alerts.dispatchPresenceAlert({ scene, sourceToken, targetToken, distance, recipients, detection });
  }

  async function dispatchPinpointAlert({ scene, sourceToken, targetToken, distance, recipients, detection }) {
    return ensureRuntimes().alerts.dispatchPinpointAlert({ scene, sourceToken, targetToken, distance, recipients, detection });
  }

  async function scanScene(scene = canvas?.scene) {
    if (!scene || !canvas?.ready || scene.id !== canvas.scene?.id) return { scanned: false, reason: "inactive-scene" };
    if (!isPrimaryActiveGm()) return { scanned: false, reason: "not-primary-gm" };

    const enablePresence = getSetting(SETTINGS.ENABLE_PRESENCE_ALERTS) === true;
    const enablePinpoint = getSetting(SETTINGS.ENABLE_PINPOINT_ALERTS) === true;
    const activeSceneKeys = new Set();
    let scentSources = 0;
    let candidates = 0;
    let alerts = 0;

    const tokens = canvas.tokens?.placeables ?? [];

    for (const sourceToken of tokens) {
      if (!sourceToken?.actor || sourceToken.document?.hidden === true) continue;

      const range = getScentRange(sourceToken.actor);
      if (range <= 0) continue;

      const recipients = getActiveOwnerRecipients(sourceToken);
      if (recipients.length === 0) continue;

      scentSources += 1;

      for (const targetToken of tokens) {
        if (!shouldEvaluateScentTarget(sourceToken, targetToken)) continue;

        const distance = measureTokenDistance(sourceToken, targetToken);
        const scentState = evaluateScentState(sourceToken, targetToken, { baseRange: range, distance, scene });
        if (!scentState.detectable) continue;
        if (isWallBlocked(sourceToken, targetToken)) continue;

        const band = scentState.notificationBand ?? scentState.band;
        if (band === RANGE_BANDS.PRESENCE && !enablePresence) continue;
        if (band === RANGE_BANDS.PINPOINT && !enablePinpoint) continue;

        candidates += 1;

        const stateKey = makeStateKey(scene.id, sourceToken.id, targetToken.id, band);
        activeSceneKeys.add(stateKey);
        if (notificationState.has(stateKey)) continue;

        notificationState.add(stateKey);
        if (band === RANGE_BANDS.PINPOINT) {
          await dispatchPinpointAlert({ scene, sourceToken, targetToken, distance, recipients, detection: scentState });
        } else {
          await dispatchPresenceAlert({ scene, sourceToken, targetToken, distance, recipients, detection: scentState });
        }
        alerts += 1;
      }
    }

    const scenePrefix = `${scene.id}|`;
    for (const key of Array.from(notificationState)) {
      if (key.startsWith(scenePrefix) && !activeSceneKeys.has(key)) notificationState.delete(key);
    }

    return { scanned: true, scentSources, candidates, alerts };
  }

  async function scan(options = {}) {
    if (!isD35E() || !canvas?.ready) return { scanned: false, reason: "not-ready" };

    if (!isPrimaryActiveGm()) {
      game.socket?.emit(SOCKET_NAME, { id: randomId(), type: SOCKET_TYPES.SCAN_REQUEST });
      return { scanned: false, requested: true };
    }

    if (scanInProgress) {
      scanQueuedDuringRun = true;
      return { scanned: false, deferred: true };
    }

    scanInProgress = true;
    try {
      return await scanScene(options.scene ?? canvas.scene);
    } finally {
      scanInProgress = false;
      if (scanQueuedDuringRun) {
        scanQueuedDuringRun = false;
        queueScan();
      }
    }
  }

  function queueScan() {
    if (!game.ready || !canvas?.ready || !isD35E()) return;
    debouncedScan();
  }

  function resetNotificationState(options = {}) {
    notificationState.clear();
    ensureRuntimes().alerts.reset();
    if (options.scan === true) queueScan();
  }

  function registerSocket() {
    return ensureRuntimes().alerts.registerSocket();
  }

  function registerChatMessageHook() {
    return ensureRuntimes().alerts.registerChatMessageHook();
  }

  function openContextManager(options = {}) {
    return ensureRuntimes().contextManager.openContextManager(options);
  }

  function registerContextManagerTool(controls) {
    return ensureRuntimes().contextManager.registerContextManagerTool(controls);
  }

  function openTrailManager(options = {}) {
    return ensureRuntimes().trailManager.openTrailManager(options);
  }

  function registerTrailManagerTool(controls) {
    return ensureRuntimes().trailManager.registerTrailManagerTool(controls);
  }

  async function refresh(options = {}) {
    registerSettings();
    registerScentSense();
    registerDetectionMode();
    patchTokenDocumentRefresh();
    registerSocket();

    const persist = options?.persist === true && game.user?.isGM === true;

    for (const actor of game.actors ?? []) {
      if (!["character", "npc"].includes(actor.type)) continue;
      if (persist) await syncActorTokens(actor);
    }

    refreshOverlay();
    queueScan();
  }

  function renderTokenHudToggle(app, html) {
    return ensureRuntimes().overlay.renderTokenHudToggle(app, html);
  }

  function registerHooks() {
    if (globalThis[HOOKS_REGISTERED] === true) return;

    Hooks.on("canvasReady", () => {
      resetNotificationState();
      refresh({ persist: game.user?.isGM === true }).catch((error) => {
        console.error(`${MODULE_ID} | Failed to refresh scent support on canvasReady.`, error);
      });
    });
    Hooks.on("controlToken", debouncedRefreshOverlay);
    Hooks.on("refreshToken", debouncedRefreshOverlay);
    Hooks.on("createToken", () => {
      debouncedRefreshOverlay();
      queueScan();
    });
    Hooks.on("deleteToken", () => {
      debouncedRefreshOverlay();
      queueScan();
    });
    Hooks.on("updateToken", () => {
      debouncedRefreshOverlay();
      queueScan();
    });
    Hooks.on("updateActor", (actor, _changes, options) => {
      if (options?.[MODULE_ID]?.sync !== true) queueActorSync(actor);
      queueScan();
    });
    Hooks.on("createItem", (item) => queueActorSync(item.actor));
    Hooks.on("updateItem", (item, _changes, options) => {
      if (options?.[MODULE_ID]?.sync !== true) queueActorSync(item.actor);
      queueScan();
    });
    Hooks.on("deleteItem", (item) => {
      queueActorSync(item.actor);
      queueScan();
    });
    Hooks.on("updateScene", (scene) => {
      if (scene?.id === canvas?.scene?.id) queueScan();
    });
    Hooks.on("getSceneControlButtons", registerContextManagerTool);
    Hooks.on("getSceneControlButtons", registerTrailManagerTool);
    Hooks.on("renderTokenHUD", renderTokenHudToggle);
    registerChatMessageHook();
    Hooks.on("userConnected", queueScan);
    Hooks.on("updateCombat", queueScan);

    globalThis[HOOKS_REGISTERED] = true;
  }

  function exposeApi() {
    const api = globalThis.d35eScentSenseApi.create({
      constants: {
        MODULE_ID,
        SENSE_ID,
        DETECTION_MODE_ID,
        DEFAULT_SCENT_RANGE,
        PINPOINT_RANGE,
      },
      canTrackByScent,
      createScentTrail,
      deleteScentTrail,
      evaluateScentDetection,
      evaluateScentState,
      getEffectiveScentRange,
      getOdorProfile,
      getOdorProfileApi,
      getScentContext,
      getScentRange,
      getContextApi,
      getScentRules,
      getScentStateApi,
      getScentTrailDc,
      getScentTrails,
      getScentTrailsApi,
      getTrackingByScentDc,
      hasScent,
      identifyFamiliarOdor,
      isOverlayVisible,
      openContextManager,
      openTrailManager,
      refresh,
      resetNotificationState,
      rollTrackByScent,
      scan,
      setOdorProfileFlags,
      setScentContextFlags,
      setOverlayVisible,
      syncActorTokens,
      updateScentTrail,
    });

    game.d35eScentSense = api;
    globalThis.d35eScentSense = api;
  }

  function bootstrap() {
    if (!isD35E()) return;

    refreshPackageMetadata();
    registerSettings();
    registerScentSense();
    registerDetectionMode();
    patchTokenDocumentRefresh();
    registerHooks();
    registerSocket();
    exposeApi();

    if (game.ready === true) {
      refresh({ persist: game.user?.isGM === true }).catch((error) => {
        console.error(`${MODULE_ID} | Failed to refresh scent support on bootstrap.`, error);
      });
    }

    if (globalThis[BOOTSTRAPPED] !== true) {
      globalThis[BOOTSTRAPPED] = true;
      console.info(`${MODULE_ID} | Registered D35E Scent extraordinary ability support.`);
    }
  }

  Hooks.once("init", bootstrap);
  Hooks.once("ready", bootstrap);
  if (game.ready === true) bootstrap();
})();
