(() => {
  "use strict";

  function createD35EIntegrationRuntime({
    clone,
    detectionModeId,
    getScentRange,
    getScentRangeBreakdown,
    isD35E,
    moduleId,
    pinpointRange,
    positiveNumber,
    queueScan,
    refreshOverlay,
    senseId,
  } = {}) {
    const tokenRefreshPatched = Symbol.for(`${moduleId}.tokenDocumentRefreshDetectionModesPatched`);
    const tokenRefreshOriginal = Symbol.for(`${moduleId}.tokenDocumentRefreshDetectionModesOriginal`);
    const pendingActorSync = new Set();
    const status = {
      tokenRefreshPatch: {
        available: false,
        installed: false,
        reason: "not-attempted",
      },
      lastSync: null,
    };

    function registerScentSense() {
      if (!isD35E()) return;
      CONFIG.D35E ??= {};
      CONFIG.D35E.senses ??= {};
      CONFIG.D35E.senses[senseId] ??= "D35E.Sense.scent";
    }

    function registerDetectionMode() {
      if (!isD35E()) return;

      const DetectionMode = foundry.canvas?.perception?.DetectionMode;
      if (!DetectionMode || !CONFIG.Canvas?.detectionModes) {
        console.warn(`${moduleId} | Foundry detection mode API was not available.`);
        return;
      }

      if (CONFIG.Canvas.detectionModes[detectionModeId]) return;

      class DetectionModeScentPinpoint extends DetectionMode {
        static ID = detectionModeId;
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

      CONFIG.Canvas.detectionModes[detectionModeId] = new DetectionModeScentPinpoint({
        id: DetectionModeScentPinpoint.ID,
        label: DetectionModeScentPinpoint.LABEL,
        type: DetectionModeScentPinpoint.DETECTION_TYPE,
      });
    }

    function buildDetectionModesWithScent(currentModes, range) {
      const shouldEnable = range > 0;
      const scentMode = shouldEnable ? { enabled: true, range: Math.min(pinpointRange, range) } : null;

      if (Array.isArray(currentModes)) {
        const modes = [];
        let changed = false;
        let sawScent = false;

        for (const mode of currentModes) {
          if (mode?.id !== detectionModeId) {
            modes.push({ ...mode });
            continue;
          }

          if (sawScent) {
            changed = true;
            continue;
          }

          sawScent = true;
          if (!scentMode) {
            changed = true;
            continue;
          }

          const nextMode = { ...mode, ...scentMode, id: detectionModeId };
          if (mode.enabled !== nextMode.enabled || mode.range !== nextMode.range) changed = true;
          modes.push(nextMode);
        }

        if (scentMode && !sawScent) {
          modes.push({ id: detectionModeId, ...scentMode });
          changed = true;
        }

        if (!changed) return { changed: false, modes: currentModes };
        sortDetectionModeArray(modes);
        return { changed: true, modes };
      }

      const modes = clone(currentModes ?? {});
      const existing = modes[detectionModeId];

      if (scentMode) {
        if (existing?.enabled === true && existing?.range === scentMode.range) return { changed: false, modes: currentModes };
        modes[detectionModeId] = scentMode;
        return { changed: true, modes };
      }

      if (existing === undefined) return { changed: false, modes: currentModes };
      delete modes[detectionModeId];
      return { changed: true, modes };
    }

    function buildDetectionModeUpdateData(path, currentModes, range) {
      const result = buildDetectionModesWithScent(currentModes, range);
      if (!result.changed) return null;

      if (Array.isArray(currentModes)) return { [path]: result.modes };

      if (range > 0) {
        return { [`${path}.${detectionModeId}`]: { enabled: true, range: Math.min(pinpointRange, range) } };
      }

      const ForcedDeletion = foundry.data?.operators?.ForcedDeletion;
      if (ForcedDeletion) return { [`${path}.${detectionModeId}`]: new ForcedDeletion() };

      return { [`${path}.-=${detectionModeId}`]: null };
    }

    function getActorSyncGuard(actor) {
      if (!actor || !["character", "npc"].includes(actor.type)) return { allowed: false, reason: "unsupported-actor" };
      return { allowed: true, reason: "allowed" };
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
      const guard = getActorSyncGuard(actor);
      if (!guard.allowed) return false;

      const range = getScentRange(actor);
      const result = buildDetectionModesWithScent(tokenDocument?.detectionModes, range);
      if (!result.changed) return false;

      tokenDocument.detectionModes = result.modes;
      return true;
    }

    function isLiveTokenDocument(tokenDocument) {
      if (!tokenDocument) return false;
      const parent = tokenDocument.parent;
      if (!parent?.tokens?.get) return true;
      if (!tokenDocument.id) return false;
      return parent.tokens.get(tokenDocument.id) === tokenDocument;
    }

    function isStaleTokenDocumentError(error) {
      const message = String(error?.message ?? "");
      return message.includes("does not exist in the EmbeddedCollection collection")
        || message.includes("Cannot read properties of undefined");
    }

    async function persistTokenScentDetection(tokenDocument) {
      if (!game.user?.isGM || !tokenDocument?.update) return false;
      if (!isLiveTokenDocument(tokenDocument)) return false;
      const guard = getActorSyncGuard(tokenDocument.actor);
      if (!guard.allowed) return false;

      const range = getScentRange(tokenDocument.actor);
      const updateData = buildDetectionModeUpdateData("detectionModes", tokenDocument.detectionModes, range);
      if (!updateData) return false;

      try {
        await tokenDocument.update(updateData, { [moduleId]: { sync: true }, stopAuraUpdate: true });
      } catch (error) {
        if (isStaleTokenDocumentError(error) || !isLiveTokenDocument(tokenDocument)) return false;
        throw error;
      }
      return true;
    }

    async function persistPrototypeScentDetection(actor) {
      if (!game.user?.isGM || !actor?.update) return false;
      const guard = getActorSyncGuard(actor);
      if (!guard.allowed) return false;

      const range = getScentRange(actor);
      const currentModes = foundry.utils.getProperty(actor, "prototypeToken.detectionModes") ?? {};
      const updateData = buildDetectionModeUpdateData("prototypeToken.detectionModes", currentModes, range);
      if (!updateData) return false;

      await actor.update(updateData, { [moduleId]: { sync: true }, stopAuraUpdate: true });
      return true;
    }

    async function syncActorTokens(actor) {
      if (!actor || !["character", "npc"].includes(actor.type)) return;
      const guard = getActorSyncGuard(actor);
      if (!guard.allowed) {
        status.lastSync = {
          actorId: actor.id,
          actorName: actor.name,
          skipped: true,
          reason: guard.reason,
          range: getScentRange(actor),
        };
        refreshOverlay();
        queueScan();
        return;
      }

      if (game.user?.isGM) {
        await persistPrototypeScentDetection(actor);

        for (const token of actor.getActiveTokens?.(false) ?? []) {
          await persistTokenScentDetection(token.document);
        }
      }

      status.lastSync = {
        actorId: actor.id,
        actorName: actor.name,
        skipped: false,
        reason: "synced",
        range: getScentRange(actor),
      };
      refreshOverlay();
      queueScan();
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
          console.error(`${moduleId} | Failed to sync scent detection for ${actor.name}.`, error);
        }
      }

      refreshOverlay();
      queueScan();
    }

    const debouncedFlushActorSync = foundry.utils.debounce(flushActorSync, 100);

    function queueActorSync(actor) {
      if (!actor?.id) return;
      pendingActorSync.add(actor.id);
      debouncedFlushActorSync();
    }

    function patchTokenDocumentRefresh() {
      if (!isD35E()) {
        status.tokenRefreshPatch = { available: false, installed: false, reason: "not-d35e" };
        return;
      }

      const TokenDocumentClass = CONFIG.Token?.documentClass ?? globalThis.TokenDocument;
      if (!TokenDocumentClass?.prototype?.refreshDetectionModes) {
        console.warn(`${moduleId} | TokenDocument.refreshDetectionModes was not found; scent detection will rely on hooks only.`);
        status.tokenRefreshPatch = { available: false, installed: false, reason: "missing-refreshDetectionModes" };
        return;
      }

      if (TokenDocumentClass.prototype[tokenRefreshPatched] === true) {
        status.tokenRefreshPatch = { available: true, installed: true, reason: "already-installed" };
        return;
      }

      const original = TokenDocumentClass.prototype.refreshDetectionModes;
      Object.defineProperty(TokenDocumentClass.prototype, tokenRefreshOriginal, { value: original });

      TokenDocumentClass.prototype.refreshDetectionModes = function d35eScentSenseRefreshDetectionModes(...args) {
        const result = original.call(this, ...args);
        applyScentDetectionMode(this);
        return result;
      };

      Object.defineProperty(TokenDocumentClass.prototype, tokenRefreshPatched, { value: true });
      status.tokenRefreshPatch = { available: true, installed: true, reason: "installed" };
    }

    function getIntegrationStatus(actorOrToken = null) {
      const rangeBreakdown = actorOrToken && getScentRangeBreakdown
        ? getScentRangeBreakdown(actorOrToken)
        : null;

      return {
        isD35E: isD35E(),
        scentSenseRegistered: CONFIG.D35E?.senses?.scent !== undefined,
        detectionModeRegistered: CONFIG.Canvas?.detectionModes?.[detectionModeId] !== undefined,
        tokenRefreshPatch: { ...status.tokenRefreshPatch },
        lastSync: status.lastSync ? { ...status.lastSync } : null,
        rangeBreakdown,
      };
    }

    return Object.freeze({
      applyScentDetectionMode,
      buildDetectionModesWithScent,
      getActorSyncGuard,
      getIntegrationStatus,
      isLiveTokenDocument,
      patchTokenDocumentRefresh,
      queueActorSync,
      registerDetectionMode,
      registerScentSense,
      syncActorTokens,
    });
  }

  globalThis.d35eScentSenseD35EIntegration = Object.freeze({
    create: createD35EIntegrationRuntime,
  });
})();
