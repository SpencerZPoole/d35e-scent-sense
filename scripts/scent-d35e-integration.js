(() => {
  "use strict";

  function createD35EIntegrationRuntime({
    clone,
    detectionModeId,
    getScentRange,
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
        const modes = currentModes.map((mode) => ({ ...mode }));
        const index = modes.findIndex((mode) => mode.id === detectionModeId);

        if (scentMode) {
          if (index >= 0) {
            const existing = modes[index];
            if (existing.enabled === true && existing.range === scentMode.range) return { changed: false, modes: currentModes };
            modes[index] = { ...existing, ...scentMode, id: detectionModeId };
          } else {
            modes.push({ id: detectionModeId, ...scentMode });
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

      await tokenDocument.update(updateData, { [moduleId]: { sync: true }, stopAuraUpdate: true });
      return true;
    }

    async function persistPrototypeScentDetection(actor) {
      if (!game.user?.isGM || !actor?.update) return false;

      const range = getScentRange(actor);
      const currentModes = foundry.utils.getProperty(actor, "prototypeToken.detectionModes") ?? {};
      const updateData = buildDetectionModeUpdateData("prototypeToken.detectionModes", currentModes, range);
      if (!updateData) return false;

      await actor.update(updateData, { [moduleId]: { sync: true }, stopAuraUpdate: true });
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
      if (!isD35E()) return;

      const TokenDocumentClass = CONFIG.Token?.documentClass ?? globalThis.TokenDocument;
      if (!TokenDocumentClass?.prototype?.refreshDetectionModes) {
        console.warn(`${moduleId} | TokenDocument.refreshDetectionModes was not found; scent detection will rely on hooks only.`);
        return;
      }

      if (TokenDocumentClass.prototype[tokenRefreshPatched] === true) return;

      const original = TokenDocumentClass.prototype.refreshDetectionModes;
      Object.defineProperty(TokenDocumentClass.prototype, tokenRefreshOriginal, { value: original });

      TokenDocumentClass.prototype.refreshDetectionModes = function d35eScentSenseRefreshDetectionModes(...args) {
        const result = original.call(this, ...args);
        applyScentDetectionMode(this);
        return result;
      };

      Object.defineProperty(TokenDocumentClass.prototype, tokenRefreshPatched, { value: true });
    }

    return Object.freeze({
      applyScentDetectionMode,
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
