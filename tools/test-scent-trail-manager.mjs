import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

globalThis.game = {
  user: { isGM: true },
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
      },
      HandlebarsApplicationMixin: (Base) => Base,
    },
  },
};

await import(pathToFileURL(path.join(root, "scripts/scent-trail-manager.js")).href);

const trailManager = globalThis.d35eScentSenseTrailManager;
assert.ok(trailManager, "scent trail manager API should be exposed on globalThis");

let trailOverlayVisible = false;
let openedContext = false;
const setTrailOverlayCalls = [];
const runtime = trailManager.create({
  canTrackByScent: () => true,
  createScentTrail: async () => {},
  deleteScentTrail: async () => {},
  format: (_key, data = {}) => JSON.stringify(data),
  getScentRange: () => 30,
  getScentTrailDc: () => ({ trackable: true, dc: 10, reason: "trackable", trailAgeHours: 0 }),
  getScentTrails: () => [],
  isTrailOverlayVisible: () => trailOverlayVisible,
  localize: (key) => key,
  moduleId: "d35e-scent-sense",
  openContextManager: () => {
    openedContext = true;
  },
  rollTrackByScent: async () => ({}),
  roundDistance: (value) => value,
  setTrailOverlayVisible: (visible) => {
    trailOverlayVisible = visible === true;
    setTrailOverlayCalls.push(trailOverlayVisible);
    return trailOverlayVisible;
  },
  template: "unused",
  updateScentTrail: async () => {},
});

const controls = [{ name: "token", tools: [] }];
runtime.registerTrailManagerTool(controls);

let viewTool = controls[0].tools.find((tool) => tool.name === "d35e-scent-sense-trail-view");
const menuTool = controls[0].tools.find((tool) => tool.name === "d35e-scent-sense-trail-manager");
assert.ok(viewTool, "view scent trails tool should be registered");
assert.ok(menuTool, "scent menu tool should be registered");
assert.equal(viewTool.active, false);
assert.equal(typeof viewTool.onClick, "undefined", "view tool should not also toggle from onClick");
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

viewTool.onChange();
assert.equal(trailOverlayVisible, true, "toolbar without explicit state should fall back to a single toggle");

runtime.registerTrailManagerTool(controls);
viewTool = controls[0].tools.find((tool) => tool.name === "d35e-scent-sense-trail-view");
assert.equal(viewTool.active, true, "menu-driven overlay changes should be reflected on controls render");

assert.deepEqual(setTrailOverlayCalls, [true, true, false, true, false, true]);

const openedManager = menuTool.onChange();
assert.ok(openedManager, "scent menu tool should open the trail manager when closed");
assert.equal(openedManager.renderCount, 1);

viewTool.onChange(false);
assert.equal(openedManager.renderCount, 2, "view toggle should refresh an open trail manager");

await openedManager.close();
assert.equal(openedManager.closeCount, 1);

viewTool.onChange(true);
assert.equal(openedManager.renderCount, 2, "view toggle should not reopen a closed trail manager");
assert.equal(openedContext, false, "view toggle should not open unrelated context UI");

const reopenedManager = menuTool.onChange();
assert.ok(reopenedManager, "scent menu tool should reopen the trail manager after close");
assert.notEqual(reopenedManager, openedManager);
assert.equal(reopenedManager.renderCount, 1);

const toggleClosedResult = menuTool.onChange();
assert.equal(toggleClosedResult, null, "scent menu tool should close the trail manager when already open");

console.log("Scent trail manager tests passed.");
