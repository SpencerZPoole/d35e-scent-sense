import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

globalThis.game = {
  user: { isGM: true },
  time: { worldTime: 0 },
};
globalThis.HTMLElement = Object;
globalThis.ui = {
  controls: {
    renderCount: 0,
    render() {
      this.renderCount += 1;
    },
  },
  notifications: {
    info() {},
    warn() {},
  },
};
globalThis.canvas = {
  scene: {},
  tokens: {
    controlled: [],
    placeables: [],
  },
};
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {
        constructor() {
          this.element = null;
          this.renderCount = 0;
          this.closeCount = 0;
        }

        render() {
          this.renderCount += 1;
          this.element = { parentElement: {} };
          return this;
        }

        async close() {
          this.closeCount += 1;
          this.element = null;
          await this._onClose?.({});
        }

        async _onRender() {}
      },
      HandlebarsApplicationMixin: (Base) => Base,
    },
  },
};

await import(pathToFileURL(path.join(root, "scripts/scent-trail-manager.js")).href);

const trailManager = globalThis.d35eScentSenseTrailManager;
assert.ok(trailManager, "scent trail manager API should be exposed on globalThis");

const template = readFileSync(path.join(root, "templates/scent-trail-manager.hbs"), "utf8");
assert.ok(template.includes("CreateHeading"), "template should include the create source section");
assert.ok(template.includes("SceneSources"), "template should include the scene sources section");
assert.ok(template.includes("AdvancedSourceDetails"), "template should keep low-frequency GM helper data behind advanced details");
assert.ok(!template.includes("TrackingPreview"), "tracking preview section should be removed");
assert.ok(!template.includes("trackerTokenId"), "tracker selector should be removed");
assert.ok(!template.includes("focusOverrides"), "override jump button should be removed");
assert.ok(!template.includes("data-scent-token-id"), "all-token override table should be removed");
assert.ok(!template.includes("promptTrailRoll"), "roll prompt button should be hidden from the source table");

let trailOverlayVisible = false;
const createdSources = [];
const updatedSources = [];
const setTrailOverlayCalls = [];
const runtime = trailManager.create({
  canTrackByScent: () => true,
  createScentTrail: async (_scene, data) => {
    createdSources.push(data);
  },
  deleteScentTrail: async () => {},
  format: (_key, data = {}) => JSON.stringify(data),
  getScentRange: () => 30,
  getScentTrailDc: () => ({ trackable: true, dc: 10, reason: "trackable", trailAgeHours: 0 }),
  getScentTrails: () => [],
  isTrailOverlayVisible: () => trailOverlayVisible,
  localize: (key) => key,
  moduleId: "d35e-scent-sense",
  setTrailOverlayVisible: (visible) => {
    trailOverlayVisible = visible === true;
    setTrailOverlayCalls.push(trailOverlayVisible);
    return trailOverlayVisible;
  },
  template: "unused",
  updateScentTrail: async (_scene, sourceId, data) => {
    updatedSources.push({ sourceId, data });
  },
});

const controls = [{ name: "token", tools: [{ name: "d35e-scent-sense-trail-view", onClick: () => {}, button: true }] }];
runtime.registerTrailManagerTool(controls);

let viewTool = controls[0].tools.find((tool) => tool.name === "d35e-scent-sense-trail-view");
const menuTool = controls[0].tools.find((tool) => tool.name === "d35e-scent-sense-trail-manager");
assert.ok(viewTool, "view scent trails tool should be registered");
assert.ok(menuTool, "scent menu tool should be registered");
assert.equal(viewTool.active, false);
assert.equal(typeof viewTool.onClick, "undefined", "view tool should replace stale onClick handlers");
assert.equal(typeof viewTool.button, "undefined", "view tool should replace stale button state");
assert.equal(typeof menuTool.onClick, "undefined", "scent menu tool should use the current Foundry control callback");
assert.equal(typeof menuTool.onChange, "function", "scent menu tool should open from its own control callback");

viewTool.onChange(true);
assert.equal(trailOverlayVisible, true, "toolbar onChange(true) should show trail overlay");

viewTool.onChange(true);
assert.equal(trailOverlayVisible, true, "repeated toolbar onChange(true) should not double-toggle off");

runtime.registerTrailManagerTool(controls);
viewTool = controls[0].tools.find((tool) => tool.name === "d35e-scent-sense-trail-view");
assert.equal(viewTool.active, true, "toolbar active state should be refreshed from overlay visibility");

viewTool.onChange(false);
assert.equal(trailOverlayVisible, false, "toolbar onChange(false) should hide trail overlay");

viewTool.onChange({ currentTarget: { checked: true } });
assert.equal(trailOverlayVisible, true, "toolbar event checked state should show trail overlay");

viewTool.onChange({ currentTarget: { checked: false } });
assert.equal(trailOverlayVisible, false, "toolbar event checked state should hide trail overlay");

viewTool.onChange({ currentTarget: { checked: false } }, false);
assert.equal(trailOverlayVisible, true, "toolbar click should recover when Foundry passes a stale false state while the overlay is hidden");

viewTool.onChange({ currentTarget: { checked: true } }, true);
assert.equal(trailOverlayVisible, false, "toolbar click should recover when Foundry passes a stale true state while the overlay is visible");

viewTool.onChange();
assert.equal(trailOverlayVisible, true, "toolbar without explicit state should fall back to a single toggle");
assert.equal(ui.controls.renderCount, 8, "trail view changes should ask Foundry controls to redraw");

runtime.registerTrailManagerTool(controls);
viewTool = controls[0].tools.find((tool) => tool.name === "d35e-scent-sense-trail-view");
assert.equal(viewTool.active, true, "menu-driven overlay changes should be reflected on controls render");

const openedManager = menuTool.onChange();
assert.ok(openedManager, "scent menu tool should open the manager when closed");
assert.equal(openedManager.renderCount, 1);

viewTool.onChange(false);
assert.equal(openedManager.renderCount, 2, "view toggle should refresh an open scent menu");

const forcedOpenManager = runtime.openTrailManager({ forceOpen: true, sourceTokenId: "source-token" });
assert.equal(forcedOpenManager, openedManager, "legacy context API path should focus an open unified menu instead of closing it");
assert.equal(forcedOpenManager.sourceTokenId, "source-token");

const toggleClosedResult = menuTool.onChange();
assert.equal(toggleClosedResult, null, "scent menu tool should close the manager when already open");
assert.equal(openedManager.closeCount, 1);

viewTool.onChange(true);
assert.equal(openedManager.renderCount, 3, "view toggle should not reopen a closed scent menu");

const reopenedManager = menuTool.onChange();
assert.ok(reopenedManager, "scent menu tool should reopen the manager after close");
assert.notEqual(reopenedManager, openedManager);
assert.equal(reopenedManager.renderCount, 1);
await reopenedManager.close();

const createManager = runtime.openTrailManager();
const createButton = fakeButton();
createManager.element = fakeRoot({
  values: {
    '[name="new.sourceTokenId"]': "tok1",
    '[name="new.label"]': "Strong source",
    '[name="new.odorStrength"]': "strong",
    '[name="new.windBand"]': "downwind",
    '[name="new.maskingOdor"]': "false",
    '[name="new.falseOdor"]': "true",
    '[name="new.odorTags"]': "smoke, blood",
    '[name="new.waterState"]': "none",
    '[name="new.powerfulCompetingOdor"]': "false",
    '[name="new.odorDcModifier"]': "0",
  },
  checked: {
    '[name="new.recordMovement"]': true,
    '[name="new.visibleToPlayers"]': false,
  },
  buttons: {
    '[data-action="createTrail"]': createButton,
  },
});
globalThis.canvas.tokens.placeables = [{ id: "tok1", name: "Source", actor: {}, document: {} }];
await createManager._onRender({}, {});
createButton.listeners.click({ preventDefault() {} });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(createdSources.length, 1, "create source action should call createScentTrail for compatibility");
assert.equal(createdSources[0].windBand, "downwind", "create source action should persist wind");
assert.equal(createdSources[0].odorProfile.odorStrength, "strong", "create source action should persist odor strength");
assert.equal(createdSources[0].odorProfile.falseOdor, "true", "create source action should persist false odor");
assert.equal(createdSources[0].odorProfile.odorTags, "smoke, blood", "create source action should persist odor tags");
assert.equal(createdSources[0].recordMovement, true, "source leaves trail should map to recordMovement");

const row = fakeRow("source-1", {
  '[data-field="active"]': true,
  '[data-field="recordMovement"]': true,
  '[data-field="visibleToPlayers"]': false,
}, {
  '[data-field="label"]': "Edited source",
  '[data-field="sourceTokenId"]': "tok2",
  '[data-field="odorStrength"]': "overpowering",
  '[data-field="windBand"]': "upwind",
  '[data-field="maskingOdor"]': "true",
  '[data-field="falseOdor"]': "false",
  '[data-field="odorTags"]': "acid",
  '[data-field="waterState"]': "water",
  '[data-field="powerfulCompetingOdor"]': "true",
  '[data-field="odorDcModifier"]': "3",
  '[data-field="sizeNotes"]': "Huge",
  '[data-field="countNotes"]': "one",
  '[data-field="notes"]': "fresh",
});
await createManager.constructor._onSubmit({ preventDefault() {} }, fakeRoot({ rows: [row] }));
assert.equal(updatedSources.length, 1, "submit should update scene scent source rows");
assert.equal(updatedSources[0].sourceId, "source-1");
assert.equal(updatedSources[0].data.sourceTokenId, "tok2", "editing a source should persist source token");
assert.equal(updatedSources[0].data.windBand, "upwind", "editing a source should persist wind");
assert.equal(updatedSources[0].data.odorProfile.odorStrength, "overpowering", "editing a source should persist odor strength");
assert.equal(updatedSources[0].data.odorProfile.maskingOdor, "true", "editing a source should persist masking odor");
assert.equal(updatedSources[0].data.recordMovement, true, "source leaves trail should stay compatible with recordMovement");

console.log("Scent source menu tests passed.");

function fakeButton() {
  return {
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

function fakeControl(value) {
  return {
    value,
    checked: value === true,
    addEventListener() {},
    focus() {},
  };
}

function fakeRoot({ values = {}, checked = {}, buttons = {}, rows = [] } = {}) {
  return {
    parentElement: {},
    querySelector(selector) {
      if (buttons[selector]) return buttons[selector];
      if (Object.prototype.hasOwnProperty.call(values, selector)) return fakeControl(values[selector]);
      if (Object.prototype.hasOwnProperty.call(checked, selector)) return fakeControl(checked[selector]);
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-scent-source-id]") return rows;
      if (selector === '[data-action="deleteTrail"]') return [];
      return [];
    },
  };
}

function fakeRow(sourceId, checked = {}, values = {}) {
  return {
    dataset: { scentSourceId: sourceId },
    querySelector(selector) {
      if (Object.prototype.hasOwnProperty.call(checked, selector)) return fakeControl(checked[selector]);
      if (Object.prototype.hasOwnProperty.call(values, selector)) return fakeControl(values[selector]);
      return null;
    },
  };
}
