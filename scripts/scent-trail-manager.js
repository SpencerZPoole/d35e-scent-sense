(() => {
  "use strict";

  function createTrailManagerRuntime({
    canTrackByScent,
    createScentTrail,
    deleteScentTrail,
    format,
    getScentRange,
    getScentTrailDc,
    getScentTrails,
    localize,
    moduleId,
    rollTrackByScent,
    roundDistance,
    template,
    updateScentTrail,
  } = {}) {
    let trailManager = null;

    function option(value, label) {
      return { value, label };
    }

    function buildWaterOptions() {
      return [
        option("none", localize("D35EScent.TrailManager.Water.None")),
        option("water", localize("D35EScent.TrailManager.Water.Water")),
        option("flowingWater", localize("D35EScent.TrailManager.Water.FlowingWater")),
      ];
    }

    function buildBooleanOptions() {
      return [
        option("false", localize("D35EScent.TrailManager.No")),
        option("true", localize("D35EScent.TrailManager.Yes")),
      ];
    }

    function getTokenById(tokenId) {
      return canvas?.tokens?.placeables?.find((token) => token.id === tokenId) ?? null;
    }

    function getDefaultSourceTokenId() {
      return canvas?.tokens?.controlled?.[0]?.id ?? canvas?.tokens?.placeables?.find((token) => token?.actor)?.id ?? "";
    }

    function getDefaultTrackerTokenId() {
      const controlled = canvas?.tokens?.controlled?.find((token) => getScentRange(token.actor) > 0 && canTrackByScent(token.actor));
      if (controlled) return controlled.id;

      return canvas?.tokens?.placeables?.find((token) => getScentRange(token.actor) > 0 && canTrackByScent(token.actor))?.id ?? "";
    }

    function formatAge(hours) {
      if (!Number.isFinite(hours)) return "?";
      return `${Math.max(0, Math.floor(hours))} h`;
    }

    function formatDc(dcResult) {
      if (!dcResult) return localize("D35EScent.TrailManager.NoPreview");
      if (dcResult.trackable === true) return format("D35EScent.TrailManager.DcPreview", { dc: dcResult.dc });
      return localize(`D35EScent.TrailManager.Reason.${dcResult.reason ?? "unknown"}`);
    }

    function formatProfile(profile = {}) {
      const tags = Array.isArray(profile.odorTags) && profile.odorTags.length > 0 ? profile.odorTags.join(", ") : localize("D35EScent.TrailManager.None");
      return format("D35EScent.TrailManager.ProfileSummary", {
        odor: profile.odorStrength ?? "normal",
        falseOdor: profile.falseOdor === true ? localize("D35EScent.TrailManager.Yes") : localize("D35EScent.TrailManager.No"),
        tags,
      });
    }

    function buildTrailManagerData(selectedSourceTokenId = "", selectedTrackerTokenId = "") {
      const scene = canvas?.scene ?? null;
      const tokens = (canvas?.tokens?.placeables ?? []).filter((token) => token?.actor);
      const sourceTokenId = tokens.some((token) => token.id === selectedSourceTokenId) ? selectedSourceTokenId : getDefaultSourceTokenId();
      const trackerTokenId = tokens.some((token) => token.id === selectedTrackerTokenId) ? selectedTrackerTokenId : getDefaultTrackerTokenId();
      const trackerToken = trackerTokenId ? getTokenById(trackerTokenId) : null;
      const trails = getScentTrails(scene);

      const sourceOptions = tokens
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((token) => option(token.id, token.name));
      const trackerOptions = [
        option("", localize("D35EScent.TrailManager.NoTracker")),
        ...tokens
          .filter((token) => getScentRange(token.actor) > 0)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
          .map((token) => {
            const label = canTrackByScent(token.actor)
              ? format("D35EScent.TrailManager.TrackerOption", { name: token.name, range: getScentRange(token.actor) })
              : format("D35EScent.TrailManager.TrackerOptionNoTrack", { name: token.name, range: getScentRange(token.actor) });
            return option(token.id, label);
          }),
      ];

      const rows = trails
        .slice()
        .sort((a, b) => String(a.label).localeCompare(String(b.label)))
        .map((trail) => {
          const dc = getScentTrailDc(trail, trackerToken, { requireTracker: Boolean(trackerToken) });
          return {
            ...trail,
            age: formatAge(dc.trailAgeHours),
            dcLabel: formatDc(dc),
            dcReason: dc.reason,
            odorDcModifier: trail.odorDcModifier,
            powerfulCompetingOdor: String(trail.powerfulCompetingOdor === true),
            sourceLabel: trail.sourceName || trail.sourceTokenId || localize("D35EScent.TrailManager.UnknownSource"),
            profileSummary: formatProfile(trail.odorProfile),
            canPrompt: Boolean(trackerToken && dc.trackable === true),
          };
        });

      return {
        title: localize("D35EScent.TrailManager.Title"),
        sceneName: scene?.name ?? localize("D35EScent.TrailManager.NoScene"),
        selectedSourceTokenId: sourceTokenId,
        selectedTrackerTokenId: trackerTokenId,
        sourceOptions,
        trackerOptions,
        waterOptions: buildWaterOptions(),
        booleanOptions: buildBooleanOptions(),
        trails: rows,
        hasTrails: rows.length > 0,
        hasSourceOptions: sourceOptions.length > 0,
        buttons: [{ type: "submit", label: localize("D35EScent.TrailManager.Save"), icon: "fa-solid fa-floppy-disk" }],
      };
    }

    function getValue(root, selector, fallback = "") {
      return root?.querySelector?.(selector)?.value ?? fallback;
    }

    function getChecked(root, selector) {
      return root?.querySelector?.(selector)?.checked === true;
    }

    async function refreshManager() {
      await trailManager?.render?.(true);
    }

    async function createTrailFromForm(root) {
      const sourceTokenId = getValue(root, '[name="new.sourceTokenId"]', trailManager?.sourceTokenId ?? "");
      const sourceToken = getTokenById(sourceTokenId);
      if (!sourceToken) return;

      await createScentTrail(canvas.scene, {
        sourceToken,
        label: getValue(root, '[name="new.label"]', ""),
        waterState: getValue(root, '[name="new.waterState"]', "none"),
        powerfulCompetingOdor: getValue(root, '[name="new.powerfulCompetingOdor"]', "false"),
        odorDcModifier: getValue(root, '[name="new.odorDcModifier"]', "0"),
        sizeNotes: getValue(root, '[name="new.sizeNotes"]', ""),
        countNotes: getValue(root, '[name="new.countNotes"]', ""),
        notes: getValue(root, '[name="new.notes"]', ""),
      });
      await refreshManager();
    }

    async function saveTrailRows(root) {
      for (const row of root.querySelectorAll("[data-scent-trail-id]")) {
        const trailId = row.dataset.scentTrailId;
        await updateScentTrail(canvas.scene, trailId, {
          active: getChecked(row, '[data-field="active"]'),
          label: getValue(row, '[data-field="label"]', ""),
          waterState: getValue(row, '[data-field="waterState"]', "none"),
          powerfulCompetingOdor: getValue(row, '[data-field="powerfulCompetingOdor"]', "false"),
          odorDcModifier: getValue(row, '[data-field="odorDcModifier"]', "0"),
          sizeNotes: getValue(row, '[data-field="sizeNotes"]', ""),
          countNotes: getValue(row, '[data-field="countNotes"]', ""),
          notes: getValue(row, '[data-field="notes"]', ""),
        });
      }
      await refreshManager();
    }

    async function promptTrailRoll(trailId) {
      const trackerTokenId = trailManager?.trackerTokenId ?? "";
      const trackerToken = trackerTokenId ? getTokenById(trackerTokenId) : null;
      if (!trackerToken) {
        ui.notifications?.warn(localize("D35EScent.TrailManager.NoTrackerSelected"));
        return;
      }

      const result = await rollTrackByScent(trackerToken, trailId, { scene: canvas.scene });
      if (result?.promptCreated) ui.notifications?.info(localize("D35EScent.TrailManager.RollPromptCreated"));
      else if (result?.rolled) ui.notifications?.info(localize("D35EScent.TrailManager.RollStarted"));
      else ui.notifications?.warn(localize(`D35EScent.TrailManager.Reason.${result?.reason ?? "unknown"}`));
    }

    function getTrailManagerClass() {
      const ApplicationV2 = foundry.applications?.api?.ApplicationV2;
      const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;
      if (!ApplicationV2 || !HandlebarsApplicationMixin) return null;

      const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

      return class ScentTrailManagerApplication extends HandlebarsApplication {
        static DEFAULT_OPTIONS = {
          id: `${moduleId}-trail-manager`,
          tag: "form",
          classes: ["standard-form", "d35e-scent-trail-manager"],
          window: {
            title: "D35EScent.TrailManager.Title",
            resizable: true,
          },
          position: {
            width: 1100,
          },
          form: {
            submitOnChange: false,
            closeOnSubmit: false,
            handler: this._onSubmit,
          },
        };

        static PARTS = {
          form: {
            template,
            scrollable: [".d35e-scent-trail-manager__trails"],
          },
          footer: {
            template: "templates/generic/form-footer.hbs",
          },
        };

        constructor(options = {}) {
          super(options);
          this.sourceTokenId = options.sourceTokenId ?? getDefaultSourceTokenId();
          this.trackerTokenId = options.trackerTokenId ?? getDefaultTrackerTokenId();
        }

        async _prepareContext(options = {}) {
          return {
            ...(await super._prepareContext(options)),
            ...buildTrailManagerData(this.sourceTokenId, this.trackerTokenId),
          };
        }

        async _onRender(context, options) {
          await super._onRender(context, options);
          const root = this.element;
          if (!root?.querySelector) return;

          root.querySelector('[name="new.sourceTokenId"]')?.addEventListener("change", (event) => {
            this.sourceTokenId = event.currentTarget.value;
          });

          root.querySelector('[name="trackerTokenId"]')?.addEventListener("change", (event) => {
            this.trackerTokenId = event.currentTarget.value;
            this.render(true);
          });

          root.querySelector('[data-action="createTrail"]')?.addEventListener("click", (event) => {
            event.preventDefault();
            createTrailFromForm(root).catch((error) => console.error(`${moduleId} | Failed to create Scent trail.`, error));
          });

          for (const button of root.querySelectorAll('[data-action="deleteTrail"]')) {
            button.addEventListener("click", (event) => {
              event.preventDefault();
              const trailId = event.currentTarget.closest("[data-scent-trail-id]")?.dataset?.scentTrailId;
              deleteScentTrail(canvas.scene, trailId)
                .then(refreshManager)
                .catch((error) => console.error(`${moduleId} | Failed to delete Scent trail.`, error));
            });
          }

          for (const button of root.querySelectorAll('[data-action="promptTrailRoll"]')) {
            button.addEventListener("click", (event) => {
              event.preventDefault();
              const trailId = event.currentTarget.closest("[data-scent-trail-id]")?.dataset?.scentTrailId;
              promptTrailRoll(trailId).catch((error) => console.error(`${moduleId} | Failed to prompt Scent tracking roll.`, error));
            });
          }
        }

        _updatePosition(position) {
          if (!this.element?.parentElement) return position;
          return super._updatePosition(position);
        }

        static async _onSubmit(event, form) {
          event.preventDefault();
          const root = form instanceof HTMLElement ? form : trailManager?.element;
          if (root) await saveTrailRows(root);
        }
      };
    }

    function openTrailManager(options = {}) {
      if (game.user?.isGM !== true) {
        ui.notifications?.warn(localize("D35EScent.TrailManager.GmOnly"));
        return null;
      }

      const TrailManager = getTrailManagerClass();
      if (!TrailManager) {
        ui.notifications?.warn(localize("D35EScent.TrailManager.Unavailable"));
        return null;
      }

      trailManager = new TrailManager({
        sourceTokenId: options.sourceTokenId ?? getDefaultSourceTokenId(),
        trackerTokenId: options.trackerTokenId ?? getDefaultTrackerTokenId(),
      });
      trailManager.render(true);
      return trailManager;
    }

    function registerTrailManagerTool(controls) {
      if (game.user?.isGM !== true) return;

      const tokenControl = Array.isArray(controls)
        ? controls.find((control) => control.name === "token" || control.name === "tokens")
        : controls.tokens;
      if (!tokenControl?.tools) return;

      const toolData = {
        name: `${moduleId}-trail-manager`,
        order: 14,
        title: "D35EScent.TrailManager.Tool",
        icon: "fa-solid fa-shoe-prints",
        button: true,
        visible: true,
        onClick: () => openTrailManager(),
        onChange: () => openTrailManager(),
      };

      if (Array.isArray(tokenControl.tools)) {
        if (!tokenControl.tools.some((tool) => tool.name === `${moduleId}-trail-manager`)) tokenControl.tools.push(toolData);
      } else if (!tokenControl.tools[`${moduleId}-trail-manager`]) {
        tokenControl.tools[`${moduleId}-trail-manager`] = toolData;
      }
    }

    return Object.freeze({
      openTrailManager,
      registerTrailManagerTool,
    });
  }

  globalThis.d35eScentSenseTrailManager = Object.freeze({
    create: createTrailManagerRuntime,
  });
})();
