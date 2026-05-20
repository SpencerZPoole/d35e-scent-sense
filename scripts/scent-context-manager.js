(() => {
  "use strict";

  function createContextManagerRuntime({
    evaluateScentDetection,
    format,
    getContextApi,
    getScentContext,
    getScentRange,
    localize,
    measureTokenDistance,
    moduleId,
    refreshOverlay,
    resetNotificationState,
    roundDistance,
    setScentContextFlags,
    template,
  } = {}) {
    let contextManager = null;

    function option(value, label) {
      return { value, label };
    }

    function buildContextOptions() {
      return {
        wind: [
          option("inherit", localize("D35EScent.ContextManager.Inherit")),
          option("normal", localize("D35EScent.ContextManager.Wind.Normal")),
          option("upwind", localize("D35EScent.ContextManager.Wind.Upwind")),
          option("downwind", localize("D35EScent.ContextManager.Wind.Downwind")),
        ],
        odor: [
          option("inherit", localize("D35EScent.ContextManager.Inherit")),
          option("normal", localize("D35EScent.ContextManager.Odor.Normal")),
          option("strong", localize("D35EScent.ContextManager.Odor.Strong")),
          option("overpowering", localize("D35EScent.ContextManager.Odor.Overpowering")),
        ],
        masking: [
          option("inherit", localize("D35EScent.ContextManager.Inherit")),
          option("false", localize("D35EScent.ContextManager.No")),
          option("true", localize("D35EScent.ContextManager.Yes")),
        ],
      };
    }

    function contextSelection(document, key) {
      const contextApi = getContextApi();
      const value = contextApi?.readFlag?.(document, key);
      if (value === undefined) return "inherit";
      return String(contextApi?.normalizeFlagValue?.(key, value) ?? value);
    }

    function getDefaultSourceTokenId() {
      const controlled = canvas?.tokens?.controlled?.find((token) => getScentRange(token.actor) > 0);
      if (controlled) return controlled.id;

      return canvas?.tokens?.placeables?.find((token) => getScentRange(token.actor) > 0)?.id ?? "";
    }

    function getTokenById(tokenId) {
      return canvas?.tokens?.placeables?.find((token) => token.id === tokenId) ?? null;
    }

    function formatContextSource(source) {
      return localize(`D35EScent.ContextManager.Source.${source ?? "default"}`);
    }

    function formatDetectionPreview(detection) {
      if (!detection) return localize("D35EScent.ContextManager.NoPreview");
      if (detection.detectable === true && detection.pinpoint === true) return localize("D35EScent.ContextManager.Preview.Pinpoint");
      if (detection.detectable === true) return localize("D35EScent.ContextManager.Preview.Detectable");
      return localize("D35EScent.ContextManager.Preview.OutOfRange");
    }

    function buildContextManagerData(selectedSourceTokenId = "") {
      const scene = canvas?.scene ?? null;
      const tokens = (canvas?.tokens?.placeables ?? []).filter((token) => token?.actor);
      const sourceOptions = [
        option("", localize("D35EScent.ContextManager.NoPreview")),
        ...tokens
          .filter((token) => getScentRange(token.actor) > 0)
          .map((token) => option(token.id, `${token.name} (${getScentRange(token.actor)} ft)`)),
      ];

      const sourceTokenId = sourceOptions.some((entry) => entry.value === selectedSourceTokenId)
        ? selectedSourceTokenId
        : getDefaultSourceTokenId();
      const sourceToken = sourceTokenId ? getTokenById(sourceTokenId) : null;
      const sourceRange = getScentRange(sourceToken?.actor);
      const options = buildContextOptions();

      const rows = tokens
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((token) => {
          const document = token.document;
          const range = getScentRange(token.actor);
          const scentContext = getScentContext(sourceToken, token, { scene });
          const relevant = getContextApi()?.readFlag?.(document, "scentRelevant") === true;
          const detection = sourceToken && sourceToken.id !== token.id && sourceRange > 0
            ? evaluateScentDetection(sourceToken, token, { baseRange: sourceRange, distance: measureTokenDistance(sourceToken, token), scene })
            : null;

          return {
            id: token.id,
            name: token.name,
            actorName: token.actor?.name ?? token.name,
            range,
            sourceStatus: range > 0 ? format("D35EScent.ContextManager.SourceStatus", { range }) : localize("D35EScent.ContextManager.NotSource"),
            windBand: contextSelection(document, "windBand"),
            odorStrength: contextSelection(document, "odorStrength"),
            maskingOdor: contextSelection(document, "maskingOdor"),
            scentRelevant: relevant,
            effectiveWind: scentContext.context.windBand,
            effectiveOdor: scentContext.context.odorStrength,
            effectiveMasking: scentContext.context.maskingOdor ? localize("D35EScent.ContextManager.Yes") : localize("D35EScent.ContextManager.No"),
            sourceSummary: format("D35EScent.ContextManager.SourceSummary", {
              wind: formatContextSource(scentContext.sources.windBand),
              odor: formatContextSource(scentContext.sources.odorStrength),
              masking: formatContextSource(scentContext.sources.maskingOdor),
            }),
            preview: detection ? {
              label: formatDetectionPreview(detection),
              distance: Number.isFinite(detection.distance) ? roundDistance(detection.distance) : "?",
              effectiveRange: Number.isFinite(detection.effectiveRange) ? roundDistance(detection.effectiveRange) : "?",
            } : null,
          };
        });

      return {
        title: localize("D35EScent.ContextManager.Title"),
        sceneName: scene?.name ?? localize("D35EScent.ContextManager.NoScene"),
        scene: {
          windBand: contextSelection(scene, "windBand"),
          odorStrength: contextSelection(scene, "odorStrength"),
          maskingOdor: contextSelection(scene, "maskingOdor"),
        },
        sourceTokenId,
        sourceOptions,
        options,
        tokens: rows,
        hasTokens: rows.length > 0,
        buttons: [{ type: "submit", label: localize("D35EScent.ContextManager.Save"), icon: "fa-solid fa-floppy-disk" }],
      };
    }

    function getSelectValue(root, selector) {
      return root?.querySelector?.(selector)?.value ?? "inherit";
    }

    async function afterContextManagerWrite() {
      resetNotificationState({ scan: true });
      refreshOverlay();
      await contextManager?.render?.(true);
    }

    async function clearSceneContextFlags() {
      if (!canvas?.scene) return;
      await setScentContextFlags(canvas.scene, { windBand: "inherit", odorStrength: "inherit", maskingOdor: "inherit" }, { token: false, refresh: false });
      await afterContextManagerWrite();
    }

    async function clearTokenContextFlags(tokenId) {
      const token = getTokenById(tokenId);
      if (!token?.document) return;
      await setScentContextFlags(token.document, {
        windBand: "inherit",
        odorStrength: "inherit",
        maskingOdor: "inherit",
        scentRelevant: "inherit",
      }, { token: true, refresh: false });
      await afterContextManagerWrite();
    }

    async function saveContextManagerForm(form) {
      const root = form instanceof HTMLElement ? form : contextManager?.element;
      if (!root) return;

      const scene = canvas?.scene;
      if (scene) {
        await setScentContextFlags(scene, {
          windBand: getSelectValue(root, '[name="scene.windBand"]'),
          odorStrength: getSelectValue(root, '[name="scene.odorStrength"]'),
          maskingOdor: getSelectValue(root, '[name="scene.maskingOdor"]'),
        }, { token: false, refresh: false });
      }

      for (const row of root.querySelectorAll("[data-scent-token-id]")) {
        const token = getTokenById(row.dataset.scentTokenId);
        if (!token?.document) continue;

        await setScentContextFlags(token.document, {
          windBand: row.querySelector('[data-field="windBand"]')?.value ?? "inherit",
          odorStrength: row.querySelector('[data-field="odorStrength"]')?.value ?? "inherit",
          maskingOdor: row.querySelector('[data-field="maskingOdor"]')?.value ?? "inherit",
          scentRelevant: row.querySelector('[data-field="scentRelevant"]')?.checked === true,
        }, { token: true, refresh: false });
      }

      await afterContextManagerWrite();
    }

    function getContextManagerClass() {
      const ApplicationV2 = foundry.applications?.api?.ApplicationV2;
      const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;
      if (!ApplicationV2 || !HandlebarsApplicationMixin) return null;

      const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

      return class ScentContextManagerApplication extends HandlebarsApplication {
        static DEFAULT_OPTIONS = {
          id: `${moduleId}-context-manager`,
          tag: "form",
          classes: ["standard-form", "d35e-scent-context-manager"],
          window: {
            title: "D35EScent.ContextManager.Title",
            resizable: true,
          },
          position: {
            width: 860,
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
            scrollable: [".d35e-scent-context-manager__tokens"],
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
            ...buildContextManagerData(this.sourceTokenId),
          };
        }

        async _onRender(context, options) {
          await super._onRender(context, options);
          const root = this.element;
          if (!root?.querySelector) return;

          root.querySelector('[name="sourceTokenId"]')?.addEventListener("change", (event) => {
            this.sourceTokenId = event.currentTarget.value;
            this.render(true);
          });

          root.querySelector('[data-action="clearSceneContext"]')?.addEventListener("click", (event) => {
            event.preventDefault();
            clearSceneContextFlags().catch((error) => console.error(`${moduleId} | Failed to clear scene Scent context.`, error));
          });

          for (const button of root.querySelectorAll("[data-action='clearTokenContext']")) {
            button.addEventListener("click", (event) => {
              event.preventDefault();
              clearTokenContextFlags(event.currentTarget.closest("[data-scent-token-id]")?.dataset?.scentTokenId)
                .catch((error) => console.error(`${moduleId} | Failed to clear token Scent context.`, error));
            });
          }
        }

        _updatePosition(position) {
          if (!this.element?.parentElement) return position;
          return super._updatePosition(position);
        }

        static async _onSubmit(event, form) {
          event.preventDefault();
          await saveContextManagerForm(form);
        }
      };
    }

    function openContextManager(options = {}) {
      if (game.user?.isGM !== true) {
        ui.notifications?.warn(localize("D35EScent.ContextManager.GmOnly"));
        return null;
      }

      const ContextManager = getContextManagerClass();
      if (!ContextManager) {
        ui.notifications?.warn(localize("D35EScent.ContextManager.Unavailable"));
        return null;
      }

      contextManager = new ContextManager({ sourceTokenId: options.sourceTokenId ?? getDefaultSourceTokenId() });
      contextManager.render(true);
      return contextManager;
    }

    function registerContextManagerTool(controls) {
      if (game.user?.isGM !== true) return;

      const tokenControl = Array.isArray(controls)
        ? controls.find((control) => control.name === "token" || control.name === "tokens")
        : controls.tokens;
      if (!tokenControl?.tools) return;

      const toolData = {
        name: `${moduleId}-context-manager`,
        order: 13,
        title: "D35EScent.ContextManager.Tool",
        icon: "fa-solid fa-wind",
        button: true,
        visible: true,
        onClick: () => openContextManager(),
        onChange: () => openContextManager(),
      };

      if (Array.isArray(tokenControl.tools)) {
        if (!tokenControl.tools.some((tool) => tool.name === `${moduleId}-context-manager`)) tokenControl.tools.push(toolData);
      } else if (!tokenControl.tools[`${moduleId}-context-manager`]) {
        tokenControl.tools[`${moduleId}-context-manager`] = toolData;
      }
    }

    return Object.freeze({
      openContextManager,
      registerContextManagerTool,
    });
  }

  globalThis.d35eScentSenseContextManager = Object.freeze({
    create: createContextManagerRuntime,
  });
})();
