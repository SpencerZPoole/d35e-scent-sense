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
  const OVERLAY_NAME = `${MODULE_ID}.overlay`;
  const CUE_NAME = `${MODULE_ID}.pinpointCue`;
  const TOKEN_REFRESH_PATCHED = Symbol.for(`${MODULE_ID}.tokenDocumentRefreshDetectionModesPatched`);
  const TOKEN_REFRESH_ORIGINAL = Symbol.for(`${MODULE_ID}.tokenDocumentRefreshDetectionModesOriginal`);
  const HOOKS_REGISTERED = Symbol.for(`${MODULE_ID}.hooksRegistered`);
  const SETTINGS_REGISTERED = Symbol.for(`${MODULE_ID}.settingsRegistered`);
  const SOCKET_REGISTERED = Symbol.for(`${MODULE_ID}.socketRegistered`);
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
    SCAN_REQUEST: "scanRequest",
  };

  const RANGE_BANDS = {
    PRESENCE: "presence",
    PINPOINT: "pinpoint",
  };

  let overlayContainer = null;
  let cueContainer = null;
  let wallCollisionWarningShown = false;
  let scanInProgress = false;
  let scanQueuedDuringRun = false;

  const pendingActorSync = new Set();
  const notificationState = new Set();
  const handledSocketMessages = new Set();
  const gmEventCache = new Map();

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

  function getTargetDocument(targetToken) {
    return targetToken?.document ?? targetToken;
  }

  function buildScentContext(sourceToken, targetToken, options = {}) {
    const rules = getScentRules();
    const explicit = options.context ?? options;
    const targetDocument = getTargetDocument(targetToken);
    const targetActor = targetToken?.actor ?? targetDocument?.actor;
    const scene = options.scene ?? targetDocument?.parent ?? canvas?.scene;

    const context = {
      windBand: firstDefined(
        explicit.windBand,
        explicit.wind,
        readFlag(targetDocument, "windBand"),
        readFlag(targetActor, "windBand"),
        readFlag(scene, "windBand")
      ),
      odorStrength: firstDefined(
        explicit.odorStrength,
        explicit.odor,
        readFlag(targetDocument, "odorStrength"),
        readFlag(targetActor, "odorStrength"),
        readFlag(scene, "odorStrength")
      ),
      maskingOdor: firstDefined(
        explicit.maskingOdor,
        explicit.maskedByOdor,
        readFlag(targetDocument, "maskingOdor"),
        readFlag(targetActor, "maskingOdor"),
        readFlag(scene, "maskingOdor")
      ),
    };

    return rules?.normalizeContext?.(context) ?? {
      windBand: "normal",
      odorStrength: "normal",
      maskingOdor: false,
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
    for (const item of actor.items) {
      range = Math.max(range, itemContributesScent(item));
    }

    return range;
  }

  function getScentRange(actor) {
    if (!actor || !["character", "npc"].includes(actor.type)) return 0;
    if (actor.system?.noVisionOverride === true) return 0;

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

  function evaluateScentDetection(sourceToken, targetToken, options = {}) {
    const rules = getScentRules();
    const baseRange = options.baseRange !== undefined ? positiveNumber(options.baseRange, 0) : getScentRange(getTokenActor(sourceToken));
    const distance = options.distance !== undefined ? Number(options.distance) : measureTokenDistance(sourceToken, targetToken);
    const context = buildScentContext(sourceToken, targetToken, options);

    if (rules?.evaluateDetection) {
      return rules.evaluateDetection({ sourceToken, targetToken, baseRange, distance, context, pinpointRange: PINPOINT_RANGE });
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

  function getTrackingByScentDc(options = {}) {
    return getScentRules()?.getTrackingByScentDc?.(options) ?? { trackable: false, dc: null, reason: "rules-unavailable" };
  }

  function canTrackByScent(actor) {
    return getScentRules()?.canTrackByScent?.(actor, { hasScent: hasScent(actor) }) ?? false;
  }

  function registerScentSense() {
    if (!isD35E()) return;
    CONFIG.D35E ??= {};
    CONFIG.D35E.senses ??= {};
    CONFIG.D35E.senses[SENSE_ID] ??= "D35E.Sense.scent";
  }

  function registerDetectionMode() {
    if (!isD35E()) return;

    const DetectionMode = foundry.canvas?.perception?.DetectionMode;
    if (!DetectionMode || !CONFIG.Canvas?.detectionModes) {
      console.warn(`${MODULE_ID} | Foundry detection mode API was not available.`);
      return;
    }

    if (CONFIG.Canvas.detectionModes[DETECTION_MODE_ID]) return;

    class DetectionModeScentPinpoint extends DetectionMode {
      static ID = DETECTION_MODE_ID;
      static LABEL = "D35E.Sense.scentPinpoint";
      static DETECTION_TYPE = DetectionMode.DETECTION_TYPES.OTHER;
      static PRIORITY = 200_400;

      constructor(data = {}, ...args) {
        data.walls = true;
        super(data, ...args);
      }

      static getDetectionFilter() {
        this._detectionFilter ??= foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
          outlineColor: [0.42, 0.7, 0.28, 1],
          knockout: false,
          wave: true,
        });
        return this._detectionFilter;
      }

      _canDetect() {
        return true;
      }
    }

    CONFIG.Canvas.detectionModes[DETECTION_MODE_ID] = new DetectionModeScentPinpoint({
      id: DetectionModeScentPinpoint.ID,
      label: DetectionModeScentPinpoint.LABEL,
      type: DetectionModeScentPinpoint.DETECTION_TYPE,
    });
  }

  function buildDetectionModesWithScent(currentModes, range) {
    const shouldEnable = range > 0;
    const scentMode = shouldEnable ? { enabled: true, range: Math.min(PINPOINT_RANGE, range) } : null;

    if (Array.isArray(currentModes)) {
      const modes = currentModes.map((mode) => ({ ...mode }));
      const index = modes.findIndex((mode) => mode.id === DETECTION_MODE_ID);

      if (scentMode) {
        if (index >= 0) {
          const existing = modes[index];
          if (existing.enabled === true && existing.range === scentMode.range) return { changed: false, modes: currentModes };
          modes[index] = { ...existing, ...scentMode, id: DETECTION_MODE_ID };
        } else {
          modes.push({ id: DETECTION_MODE_ID, ...scentMode });
        }
      } else if (index >= 0) {
        modes.splice(index, 1);
      } else {
        return { changed: false, modes: currentModes };
      }

      sortDetectionModeArray(modes);
      return { changed: true, modes };
    }

    const modes = clone(currentModes ?? {});
    const existing = modes[DETECTION_MODE_ID];

    if (scentMode) {
      if (existing?.enabled === true && existing?.range === scentMode.range) return { changed: false, modes: currentModes };
      modes[DETECTION_MODE_ID] = scentMode;
      return { changed: true, modes };
    }

    if (existing === undefined) return { changed: false, modes: currentModes };
    delete modes[DETECTION_MODE_ID];
    return { changed: true, modes };
  }

  function buildDetectionModeUpdateData(path, currentModes, range) {
    const result = buildDetectionModesWithScent(currentModes, range);
    if (!result.changed) return null;

    if (Array.isArray(currentModes)) return { [path]: result.modes };

    if (range > 0) {
      return { [`${path}.${DETECTION_MODE_ID}`]: { enabled: true, range: Math.min(PINPOINT_RANGE, range) } };
    }

    const ForcedDeletion = foundry.data?.operators?.ForcedDeletion;
    if (ForcedDeletion) return { [`${path}.${DETECTION_MODE_ID}`]: new ForcedDeletion() };

    return { [`${path}.-=${DETECTION_MODE_ID}`]: null };
  }

  function sortDetectionModeArray(modes) {
    const basicId = foundry.canvas.perception.DetectionMode.BASIC_MODE_ID;
    modes.sort((a, b) => {
      if (a.id === basicId) return -1;
      if (b.id === basicId) return 1;

      const priorityA = CONFIG.Canvas?.detectionModes?.[a.id]?.constructor?.PRIORITY ?? 0;
      const priorityB = CONFIG.Canvas?.detectionModes?.[b.id]?.constructor?.PRIORITY ?? 0;
      return priorityA - priorityB;
    });
  }

  function applyScentDetectionMode(tokenDocument) {
    const actor = tokenDocument?.actor;
    const range = getScentRange(actor);
    const result = buildDetectionModesWithScent(tokenDocument?.detectionModes, range);
    if (!result.changed) return false;

    tokenDocument.detectionModes = result.modes;
    return true;
  }

  async function persistTokenScentDetection(tokenDocument) {
    if (!game.user?.isGM || !tokenDocument?.update) return false;

    const range = getScentRange(tokenDocument.actor);
    const updateData = buildDetectionModeUpdateData("detectionModes", tokenDocument.detectionModes, range);
    if (!updateData) return false;

    await tokenDocument.update(updateData, { [MODULE_ID]: { sync: true }, stopAuraUpdate: true });
    return true;
  }

  async function persistPrototypeScentDetection(actor) {
    if (!game.user?.isGM || !actor?.update) return false;

    const range = getScentRange(actor);
    const currentModes = foundry.utils.getProperty(actor, "prototypeToken.detectionModes") ?? {};
    const updateData = buildDetectionModeUpdateData("prototypeToken.detectionModes", currentModes, range);
    if (!updateData) return false;

    await actor.update(updateData, { [MODULE_ID]: { sync: true }, stopAuraUpdate: true });
    return true;
  }

  async function syncActorTokens(actor) {
    if (!actor || !["character", "npc"].includes(actor.type)) return;

    if (game.user?.isGM) {
      await persistPrototypeScentDetection(actor);

      for (const token of actor.getActiveTokens?.(true) ?? []) {
        await persistTokenScentDetection(token.document);
      }
    }

    refreshOverlay();
    queueScan();
  }

  function queueActorSync(actor) {
    if (!actor?.id) return;
    pendingActorSync.add(actor.id);
    debouncedFlushActorSync();
  }

  async function flushActorSync() {
    const actorIds = Array.from(pendingActorSync);
    pendingActorSync.clear();

    for (const actorId of actorIds) {
      const actor = game.actors?.get(actorId);
      if (!actor) continue;
      try {
        await syncActorTokens(actor);
      } catch (error) {
        console.error(`${MODULE_ID} | Failed to sync scent detection for ${actor.name}.`, error);
      }
    }

    refreshOverlay();
    queueScan();
  }

  const debouncedFlushActorSync = foundry.utils.debounce(flushActorSync, 100);
  const debouncedRefreshOverlay = foundry.utils.debounce(refreshOverlay, 50);
  const debouncedScan = foundry.utils.debounce(() => {
    scan().catch((error) => console.error(`${MODULE_ID} | Scent scan failed.`, error));
  }, 150);

  function patchTokenDocumentRefresh() {
    if (!isD35E()) return;

    const TokenDocumentClass = CONFIG.Token?.documentClass ?? globalThis.TokenDocument;
    if (!TokenDocumentClass?.prototype?.refreshDetectionModes) {
      console.warn(`${MODULE_ID} | TokenDocument.refreshDetectionModes was not found; scent detection will rely on hooks only.`);
      return;
    }

    if (TokenDocumentClass.prototype[TOKEN_REFRESH_PATCHED] === true) return;

    const original = TokenDocumentClass.prototype.refreshDetectionModes;
    Object.defineProperty(TokenDocumentClass.prototype, TOKEN_REFRESH_ORIGINAL, { value: original });

    TokenDocumentClass.prototype.refreshDetectionModes = function d35eScentSenseRefreshDetectionModes(...args) {
      const result = original.call(this, ...args);
      applyScentDetectionMode(this);
      return result;
    };

    Object.defineProperty(TokenDocumentClass.prototype, TOKEN_REFRESH_PATCHED, { value: true });
  }

  function getActorFromEntity(actorOrToken) {
    if (!actorOrToken) return null;
    if (actorOrToken.actor) return actorOrToken.actor;
    if (actorOrToken.document?.actor) return actorOrToken.document.actor;
    if (actorOrToken.documentName === "Actor") return actorOrToken;
    return null;
  }

  function getOverlayKey(actorOrToken) {
    const actor = getActorFromEntity(actorOrToken);
    if (actor?.id) return `actor:${actor.id}`;

    const tokenDocument = actorOrToken?.document ?? actorOrToken;
    if (tokenDocument?.id) return `token:${tokenDocument.id}`;
    return null;
  }

  function readOverlayHiddenActors() {
    const value = getSetting(SETTINGS.OVERLAY_HIDDEN_ACTORS);
    return value && typeof value === "object" ? clone(value) : {};
  }

  function isOverlayVisible(actorOrToken) {
    if (getSetting(SETTINGS.OVERLAY_ENABLED) !== true) return false;

    const key = getOverlayKey(actorOrToken);
    if (!key) return true;

    const hidden = readOverlayHiddenActors();
    return hidden[key] !== true;
  }

  async function setOverlayVisible(actorOrToken, visible) {
    const key = getOverlayKey(actorOrToken);
    if (!key) return false;

    const hidden = readOverlayHiddenActors();
    if (visible === true) delete hidden[key];
    else hidden[key] = true;

    await game.settings.set(MODULE_ID, SETTINGS.OVERLAY_HIDDEN_ACTORS, hidden);
    refreshOverlay();
    return true;
  }

  function canCurrentUserSeeScentOverlay(token) {
    if (!token?.actor) return false;
    if (!isOverlayVisible(token)) return false;
    if (token.document?.hidden === true && game.user?.isGM !== true) return false;
    if (game.user?.isGM === true) return true;
    return token.actor.testUserPermission?.(game.user, "OWNER") === true;
  }

  function getSceneUnitsToPixels(range) {
    const distance = positiveNumber(canvas?.scene?.grid?.distance, positiveNumber(canvas?.dimensions?.distance, 5));
    const size = positiveNumber(canvas?.grid?.size, positiveNumber(canvas?.dimensions?.size, 100));
    return (range / distance) * size;
  }

  function getOrCreateOverlayContainer() {
    if (!canvas?.tokens) return null;

    if (overlayContainer?.parent) return overlayContainer;

    overlayContainer = canvas.tokens.getChildByName?.(OVERLAY_NAME) ?? new PIXI.Container();
    overlayContainer.name = OVERLAY_NAME;
    overlayContainer.eventMode = "none";
    overlayContainer.interactive = false;
    overlayContainer.sortableChildren = false;

    if (!overlayContainer.parent) canvas.tokens.addChildAt(overlayContainer, 0);
    return overlayContainer;
  }

  function getOrCreateCueContainer() {
    if (!canvas?.tokens) return null;
    if (cueContainer?.parent) return cueContainer;

    cueContainer = canvas.tokens.getChildByName?.(CUE_NAME) ?? new PIXI.Container();
    cueContainer.name = CUE_NAME;
    cueContainer.eventMode = "none";
    cueContainer.interactive = false;
    cueContainer.sortableChildren = false;

    if (!cueContainer.parent) canvas.tokens.addChild(cueContainer);
    return cueContainer;
  }

  function clearOverlay() {
    if (!overlayContainer) return;
    overlayContainer.removeChildren().forEach((child) => child.destroy({ children: true }));
  }

  function refreshOverlay() {
    if (!canvas?.ready || !canvas?.tokens?.placeables || !isD35E()) return;

    const container = getOrCreateOverlayContainer();
    if (!container) return;

    clearOverlay();

    for (const token of canvas.tokens.placeables) {
      if (!canCurrentUserSeeScentOverlay(token)) continue;

      const range = getScentRange(token.actor);
      if (range <= 0) continue;

      const radius = getSceneUnitsToPixels(range);
      if (!Number.isFinite(radius) || radius <= 0) continue;

      const ring = new PIXI.Graphics();
      ring.lineStyle(2, 0x6fac48, 0.9);
      ring.drawCircle(token.center.x, token.center.y, radius);
      container.addChild(ring);
    }
  }

  function showLocalPinpointCue(point) {
    if (!canvas?.ready || !point) return;

    const container = getOrCreateCueContainer();
    if (!container) return;

    const radius = Math.max(14, positiveNumber(canvas.grid?.size, 100) * 0.22);
    const cue = new PIXI.Graphics();
    cue.lineStyle(4, 0x6fac48, 0.95);
    cue.drawCircle(point.x, point.y, radius);
    cue.lineStyle(1, 0xffffff, 0.75);
    cue.drawCircle(point.x, point.y, Math.max(6, radius * 0.55));
    container.addChild(cue);

    window.setTimeout(() => {
      if (!cue.destroyed) cue.destroy();
    }, 2500);
  }

  function isPrimaryActiveGm() {
    if (game.user?.isGM !== true) return false;

    const activeGms = game.users
      .filter((user) => user.active && user.isGM)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return activeGms[0]?.id === game.user.id;
  }

  function getActiveGmIds() {
    return game.users.filter((user) => user.active && user.isGM).map((user) => user.id);
  }

  function getActiveOwnerRecipients(token) {
    if (!token?.actor) return [];

    const nonGmOwners = game.users
      .filter((user) => user.active && !user.isGM && token.actor.testUserPermission?.(user, "OWNER") === true)
      .map((user) => user.id);
    if (nonGmOwners.length > 0) return nonGmOwners;

    if (game.user?.isGM === true && token.actor.testUserPermission?.(game.user, "OWNER") === true) return [game.user.id];
    return [];
  }

  function isInvisibleActor(actor) {
    if (!actor) return false;
    if (actor.system?.attributes?.conditions?.invisible === true) return true;
    try {
      if (actor.isInvisible?.() === true) return true;
    } catch (_error) {
      return false;
    }
    return false;
  }

  function isUnknownTarget(token) {
    if (token?.document?.hidden === true) return true;
    return isInvisibleActor(token?.actor);
  }

  function isGmMarkedTarget(token) {
    return (
      token?.document?.getFlag?.(MODULE_ID, "scentRelevant") === true ||
      token?.actor?.getFlag?.(MODULE_ID, "scentRelevant") === true
    );
  }

  function targetMatchesTriggerScope(token) {
    const scope = getSetting(SETTINGS.TRIGGER_SCOPE);
    if (scope === "allCreatures") return true;
    if (scope === "allHostiles") return true;
    if (scope === "gmMarked") return isGmMarkedTarget(token);
    return isUnknownTarget(token);
  }

  function isScentOpponent(_sourceToken, targetToken) {
    return targetToken?.document?.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE;
  }

  function shouldEvaluateScentTarget(sourceToken, targetToken) {
    if (!targetToken?.actor || targetToken.id === sourceToken?.id) return false;

    if (getSetting(SETTINGS.TRIGGER_SCOPE) !== "allCreatures" && !isScentOpponent(sourceToken, targetToken)) {
      return false;
    }

    return targetMatchesTriggerScope(targetToken);
  }

  function measureTokenDistance(sourceToken, targetToken) {
    const source = sourceToken?.center;
    const target = targetToken?.center;
    if (!source || !target) return Infinity;

    try {
      const Ray = foundry.canvas?.geometry?.Ray ?? globalThis.Ray;
      if (Ray && canvas?.grid?.measureDistances) {
        const distances = canvas.grid.measureDistances([{ ray: new Ray(source, target) }], { gridSpaces: true });
        const distance = positiveNumber(distances?.[0], 0);
        if (distance > 0 || source.x === target.x && source.y === target.y) return distance;
      }
    } catch (_error) {
      // Fall through to the generic measurement path.
    }

    try {
      const result = canvas?.grid?.measurePath?.([source, target], { gridSpaces: true });
      const distance = positiveNumber(result?.distance, 0);
      if (distance > 0 || source.x === target.x && source.y === target.y) return distance;
    } catch (_error) {
      // Fall through to Euclidean conversion.
    }

    const pixelDistance = Math.hypot(target.x - source.x, target.y - source.y);
    const gridSize = positiveNumber(canvas?.grid?.size, positiveNumber(canvas?.dimensions?.size, 100));
    const gridDistance = positiveNumber(canvas?.scene?.grid?.distance, positiveNumber(canvas?.dimensions?.distance, 5));
    return (pixelDistance / gridSize) * gridDistance;
  }

  function isWallBlocked(sourceToken, targetToken) {
    if (getSetting(SETTINGS.RESPECT_WALLS) !== true) return false;

    const source = sourceToken?.center;
    const target = targetToken?.center;
    if (!source || !target) return false;

    try {
      const backend = CONFIG.Canvas?.polygonBackends?.sight;
      if (typeof backend?.testCollision === "function") {
        return backend.testCollision(source, target, { type: "sight", mode: "any" }) === true;
      }
    } catch (error) {
      if (!wallCollisionWarningShown) {
        console.warn(`${MODULE_ID} | Could not test wall collision for Scent alerts; falling back to unblocked alerts.`, error);
        wallCollisionWarningShown = true;
      }
    }

    return false;
  }

  function makeStateKey(sceneId, sourceTokenId, targetTokenId, band) {
    return `${sceneId}|${sourceTokenId}|${targetTokenId}|${band}`;
  }

  function roundDistance(distance) {
    return Math.round(distance * 10) / 10;
  }

  function buildGmContextContent(detail) {
    if (!detail?.context) return "";

    return `<p>${escapeHtml(format("D35EScent.Alert.GmContextDetail", {
      range: Number.isFinite(detail.effectiveRange) ? roundDistance(detail.effectiveRange) : "?",
      wind: detail.context.windBand ?? "normal",
      odor: detail.context.odorStrength ?? "normal",
      masking: detail.context.maskingOdor === true ? "yes" : "no",
    }))}</p>`;
  }

  function trimGmEventCache() {
    const maxEntries = 200;
    if (gmEventCache.size <= maxEntries) return;

    const removeCount = gmEventCache.size - maxEntries;
    for (const eventId of Array.from(gmEventCache.keys()).slice(0, removeCount)) {
      gmEventCache.delete(eventId);
    }
  }

  function cacheGmEvent(eventId, data) {
    gmEventCache.set(eventId, data);
    trimGmEventCache();
  }

  function dispatchSocketMessage(payload) {
    payload.id ??= randomId();
    game.socket?.emit(SOCKET_NAME, payload);

    if (payload.recipients?.includes(game.user?.id)) {
      handleSocketMessage(payload).catch((error) => console.error(`${MODULE_ID} | Failed to handle local socket payload.`, error));
    }
  }

  async function createWhisper(userIds, content) {
    const recipients = Array.from(new Set(userIds.filter(Boolean)));
    if (recipients.length === 0) return null;

    return ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ alias: "Scent" }),
      whisper: recipients,
      content,
    });
  }

  async function createGmWhisper(content) {
    return createWhisper(getActiveGmIds(), content);
  }

  function buildPresenceContent() {
    return `<p>${escapeHtml(localize("D35EScent.Alert.Presence"))}</p><p>${escapeHtml(localize("D35EScent.Alert.PresencePrompt"))}</p>`;
  }

  function buildPinpointContent() {
    return `<p>${escapeHtml(localize("D35EScent.Alert.Pinpoint"))}</p>`;
  }

  async function sendMoveActionRequest(alert) {
    const payload = {
      id: randomId(),
      type: SOCKET_TYPES.MOVE_ACTION_REQUEST,
      eventId: alert.eventId,
      sourceName: alert.sourceName,
      sceneName: alert.sceneName,
    };

    game.socket?.emit(SOCKET_NAME, payload);
    if (game.user?.isGM === true) await handleSocketMessage(payload);
  }

  async function showPresenceAlert(alert) {
    if (getSetting(SETTINGS.NOTIFICATION_MODE) === "chat") {
      await createWhisper([game.user.id], buildPresenceContent());
      return;
    }

    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (!DialogV2?.confirm) {
      await createWhisper([game.user.id], buildPresenceContent());
      return;
    }

    const spendMoveAction = await DialogV2.confirm({
      window: { title: localize("D35EScent.Alert.Title") },
      content: buildPresenceContent(),
      yes: { label: localize("D35EScent.Alert.SpendMove") },
      no: { label: localize("D35EScent.Alert.Ignore") },
    });

    if (spendMoveAction === true) await sendMoveActionRequest(alert);
  }

  async function showPinpointAlert(alert) {
    showLocalPinpointCue(alert.point);

    if (getSetting(SETTINGS.NOTIFICATION_MODE) === "chat") {
      await createWhisper([game.user.id], buildPinpointContent());
      return;
    }

    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (!DialogV2?.confirm) {
      await createWhisper([game.user.id], buildPinpointContent());
      return;
    }

    await DialogV2.confirm({
      window: { title: localize("D35EScent.Alert.Title") },
      content: buildPinpointContent(),
      yes: { label: "COMMON.Ok" },
      no: { label: localize("D35EScent.Alert.Ignore") },
    });
  }

  async function handleMoveActionRequest(payload) {
    if (game.user?.isGM !== true) return;

    const detail = gmEventCache.get(payload.eventId);
    const actorName = escapeHtml(detail?.sourceName ?? payload.sourceName ?? "A token");
    const sceneName = escapeHtml(detail?.sceneName ?? payload.sceneName ?? canvas?.scene?.name ?? "the current scene");

    let content = `<p>${escapeHtml(format("D35EScent.Alert.GmDirectionRequest", { actor: actorName }))}</p>`;
    if (detail) {
      content += `<p>${escapeHtml(format("D35EScent.Alert.GmDirectionDetail", {
        actor: detail.sourceName,
        target: detail.targetName,
        distance: roundDistance(detail.distance),
        scene: sceneName,
      }))}</p>`;
      content += buildGmContextContent(detail);
    }

    await createGmWhisper(content);
  }

  async function handleSocketMessage(payload) {
    if (!payload || typeof payload !== "object") return;

    if (payload.type === SOCKET_TYPES.SCAN_REQUEST) {
      if (isPrimaryActiveGm()) queueScan();
      return;
    }

    if (payload.type === SOCKET_TYPES.MOVE_ACTION_REQUEST) {
      await handleMoveActionRequest(payload);
      return;
    }

    if (handledSocketMessages.has(payload.id)) return;
    handledSocketMessages.add(payload.id);
    if (handledSocketMessages.size > 500) handledSocketMessages.delete(handledSocketMessages.values().next().value);

    if (!payload.recipients?.includes(game.user?.id)) return;

    if (payload.type === SOCKET_TYPES.PRESENCE_ALERT) await showPresenceAlert(payload);
    else if (payload.type === SOCKET_TYPES.PINPOINT_ALERT) await showPinpointAlert(payload);
  }

  async function dispatchPresenceAlert({ scene, sourceToken, targetToken, distance, recipients, detection }) {
    const eventId = randomId();
    cacheGmEvent(eventId, {
      eventId,
      sceneId: scene.id,
      sceneName: scene.name,
      sourceName: sourceToken.name,
      targetName: targetToken.name,
      distance,
      effectiveRange: detection?.effectiveRange,
      context: detection?.context,
      band: RANGE_BANDS.PRESENCE,
    });

    await dispatchSocketMessage({
      type: SOCKET_TYPES.PRESENCE_ALERT,
      eventId,
      recipients,
      sourceTokenId: sourceToken.id,
      sourceActorId: sourceToken.actor?.id,
      sourceName: sourceToken.name,
      sceneId: scene.id,
      sceneName: scene.name,
    });
  }

  async function dispatchPinpointAlert({ scene, sourceToken, targetToken, distance, recipients, detection }) {
    const eventId = randomId();
    const detail = {
      eventId,
      sceneId: scene.id,
      sceneName: scene.name,
      sourceName: sourceToken.name,
      targetName: targetToken.name,
      distance,
      effectiveRange: detection?.effectiveRange,
      context: detection?.context,
      band: RANGE_BANDS.PINPOINT,
    };
    cacheGmEvent(eventId, detail);

    await dispatchSocketMessage({
      type: SOCKET_TYPES.PINPOINT_ALERT,
      eventId,
      recipients,
      sourceTokenId: sourceToken.id,
      sourceActorId: sourceToken.actor?.id,
      sourceName: sourceToken.name,
      sceneId: scene.id,
      sceneName: scene.name,
      point: {
        x: targetToken.center.x,
        y: targetToken.center.y,
      },
    });

    await createGmWhisper(`<p>${escapeHtml(format("D35EScent.Alert.GmPinpoint", {
      actor: sourceToken.name,
      target: targetToken.name,
      scene: scene.name,
    }))}</p>${buildGmContextContent(detail)}`);
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
        const detection = evaluateScentDetection(sourceToken, targetToken, { baseRange: range, distance, scene });
        if (!detection.detectable) continue;
        if (isWallBlocked(sourceToken, targetToken)) continue;

        const band = detection.band;
        if (band === RANGE_BANDS.PRESENCE && !enablePresence) continue;
        if (band === RANGE_BANDS.PINPOINT && !enablePinpoint) continue;

        candidates += 1;

        const stateKey = makeStateKey(scene.id, sourceToken.id, targetToken.id, band);
        activeSceneKeys.add(stateKey);
        if (notificationState.has(stateKey)) continue;

        notificationState.add(stateKey);
        if (band === RANGE_BANDS.PINPOINT) {
          await dispatchPinpointAlert({ scene, sourceToken, targetToken, distance, recipients, detection });
        } else {
          await dispatchPresenceAlert({ scene, sourceToken, targetToken, distance, recipients, detection });
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
    gmEventCache.clear();
    if (options.scan === true) queueScan();
  }

  function registerSocket() {
    if (globalThis[SOCKET_REGISTERED] === true) return;
    if (!game.socket?.on) return;

    game.socket.on(SOCKET_NAME, (payload) => {
      handleSocketMessage(payload).catch((error) => console.error(`${MODULE_ID} | Failed to handle socket payload.`, error));
    });

    globalThis[SOCKET_REGISTERED] = true;
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
    const token = app?.object;
    if (!token?.actor || !hasScent(token.actor)) return;
    if (game.user?.isGM !== true && token.actor.testUserPermission?.(game.user, "OWNER") !== true) return;

    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root?.querySelector) return;

    const column = root.querySelector(".col.left") ?? root.querySelector(".col.right");
    if (!column || column.querySelector(`[data-action="${MODULE_ID}.toggleOverlay"]`)) return;

    const control = document.createElement("div");
    control.classList.add("control-icon");
    control.dataset.action = `${MODULE_ID}.toggleOverlay`;
    control.title = localize("D35EScent.HUD.ToggleOverlay");
    const icon = document.createElement("i");
    icon.classList.add("fas", "fa-wind");
    control.appendChild(icon);
    control.classList.toggle("active", isOverlayVisible(token));
    control.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextVisible = !isOverlayVisible(token);
      await setOverlayVisible(token, nextVisible);
      control.classList.toggle("active", nextVisible);
    });

    column.appendChild(control);
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
    Hooks.on("renderTokenHUD", renderTokenHudToggle);
    Hooks.on("userConnected", queueScan);
    Hooks.on("updateCombat", queueScan);

    globalThis[HOOKS_REGISTERED] = true;
  }

  function exposeApi() {
    const api = {
      constants: {
        MODULE_ID,
        SENSE_ID,
        DETECTION_MODE_ID,
        DEFAULT_SCENT_RANGE,
        PINPOINT_RANGE,
      },
      rules: getScentRules(),
      canTrackByScent,
      evaluateScentDetection,
      getEffectiveScentRange,
      getScentRange,
      getTrackingByScentDc,
      hasScent,
      isOverlayVisible,
      refresh,
      resetNotificationState,
      scan,
      setOverlayVisible,
      syncActorTokens,
    };

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
