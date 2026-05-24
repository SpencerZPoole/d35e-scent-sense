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
    isTrailOverlayVisible,
    localize,
    moduleId,
    setTrailOverlayVisible,
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

    function buildOdorOptions() {
      return [
        option("normal", localize("D35EScent.TrailManager.Odor.Normal")),
        option("strong", localize("D35EScent.TrailManager.Odor.Strong")),
        option("overpowering", localize("D35EScent.TrailManager.Odor.Overpowering")),
      ];
    }

    function buildWindOptions() {
      return [
        option("normal", localize("D35EScent.ContextManager.Wind.Normal")),
        option("upwind", localize("D35EScent.ContextManager.Wind.Upwind")),
        option("downwind", localize("D35EScent.ContextManager.Wind.Downwind")),
      ];
    }

    function getTokenById(tokenId) {
      return canvas?.tokens?.placeables?.find((token) => token.id === tokenId) ?? null;
    }

    function getDefaultSourceTokenId() {
      return canvas?.tokens?.controlled?.[0]?.id ?? canvas?.tokens?.placeables?.find((token) => token?.actor)?.id ?? "";
    }

    function getTokenName(tokenId) {
      const token = getTokenById(tokenId);
      return token?.name ?? tokenId ?? "";
    }

    function formatAge(hours) {
      if (!Number.isFinite(hours)) return "?";
      return `${Math.max(0, Math.floor(hours))} h`;
    }

    function formatSegmentState(trail) {
      const segments = trail.pathSegments ?? [];
      if (segments.length === 0) return localize("D35EScent.TrailManager.NoPathSegments");
      const newest = segments.reduce((latest, segment) => segment.createdWorldTime > latest.createdWorldTime ? segment : latest, segments[0]);
      const ageHours = Math.max(0, Math.floor(((game.time?.worldTime ?? newest.createdWorldTime) - newest.createdWorldTime) / 3600));
      if (ageHours >= 72) return localize("D35EScent.TrailManager.Fade.Faded");
      if (ageHours >= 48) return localize("D35EScent.TrailManager.Fade.Old");
      if (ageHours >= 24) return localize("D35EScent.TrailManager.Fade.Faint");
      if (ageHours >= 8) return localize("D35EScent.TrailManager.Fade.Stale");
      if (ageHours >= 1) return localize("D35EScent.TrailManager.Fade.Aging");
      return localize("D35EScent.TrailManager.Fade.Fresh");
    }

    function formatDc(dcResult) {
      if (!dcResult) return localize("D35EScent.TrailManager.NoPreview");
      if (dcResult.trackable === true) return format("D35EScent.TrailManager.DcPreview", { dc: dcResult.dc });
      return localize(`D35EScent.TrailManager.Reason.${dcResult.reason ?? "unknown"}`);
    }

    function formatReason(reason) {
      return localize(`D35EScent.TrailManager.Reason.${reason ?? "trackable"}`);
    }

    function stringifyTags(tags) {
      if (Array.isArray(tags)) return tags.join(", ");
      return String(tags ?? "");
    }

    function buildScentMenuData(selectedSourceTokenId = "") {
      const scene = canvas?.scene ?? null;
      const tokens = (canvas?.tokens?.placeables ?? []).filter((token) => token?.actor);
      const sourceTokenId = tokens.some((token) => token.id === selectedSourceTokenId) ? selectedSourceTokenId : getDefaultSourceTokenId();
      const sourceOptions = tokens
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((token) => {
          const range = getScentRange?.(token.actor) ?? 0;
          const label = range > 0
            ? format("D35EScent.TrailManager.SourceOption", { name: token.name, range })
            : token.name;
          return option(token.id, label);
        });

      const sources = getScentTrails(scene)
        .slice()
        .sort((a, b) => String(a.label).localeCompare(String(b.label)))
        .map((source) => {
          const dc = getScentTrailDc(source, null, { requireTracker: false });
          const sourceName = source.sourceName || getTokenName(source.sourceTokenId) || localize("D35EScent.TrailManager.UnknownSource");
          return {
            ...source,
            sourceName,
            sourceTokenId: source.sourceTokenId ?? "",
            age: formatAge(dc.trailAgeHours),
            dcLabel: formatDc(dc),
            dcReasonLabel: formatReason(dc.reason),
            odorDcModifier: source.odorDcModifier,
            odorStrength: source.odorProfile?.odorStrength ?? "normal",
            maskingOdor: String(source.odorProfile?.maskingOdor === true),
            falseOdor: String(source.odorProfile?.falseOdor === true),
            odorTags: stringifyTags(source.odorProfile?.odorTags),
            windBand: source.windBand ?? "normal",
            powerfulCompetingOdor: String(source.powerfulCompetingOdor === true),
            segmentSummary: format("D35EScent.TrailManager.PathSummary", {
              count: source.pathSegments?.length ?? 0,
              state: formatSegmentState(source),
            }),
          };
        });

      return {
        title: localize("D35EScent.TrailManager.Title"),
        sceneName: scene?.name ?? localize("D35EScent.TrailManager.NoScene"),
        selectedSourceTokenId: sourceTokenId,
        sourceOptions,
        waterOptions: buildWaterOptions(),
        booleanOptions: buildBooleanOptions(),
        odorOptions: buildOdorOptions(),
        windOptions: buildWindOptions(),
        sources,
        hasSources: sources.length > 0,
        hasSourceOptions: sourceOptions.length > 0,
        trailViewActive: isTrailOverlayVisible?.() === true,
        buttons: [{ type: "submit", label: localize("D35EScent.TrailManager.Save"), icon: "fa-solid fa-floppy-disk" }],
      };
    }

    function getValue(root, selector, fallback = "") {
      return root?.querySelector?.(selector)?.value ?? fallback;
    }

    function getChecked(root, selector) {
      return root?.querySelector?.(selector)?.checked === true;
    }

    function isTrailManagerOpen() {
      return Boolean(trailManager?.element?.parentElement);
    }

    async function refreshManager() {
      if (!isTrailManagerOpen()) return;
      await trailManager?.render?.(true);
    }

    async function setTrailViewVisible(visible) {
      setTrailOverlayVisible?.(visible === true);
      ui.controls?.render?.();
      await refreshManager();
      return isTrailOverlayVisible?.() === true;
    }

    function getRequestedTrailViewState(...args) {
      const current = isTrailOverlayVisible?.() === true;
      const cameFromUserEvent = args.some((value) => {
        if (!value || typeof value !== "object") return false;
        return (typeof Event !== "undefined" && value instanceof Event) || "currentTarget" in value || "target" in value;
      });

      for (const value of args) {
        if (typeof value === "boolean") {
          return cameFromUserEvent && value === current ? !current : value;
        }
        const targetChecked = value?.currentTarget?.checked ?? value?.target?.checked;
        if (typeof targetChecked === "boolean") {
          return cameFromUserEvent && targetChecked === current ? !current : targetChecked;
        }
      }

      return !current;
    }

    async function createSourceFromForm(root) {
      const sourceTokenId = getValue(root, '[name="new.sourceTokenId"]', trailManager?.sourceTokenId ?? "");
      const sourceToken = getTokenById(sourceTokenId);
      if (!sourceToken) return;

      await createScentTrail(canvas.scene, {
        sourceToken,
        label: getValue(root, '[name="new.label"]', ""),
        windBand: getValue(root, '[name="new.windBand"]', "normal"),
        odorProfile: {
          odorStrength: getValue(root, '[name="new.odorStrength"]', "normal"),
          maskingOdor: getValue(root, '[name="new.maskingOdor"]', "false"),
          falseOdor: getValue(root, '[name="new.falseOdor"]', "false"),
          odorTags: getValue(root, '[name="new.odorTags"]', ""),
        },
        waterState: getValue(root, '[name="new.waterState"]', "none"),
        powerfulCompetingOdor: getValue(root, '[name="new.powerfulCompetingOdor"]', "false"),
        odorDcModifier: getValue(root, '[name="new.odorDcModifier"]', "0"),
        recordMovement: getChecked(root, '[name="new.recordMovement"]'),
        visibleToPlayers: getChecked(root, '[name="new.visibleToPlayers"]'),
        sizeNotes: getValue(root, '[name="new.sizeNotes"]', ""),
        countNotes: getValue(root, '[name="new.countNotes"]', ""),
        notes: getValue(root, '[name="new.notes"]', ""),
      });
      ui.notifications?.info(localize("D35EScent.TrailManager.Created"));
      await refreshManager();
    }

    async function saveSourceRows(root) {
      for (const row of root.querySelectorAll("[data-scent-source-id]")) {
        const sourceId = row.dataset.scentSourceId;
        await updateScentTrail(canvas.scene, sourceId, {
          active: getChecked(row, '[data-field="active"]'),
          label: getValue(row, '[data-field="label"]', ""),
          sourceTokenId: getValue(row, '[data-field="sourceTokenId"]', ""),
          windBand: getValue(row, '[data-field="windBand"]', "normal"),
          odorProfile: {
            odorStrength: getValue(row, '[data-field="odorStrength"]', "normal"),
            maskingOdor: getValue(row, '[data-field="maskingOdor"]', "false"),
            falseOdor: getValue(row, '[data-field="falseOdor"]', "false"),
            odorTags: getValue(row, '[data-field="odorTags"]', ""),
          },
          waterState: getValue(row, '[data-field="waterState"]', "none"),
          powerfulCompetingOdor: getValue(row, '[data-field="powerfulCompetingOdor"]', "false"),
          odorDcModifier: getValue(row, '[data-field="odorDcModifier"]', "0"),
          recordMovement: getChecked(row, '[data-field="recordMovement"]'),
          visibleToPlayers: getChecked(row, '[data-field="visibleToPlayers"]'),
          sizeNotes: getValue(row, '[data-field="sizeNotes"]', ""),
          countNotes: getValue(row, '[data-field="countNotes"]', ""),
          notes: getValue(row, '[data-field="notes"]', ""),
        });
      }
      await refreshManager();
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
            width: 1180,
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
            scrollable: [".d35e-scent-trail-manager__sources"],
          },
          footer: {
            template: "templates/generic/form-footer.hbs",
          },
        };

        constructor(options = {}) {
          super(options);
          this.sourceTokenId = options.sourceTokenId ?? getDefaultSourceTokenId();
        }

        async _prepareContext(options = {}) {
          return {
            ...(await super._prepareContext(options)),
            ...buildScentMenuData(this.sourceTokenId),
          };
        }

        async _onRender(context, options) {
          await super._onRender(context, options);
          const root = this.element;
          if (!root?.querySelector) return;

          root.querySelector('[name="new.sourceTokenId"]')?.addEventListener("change", (event) => {
            this.sourceTokenId = event.currentTarget.value;
          });

          root.querySelector('[data-action="createTrail"]')?.addEventListener("click", (event) => {
            event.preventDefault();
            createSourceFromForm(root).catch((error) => console.error(`${moduleId} | Failed to create Scent source.`, error));
          });

          for (const button of root.querySelectorAll('[data-action="deleteTrail"]')) {
            button.addEventListener("click", (event) => {
              event.preventDefault();
              const sourceId = event.currentTarget.closest("[data-scent-source-id]")?.dataset?.scentSourceId;
              if (!window.confirm(localize("D35EScent.TrailManager.DeleteConfirm"))) return;
              deleteScentTrail(canvas.scene, sourceId)
                .then(refreshManager)
                .catch((error) => console.error(`${moduleId} | Failed to delete Scent source.`, error));
            });
          }

          root.querySelector('[data-action="toggleTrailView"]')?.addEventListener("click", (event) => {
            event.preventDefault();
            setTrailViewVisible(!(isTrailOverlayVisible?.() === true)).catch((error) => {
              console.error(`${moduleId} | Failed to toggle Scent trail preview.`, error);
            });
          });
        }

        _updatePosition(position) {
          if (!this.element?.parentElement) return position;
          return super._updatePosition(position);
        }

        async _onClose(options = {}) {
          await super._onClose?.(options);
          if (trailManager === this) trailManager = null;
        }

        static async _onSubmit(event, form) {
          event.preventDefault();
          const root = form instanceof HTMLElement ? form : trailManager?.element;
          if (root) await saveSourceRows(root);
        }
      };
    }

    function openTrailManager(options = {}) {
      if (game.user?.isGM !== true) {
        ui.notifications?.warn(localize("D35EScent.TrailManager.GmOnly"));
        return null;
      }

      if (isTrailManagerOpen()) {
        if (options.forceOpen === true) {
          trailManager.sourceTokenId = options.sourceTokenId ?? trailManager.sourceTokenId;
          trailManager.render?.(true);
          return trailManager;
        }

        const openManager = trailManager;
        trailManager = null;
        openManager.close?.();
        return null;
      }

      const TrailManager = getTrailManagerClass();
      if (!TrailManager) {
        ui.notifications?.warn(localize("D35EScent.TrailManager.Unavailable"));
        return null;
      }

      trailManager = new TrailManager({
        sourceTokenId: options.sourceTokenId ?? getDefaultSourceTokenId(),
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

      function upsertTool(toolData) {
        if (Array.isArray(tokenControl.tools)) {
          const existingIndex = tokenControl.tools.findIndex((tool) => tool.name === toolData.name);
          if (existingIndex >= 0) tokenControl.tools[existingIndex] = toolData;
          else tokenControl.tools.push(toolData);
          return;
        }

        tokenControl.tools[toolData.name] = toolData;
      }

      const toolData = {
        name: `${moduleId}-trail-manager`,
        order: 14,
        title: "D35EScent.TrailManager.Tool",
        icon: "fa-solid fa-gear",
        button: true,
        visible: true,
        onChange: () => openTrailManager(),
      };
      const viewToolData = {
        name: `${moduleId}-trail-view`,
        order: 15,
        title: "D35EScent.TrailManager.ViewTool",
        icon: "fa-solid fa-shoe-prints",
        toggle: true,
        active: isTrailOverlayVisible?.() === true,
        visible: true,
        onChange: (...args) => {
          setTrailViewVisible(getRequestedTrailViewState(...args)).catch((error) => {
            console.error(`${moduleId} | Failed to set Scent trail preview state.`, error);
          });
        },
      };

      upsertTool(toolData);
      upsertTool(viewToolData);
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
