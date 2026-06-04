(() => {
  "use strict";

  function createAlertRuntime({
    escapeHtml,
    format,
    getSetting,
    localize,
    moduleId,
    queueScan,
    randomId,
    rangeBands,
    roundDistance,
    settings,
    showLocalPinpointCue,
    socketName,
    socketTypes,
  } = {}) {
    let socketRegistered = false;
    let chatHookRegistered = false;

    const handledSocketMessages = new Set();
    const gmEventCache = new Map();
    const directionState = new Map();

    const DIRECTION_STATUSES = Object.freeze({
      NONE: "none",
      REQUESTED: "requested",
      REVEALED: "revealed",
    });

    const PRIVACY_AUDIENCES = Object.freeze({
      GM: "gm",
      OWNER_GM: "owner-gm",
    });

    function normalizeUserIds(userIds = []) {
      return Array.from(new Set(userIds.map((userId) => {
        if (typeof userId === "string") return userId;
        return userId?.id ?? userId?._id ?? null;
      }).filter(Boolean)));
    }

    function getUsers() {
      if (Array.isArray(game.users)) return game.users;
      if (typeof game.users?.filter === "function") return game.users.filter(() => true);
      return [];
    }

    function getUserById(userId) {
      if (!userId) return null;
      return game.users?.get?.(userId) ?? getUsers().find((user) => user.id === userId) ?? null;
    }

    function getAssignedActorId(user) {
      const character = user?.character;
      if (typeof character === "string") return character;
      return character?.id ?? character?._id ?? user?.characterId ?? user?.data?.character ?? user?.data?.characterId ?? null;
    }

    function isActiveGmUserId(userId) {
      const user = getUserById(userId);
      return user?.active === true && user?.isGM === true;
    }

    function getPrivacyFlags({ audience = PRIVACY_AUDIENCES.OWNER_GM, containsSecret = false, recipients = [] } = {}) {
      return {
        [moduleId]: {
          private: true,
          audience,
          containsSecret: containsSecret === true,
          recipients: normalizeUserIds(recipients),
        },
      };
    }

    function getMessageFlags(message) {
      if (typeof message?.getFlag === "function") {
        return {
          private: message.getFlag(moduleId, "private"),
          audience: message.getFlag(moduleId, "audience"),
          containsSecret: message.getFlag(moduleId, "containsSecret"),
        };
      }

      return message?.flags?.[moduleId] ?? message?._source?.flags?.[moduleId] ?? {};
    }

    function getMessageWhisperRecipients(message) {
      return normalizeUserIds(message?.whisper ?? message?._source?.whisper ?? message?.data?.whisper ?? []);
    }

    function isSecretAudience(audience, containsSecret) {
      return containsSecret === true || audience === PRIVACY_AUDIENCES.GM;
    }

    function validatePrivateChatData({ recipients, audience, containsSecret, reason = "Scent chat card" } = {}) {
      const whisper = normalizeUserIds(recipients);
      if (whisper.length === 0) {
        console.error(`${moduleId} | Refusing to create public ${reason}; no whisper recipients were provided.`);
        return false;
      }

      if (isSecretAudience(audience, containsSecret)) {
        const nonGmRecipient = whisper.find((userId) => !isActiveGmUserId(userId));
        if (nonGmRecipient) {
          console.error(`${moduleId} | Refusing to create secret ${reason}; non-GM recipient ${nonGmRecipient} was included.`);
          return false;
        }
      }

      return true;
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

      const actorId = token.actor.id ?? token.actor._id;
      const assignedUsers = game.users
        .filter((user) => user.active && !user.isGM && actorId && getAssignedActorId(user) === actorId)
        .map((user) => user.id);
      if (assignedUsers.length > 0) return assignedUsers;

      const nonGmOwners = game.users
        .filter((user) => user.active && !user.isGM && token.actor.testUserPermission?.(user, "OWNER") === true)
        .map((user) => user.id);
      if (nonGmOwners.length > 0) return nonGmOwners;

      if (game.user?.isGM === true && token.actor.testUserPermission?.(game.user, "OWNER") === true) return [game.user.id];
      return [];
    }

    function getOwnerAndGmRecipients(token) {
      return normalizeUserIds([...getActiveOwnerRecipients(token), ...getActiveGmIds()]);
    }

    function buildGmContextContent(detail) {
      if (!detail?.context) return "";
      const tags = Array.isArray(detail.context.odorTags) && detail.context.odorTags.length > 0
        ? detail.context.odorTags.join(", ")
        : "none";

      return `<p>${escapeHtml(format("D35EScent.Alert.GmContextDetail", {
        range: Number.isFinite(detail.effectiveRange) ? roundDistance(detail.effectiveRange) : "?",
        wind: detail.context.windBand ?? "normal",
        odor: detail.context.odorStrength ?? "normal",
        masking: detail.context.maskingOdor === true ? "yes" : "no",
        falseOdor: detail.context.falseOdor === true ? "yes" : "no",
        tags,
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

    function makeDirectionKey({ sceneId, sourceTokenId, targetTokenId } = {}) {
      if (!sceneId || !sourceTokenId || !targetTokenId) return null;
      return `${sceneId}|${sourceTokenId}|${targetTokenId}`;
    }

    function setDirectionStatus(detail, status) {
      const key = makeDirectionKey(detail);
      if (!key) return false;
      directionState.set(key, {
        status,
        eventId: detail.eventId,
        updatedAt: Date.now(),
      });
      return true;
    }

    function getDirectionStatus(detail) {
      const key = makeDirectionKey(detail);
      if (!key) return DIRECTION_STATUSES.NONE;
      return directionState.get(key)?.status ?? DIRECTION_STATUSES.NONE;
    }

    function dispatchSocketMessage(payload) {
      payload.id ??= randomId();
      game.socket?.emit(socketName, payload);

      if (payload.recipients?.includes(game.user?.id)) {
        handleSocketMessage(payload).catch((error) => console.error(`${moduleId} | Failed to handle local socket payload.`, error));
      }
    }

    async function createPrivateMessage(userIds, content, options = {}) {
      const recipients = normalizeUserIds(userIds);
      const audience = options.audience ?? PRIVACY_AUDIENCES.OWNER_GM;
      const containsSecret = options.containsSecret === true;
      if (!globalThis.ChatMessage?.create) return null;
      if (!validatePrivateChatData({ recipients, audience, containsSecret, reason: options.reason ?? "Scent chat card" })) return null;

      return ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ alias: "Scent" }),
        whisper: recipients,
        content,
        flags: getPrivacyFlags({ audience, containsSecret, recipients }),
      });
    }

    async function createGmWhisper(content) {
      return createPrivateMessage(getActiveGmIds(), content, {
        audience: PRIVACY_AUDIENCES.GM,
        containsSecret: true,
        reason: "GM-only Scent detail card",
      });
    }

    function getOwnerAlertRecipients(alert) {
      const recipients = normalizeUserIds(alert?.recipients ?? []);
      return recipients.length > 0 ? recipients : normalizeUserIds([game.user?.id]);
    }

    function isPrimaryOwnerAlertRecipient(alert) {
      const recipients = getOwnerAlertRecipients(alert);
      return recipients.length === 0 || recipients[0] === game.user?.id;
    }

    async function createOwnerWhisper(content, alert) {
      if (!isPrimaryOwnerAlertRecipient(alert)) return null;
      return createPrivateMessage([...getOwnerAlertRecipients(alert), ...getActiveGmIds()], content, {
        audience: PRIVACY_AUDIENCES.OWNER_GM,
        containsSecret: false,
        reason: "owner Scent alert card",
      });
    }

    function buildPresenceContent() {
      return `<p>${escapeHtml(localize("D35EScent.Alert.Presence"))}</p><p>${escapeHtml(localize("D35EScent.Alert.PresencePrompt"))}</p>`;
    }

    function buildPinpointContent() {
      return `<p>${escapeHtml(localize("D35EScent.Alert.Pinpoint"))}</p>`;
    }

    function buildDirectionRevealButton(eventId) {
      if (!eventId) return "";
      return `<p><button type="button" data-d35e-scent-action="direction-revealed" data-event-id="${escapeHtml(eventId)}">${escapeHtml(localize("D35EScent.Alert.GmDirectionRevealButton"))}</button></p>`;
    }

    async function sendMoveActionRequest(alert) {
      const payload = {
        id: randomId(),
        type: socketTypes.MOVE_ACTION_REQUEST,
        eventId: alert.eventId,
      };

      game.socket?.emit(socketName, payload);
      if (game.user?.isGM === true) await handleSocketMessage(payload);
    }

    async function showPresenceAlert(alert) {
      if (getSetting(settings.NOTIFICATION_MODE) === "chat") {
        await createOwnerWhisper(buildPresenceContent(), alert);
        return;
      }

      const DialogV2 = foundry.applications?.api?.DialogV2;
      if (!DialogV2?.confirm) {
        await createOwnerWhisper(buildPresenceContent(), alert);
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
      if (alert.point) showLocalPinpointCue(alert.point);

      if (getSetting(settings.NOTIFICATION_MODE) === "chat") {
        await createOwnerWhisper(buildPinpointContent(), alert);
        return;
      }

      const DialogV2 = foundry.applications?.api?.DialogV2;
      if (!DialogV2?.confirm) {
        await createOwnerWhisper(buildPinpointContent(), alert);
        return;
      }

      await DialogV2.confirm({
        window: { title: localize("D35EScent.Alert.Title") },
        content: buildPinpointContent(),
        yes: { label: localize("D35EScent.Alert.Ok") },
        no: { label: localize("D35EScent.Alert.Ignore") },
      });
    }

    async function handleMoveActionRequest(payload) {
      if (!isPrimaryActiveGm()) return;

      const detail = gmEventCache.get(payload.eventId);
      const actorName = escapeHtml(detail?.sourceName ?? "A token");
      const sceneName = escapeHtml(detail?.sceneName ?? canvas?.scene?.name ?? "the current scene");

      let content = `<p>${escapeHtml(format("D35EScent.Alert.GmDirectionRequest", { actor: actorName }))}</p>`;
      if (detail) {
        setDirectionStatus(detail, DIRECTION_STATUSES.REQUESTED);
        content += `<p>${escapeHtml(format("D35EScent.Alert.GmDirectionDetail", {
          actor: detail.sourceName,
          target: detail.targetName,
          distance: roundDistance(detail.distance),
          scene: sceneName,
        }))}</p>`;
        content += buildGmContextContent(detail);
        content += buildDirectionRevealButton(detail.eventId);
      }

      await createGmWhisper(content);
      queueScan();
    }

    async function handleDirectionRevealed(payload) {
      if (game.user?.isGM !== true) return;

      const detail = gmEventCache.get(payload.eventId);
      if (!detail) return;

      setDirectionStatus(detail, DIRECTION_STATUSES.REVEALED);
      queueScan();
    }

    async function requestDirectionReveal(eventId) {
      if (game.user?.isGM !== true || !eventId) return;

      const payload = {
        id: randomId(),
        type: socketTypes.DIRECTION_REVEALED,
        eventId,
      };

      game.socket?.emit(socketName, payload);
      await handleDirectionRevealed(payload);
    }

    function bindDirectionRevealButtons(html) {
      if (game.user?.isGM !== true) return;

      const root = html?.[0] ?? html;
      if (!root?.querySelectorAll) return;

      for (const button of root.querySelectorAll('[data-d35e-scent-action="direction-revealed"]')) {
        if (button.dataset.d35eScentBound === "true") continue;
        button.dataset.d35eScentBound = "true";

        button.addEventListener("click", async (event) => {
          event.preventDefault();
          const eventId = button.dataset.eventId;
          button.disabled = true;

          try {
            await requestDirectionReveal(eventId);
            button.textContent = localize("D35EScent.Alert.GmDirectionRevealMarked");
          } catch (error) {
            button.disabled = false;
            console.error(`${moduleId} | Failed to mark Scent direction as revealed.`, error);
          }
        });
      }
    }

    async function handleSocketMessage(payload) {
      if (!payload || typeof payload !== "object") return;

      if (payload.type === socketTypes.SCAN_REQUEST) {
        if (isPrimaryActiveGm()) queueScan();
        return;
      }

      if (payload.type === socketTypes.MOVE_ACTION_REQUEST) {
        await handleMoveActionRequest(payload);
        return;
      }

      if (payload.type === socketTypes.DIRECTION_REVEALED) {
        await handleDirectionRevealed(payload);
        return;
      }

      if (handledSocketMessages.has(payload.id)) return;
      handledSocketMessages.add(payload.id);
      if (handledSocketMessages.size > 500) handledSocketMessages.delete(handledSocketMessages.values().next().value);

      if (!payload.recipients?.includes(game.user?.id)) return;

      if (payload.type === socketTypes.PRESENCE_ALERT) await showPresenceAlert(payload);
      else if (payload.type === socketTypes.PINPOINT_ALERT) await showPinpointAlert(payload);
    }

    async function dispatchPresenceAlert({ scene, sourceToken, targetToken, distance, recipients, detection }) {
      const eventId = randomId();
      cacheGmEvent(eventId, {
        eventId,
        sceneId: scene.id,
        sceneName: scene.name,
        sourceTokenId: sourceToken.id,
        targetTokenId: targetToken.id,
        sourceActorId: sourceToken.actor?.id,
        targetActorId: targetToken.actor?.id,
        sourceName: sourceToken.name,
        targetName: targetToken.name,
        distance,
        effectiveRange: detection?.effectiveRange,
        context: detection?.context,
        state: detection?.state,
        band: detection?.notificationBand ?? detection?.band ?? rangeBands.PRESENCE,
      });

      await dispatchSocketMessage({
        type: socketTypes.PRESENCE_ALERT,
        eventId,
        recipients,
      });
    }

    async function dispatchPinpointAlert({ scene, sourceToken, targetToken, distance, recipients, detection }) {
      const eventId = randomId();
      const detail = {
        eventId,
        sceneId: scene.id,
        sceneName: scene.name,
        sourceTokenId: sourceToken.id,
        targetTokenId: targetToken.id,
        sourceActorId: sourceToken.actor?.id,
        targetActorId: targetToken.actor?.id,
        sourceName: sourceToken.name,
        targetName: targetToken.name,
        distance,
        effectiveRange: detection?.effectiveRange,
        context: detection?.context,
        state: detection?.state,
        band: detection?.notificationBand ?? detection?.band ?? rangeBands.PINPOINT,
      };
      cacheGmEvent(eventId, detail);

      await dispatchSocketMessage({
        type: socketTypes.PINPOINT_ALERT,
        eventId,
        recipients,
      });

      await createGmWhisper(
        `<p>${escapeHtml(format("D35EScent.Alert.GmPinpoint", {
          actor: detail.sourceName,
          target: detail.targetName,
          scene: detail.sceneName,
        }))}</p>${buildGmContextContent(detail)}`
      );
    }

    function registerSocket() {
      if (socketRegistered === true) return;
      if (!game.socket?.on) return;

      game.socket.on(socketName, (payload) => {
        handleSocketMessage(payload).catch((error) => console.error(`${moduleId} | Failed to handle socket payload.`, error));
      });

      socketRegistered = true;
    }

    function registerChatMessageHook() {
      if (chatHookRegistered === true) return;

      Hooks.on("preCreateChatMessage", (message) => {
        const flags = getMessageFlags(message);
        if (flags?.private !== true) return undefined;

        const recipients = getMessageWhisperRecipients(message);
        if (!validatePrivateChatData({
          recipients,
          audience: flags.audience,
          containsSecret: flags.containsSecret === true,
          reason: "module-flagged Scent chat card",
        })) {
          return false;
        }

        return undefined;
      });

      Hooks.on("renderChatMessageHTML", (message, html) => {
        const flags = getMessageFlags(message);
        if (flags?.private === true) {
          const recipients = getMessageWhisperRecipients(message);
          const allowed = recipients.includes(game.user?.id) || game.user?.isGM === true && isSecretAudience(flags.audience, flags.containsSecret);
          if (!allowed) {
            const root = html?.[0] ?? html;
            if (root?.remove) root.remove();
            else if (root?.style) root.style.display = "none";
            return;
          }
        }

        bindDirectionRevealButtons(html);
      });

      chatHookRegistered = true;
    }

    function reset() {
      handledSocketMessages.clear();
      gmEventCache.clear();
      directionState.clear();
    }

    return Object.freeze({
      dispatchPinpointAlert,
      dispatchPresenceAlert,
      createPrivateMessage,
      getActiveGmIds,
      getActiveOwnerRecipients,
      getOwnerAndGmRecipients,
      getDirectionStatus,
      handleSocketMessage,
      isPrimaryActiveGm,
      registerChatMessageHook,
      registerSocket,
      reset,
    });
  }

  globalThis.d35eScentSenseAlerts = Object.freeze({
    create: createAlertRuntime,
  });
})();
