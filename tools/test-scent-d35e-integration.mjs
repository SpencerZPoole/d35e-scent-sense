import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

globalThis.foundry = {
  canvas: {
    perception: {
      DetectionMode: {
        BASIC_MODE_ID: "basic",
        DETECTION_TYPES: {
          OTHER: "other",
        },
      },
    },
  },
  data: {
    operators: {
      ForcedDeletion: class ForcedDeletion {},
    },
  },
  utils: {
    debounce: (fn) => fn,
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    getProperty: (object, propertyPath) => propertyPath.split(".").reduce((current, key) => current?.[key], object),
  },
};

globalThis.CONFIG = {
  Canvas: {
    detectionModes: {
      basic: { constructor: { PRIORITY: 0 } },
      scentPinpoint: { constructor: { PRIORITY: 200_400 } },
    },
  },
  D35E: {
    senses: {},
  },
  Token: {},
};
globalThis.game = { user: { isGM: true }, actors: new Map(), system: { id: "D35E" } };

await import(pathToFileURL(path.join(root, "scripts/scent-d35e-integration.js")).href);

const integrationFactory = globalThis.d35eScentSenseD35EIntegration;
assert.ok(integrationFactory, "D35E integration factory should be exposed on globalThis");

const runtime = integrationFactory.create({
  clone: (value) => JSON.parse(JSON.stringify(value)),
  detectionModeId: "scentPinpoint",
  getScentRange: (actor) => actor?.range ?? 0,
  getScentRangeBreakdown: (actorOrToken) => ({ range: actorOrToken?.actor?.range ?? actorOrToken?.range ?? 0 }),
  isD35E: () => true,
  moduleId: "d35e-scent-sense",
  pinpointRange: 5,
  positiveNumber: (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  },
  queueScan: () => {},
  refreshOverlay: () => {},
  senseId: "scent",
});

const deduped = runtime.buildDetectionModesWithScent([
  { id: "basic", enabled: true, range: 0 },
  { id: "scentPinpoint", enabled: true, range: 1 },
  { id: "scentPinpoint", enabled: true, range: 4 },
], 30);
assert.equal(deduped.changed, true);
assert.deepEqual(
  deduped.modes.filter((mode) => mode.id === "scentPinpoint"),
  [{ id: "scentPinpoint", enabled: true, range: 5 }]
);

const removed = runtime.buildDetectionModesWithScent([
  { id: "basic", enabled: true, range: 0 },
  { id: "scentPinpoint", enabled: true, range: 5 },
], 0);
assert.equal(removed.changed, true);
assert.equal(removed.modes.some((mode) => mode.id === "scentPinpoint"), false);

const objectModes = runtime.buildDetectionModesWithScent({ basic: { enabled: true, range: 0 } }, 30);
assert.deepEqual(objectModes.modes.scentPinpoint, { enabled: true, range: 5 });

const token = {
  actor: { id: "actor1", name: "Tracker", type: "character", range: 30, system: {} },
  detectionModes: [
    { id: "basic", enabled: true, range: 0 },
    { id: "scentPinpoint", enabled: true, range: 2 },
    { id: "scentPinpoint", enabled: true, range: 5 },
  ],
};
assert.equal(runtime.applyScentDetectionMode(token), true);
assert.deepEqual(
  token.detectionModes.filter((mode) => mode.id === "scentPinpoint"),
  [{ id: "scentPinpoint", enabled: true, range: 5 }]
);

const noVisionToken = {
  actor: { id: "actor2", name: "Custom Vision", type: "character", range: 30, system: { noVisionOverride: true } },
  detectionModes: [],
};
assert.equal(runtime.applyScentDetectionMode(noVisionToken), false);
assert.deepEqual(noVisionToken.detectionModes, []);
assert.equal(runtime.getActorSyncGuard(noVisionToken.actor).reason, "no-vision-override");

const lootToken = {
  actor: { id: "actor3", name: "Chest", type: "loot", range: 30, system: {} },
  detectionModes: [],
};
assert.equal(runtime.applyScentDetectionMode(lootToken), false);
assert.equal(runtime.getActorSyncGuard(lootToken.actor).reason, "unsupported-actor");

let getActiveTokensArgument = null;
const tokenUpdates = [];
const actorWithMixedTokens = {
  id: "actor4",
  name: "Mixed Tokens",
  type: "character",
  range: 30,
  system: {},
  prototypeToken: {
    detectionModes: [],
  },
  update: async () => {},
  getActiveTokens: (linked) => {
    getActiveTokensArgument = linked;
    return [
      {
        document: {
          actor: { id: "actor4", name: "Mixed Tokens", type: "character", range: 30, system: {} },
          detectionModes: [],
          update: async (data) => tokenUpdates.push(data),
        },
      },
      {
        document: {
          actor: { id: "actor4", name: "Mixed Tokens", type: "character", range: 30, system: {} },
          detectionModes: [],
          update: async (data) => tokenUpdates.push(data),
        },
      },
    ];
  },
};
await runtime.syncActorTokens(actorWithMixedTokens);
assert.equal(getActiveTokensArgument, false, "syncActorTokens should include linked and unlinked tokens");
assert.equal(tokenUpdates.length, 2, "syncActorTokens should update every active token document");

console.log("D35E integration tests passed.");
