(() => {
  "use strict";

  const MODULE_ID = "d35e-scent-sense";

  function createDetectionRuntime({
    getSetting,
    positiveNumber,
    settings,
  } = {}) {
    let wallCollisionWarningShown = false;

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
      const scope = getSetting(settings.TRIGGER_SCOPE);
      if (scope === "allCreatures") return true;
      if (scope === "allHostiles") return true;
      if (scope === "gmMarked") return isGmMarkedTarget(token);
      return isUnknownTarget(token);
    }

    function isScentOpponent(_sourceToken, targetToken) {
      const hostileDisposition = globalThis.CONST?.TOKEN_DISPOSITIONS?.HOSTILE;
      return hostileDisposition !== undefined && targetToken?.document?.disposition === hostileDisposition;
    }

    function shouldEvaluateScentTarget(sourceToken, targetToken) {
      if (!targetToken?.actor || targetToken.id === sourceToken?.id) return false;

      if (getSetting(settings.TRIGGER_SCOPE) !== "allCreatures" && !isScentOpponent(sourceToken, targetToken)) {
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
      const sceneDistance = positiveNumber(canvas?.scene?.grid?.distance, positiveNumber(canvas?.dimensions?.distance, 5));
      return pixelDistance / gridSize * sceneDistance;
    }

    function isWallBlocked(sourceToken, targetToken) {
      if (getSetting(settings.RESPECT_WALLS) !== true) return false;

      const source = sourceToken?.center;
      const target = targetToken?.center;
      if (!source || !target) return true;

      try {
        const backend = CONFIG.Canvas?.polygonBackends?.sight ?? canvas?.polygonBackends?.sight;
        if (typeof backend?.testCollision === "function") {
          return backend.testCollision(source, target, { type: "sight", mode: "any" }) === true;
        }
      } catch (error) {
        if (!wallCollisionWarningShown) {
          console.warn(`${MODULE_ID} | Could not test wall collision for Scent alerts; blocking alerts to avoid leaking hidden targets.`, error);
          wallCollisionWarningShown = true;
        }
        return true;
      }

      if (!wallCollisionWarningShown) {
        console.warn(`${MODULE_ID} | Wall collision API is unavailable for Scent alerts; blocking alerts to avoid leaking hidden targets.`);
        wallCollisionWarningShown = true;
      }
      return true;
    }

    return Object.freeze({
      isInvisibleActor,
      isScentOpponent,
      isUnknownTarget,
      isWallBlocked,
      measureTokenDistance,
      shouldEvaluateScentTarget,
      targetMatchesTriggerScope,
    });
  }

  globalThis.d35eScentSenseDetection = Object.freeze({
    create: createDetectionRuntime,
  });
})();
