(() => {
  "use strict";

  function createOverlayRuntime({
    clone,
    getSetting,
    getScentRange,
    hasScent,
    localize,
    moduleId,
    positiveNumber,
    settings,
  } = {}) {
    let overlayContainer = null;
    let cueContainer = null;

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
      const value = getSetting(settings.OVERLAY_HIDDEN_ACTORS);
      return value && typeof value === "object" ? clone(value) : {};
    }

    function isOverlayVisible(actorOrToken) {
      if (getSetting(settings.OVERLAY_ENABLED) !== true) return false;

      const key = getOverlayKey(actorOrToken);
      if (!key) return true;

      const hidden = readOverlayHiddenActors();
      return hidden[key] !== true;
    }

    async function setOverlayVisible(actorOrToken, visible) {
      const key = getOverlayKey(actorOrToken);
      if (!key) return false;

      const hiddenActors = readOverlayHiddenActors();
      if (visible) delete hiddenActors[key];
      else hiddenActors[key] = true;

      await game.settings.set(moduleId, settings.OVERLAY_HIDDEN_ACTORS, hiddenActors);
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

      overlayContainer = canvas.tokens.getChildByName?.(`${moduleId}.overlay`) ?? new PIXI.Container();
      overlayContainer.name = `${moduleId}.overlay`;
      overlayContainer.eventMode = "none";
      overlayContainer.interactive = false;
      overlayContainer.sortableChildren = false;

      if (!overlayContainer.parent) canvas.tokens.addChildAt(overlayContainer, 0);
      return overlayContainer;
    }

    function getOrCreateCueContainer() {
      if (!canvas?.tokens) return null;
      if (cueContainer?.parent) return cueContainer;

      cueContainer = canvas.tokens.getChildByName?.(`${moduleId}.pinpointCue`) ?? new PIXI.Container();
      cueContainer.name = `${moduleId}.pinpointCue`;
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
      if (!canvas?.ready || !canvas?.tokens?.placeables) return;

      const container = getOrCreateOverlayContainer();
      if (!container) return;
      clearOverlay();

      for (const token of canvas.tokens.placeables) {
        if (!canCurrentUserSeeScentOverlay(token)) continue;

        const range = getScentRange(token.actor);
        if (range <= 0) continue;

        const radius = getSceneUnitsToPixels(range);
        if (!Number.isFinite(radius) || radius <= 0) continue;

        const graphic = new PIXI.Graphics();
        graphic.lineStyle(2, 0x6fac48, 0.9);
        graphic.drawCircle(token.center.x, token.center.y, radius);
        container.addChild(graphic);
      }
    }

    function showLocalPinpointCue(point) {
      if (!canvas?.ready || !point) return;

      const container = getOrCreateCueContainer();
      if (!container || !point) return;

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

    function renderTokenHudToggle(app, html) {
      const token = app?.object;
      if (!token?.actor || !hasScent(token.actor)) return;
      if (game.user?.isGM !== true && token.actor.testUserPermission?.(game.user, "OWNER") !== true) return;

      const root = html instanceof HTMLElement ? html : html?.[0];
      if (!root?.querySelector) return;

      const column = root.querySelector(".col.left") ?? root.querySelector(".col.right");
      if (!column || column.querySelector(`[data-action="${moduleId}.toggleOverlay"]`)) return;

      const control = document.createElement("div");
      control.classList.add("control-icon");
      control.dataset.action = `${moduleId}.toggleOverlay`;
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

    return Object.freeze({
      isOverlayVisible,
      refreshOverlay,
      renderTokenHudToggle,
      setOverlayVisible,
      showLocalPinpointCue,
    });
  }

  globalThis.d35eScentSenseOverlay = Object.freeze({
    create: createOverlayRuntime,
  });
})();
