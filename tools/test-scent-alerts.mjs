import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await import(pathToFileURL(path.join(root, "scripts/scent-alerts.js")).href);
await import(pathToFileURL(path.join(root, "scripts/scent-detection.js")).href);

const MODULE_ID = "d35e-scent-sense";
const socketTypes = {
  DIRECTION_REVEALED: "directionRevealed",
  MOVE_ACTION_REQUEST: "moveActionRequest",
  PINPOINT_ALERT: "pinpointAlert",
  PRESENCE_ALERT: "presenceAlert",
  SCAN_REQUEST: "scanRequest",
};
const settings = {
  NOTIFICATION_MODE: "notificationMode",
  RESPECT_WALLS: "respectWalls",
};

let idCounter = 0;
let messages = [];
let emittedPayloads = [];
const hooks = new Map();
const warnings = [];
const errors = [];

const users = [
  { id: "gm1", active: true, isGM: true },
  { id: "owner1", active: true, isGM: false, character: { id: "actor-scent" } },
  { id: "owner2", active: true, isGM: false },
  { id: "party2", active: true, isGM: false },
  { id: "offline-owner", active: false, isGM: false },
];
users.get = (userId) => users.find((user) => user.id === userId);

const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
console.warn = (...args) => warnings.push(args.map(String).join(" "));
console.error = (...args) => errors.push(args.map(String).join(" "));

globalThis.game = {
  user: users.get("gm1"),
  users,
  socket: {
    emit(_socketName, payload) {
      emittedPayloads.push(structuredClone(payload));
    },
  },
};
globalThis.ChatMessage = {
  getSpeaker: ({ alias }) => ({ alias }),
  async create(data) {
    const message = { id: `msg-${messages.length + 1}`, ...structuredClone(data) };
    messages.push(message);
    return message;
  },
};
globalThis.Hooks = {
  on(name, callback) {
    hooks.set(name, callback);
  },
};
globalThis.foundry = {
  applications: {
    api: {
      DialogV2: {
        async confirm() {
          return false;
        },
      },
    },
  },
};
globalThis.canvas = {
  scene: { id: "scene-test", name: "Test Scene" },
};

const sourceActor = {
  id: "actor-scent",
  testUserPermission(user, permission) {
    return permission === "OWNER" && (user.id === "owner1" || user.id === "owner2" || user.id === "gm1");
  },
};
const fallbackActor = {
  id: "actor-fallback",
  testUserPermission(user, permission) {
    return permission === "OWNER" && user.id === "owner2";
  },
};
const sourceToken = {
  id: "token-scent",
  name: "Scent PC",
  actor: sourceActor,
  center: { x: 0, y: 0 },
};
const fallbackSourceToken = {
  id: "token-fallback",
  name: "Fallback PC",
  actor: fallbackActor,
  center: { x: 0, y: 0 },
};
const hiddenTarget = {
  id: "token-secret-monster",
  name: "Secret Monster",
  actor: { id: "actor-secret-monster" },
  center: { x: 100, y: 0 },
  document: { hidden: true },
};
const scene = { id: "scene-test", name: "Test Scene" };
const detection = {
  effectiveRange: 30,
  context: {
    windBand: "normal",
    odorStrength: "normal",
    maskingOdor: false,
    falseOdor: false,
    odorTags: ["hidden"],
  },
  state: "presence",
  notificationBand: "presence",
};

const alertRuntime = globalThis.d35eScentSenseAlerts.create({
  escapeHtml: (value) => String(value ?? "").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  format,
  getSetting: (key) => key === settings.NOTIFICATION_MODE ? "chat" : undefined,
  localize,
  moduleId: MODULE_ID,
  queueScan() {},
  randomId: () => `id-${++idCounter}`,
  rangeBands: { PINPOINT: "pinpoint", PRESENCE: "presence" },
  roundDistance: (value) => Math.round(value),
  settings,
  showLocalPinpointCue() {
    throw new Error("pinpoint socket payloads should not expose target coordinates in these tests");
  },
  socketName: "module.d35e-scent-sense",
  socketTypes,
});

assert.deepEqual(alertRuntime.getActiveOwnerRecipients(sourceToken), ["owner1"], "assigned character user should be preferred");
assert.deepEqual(alertRuntime.getActiveOwnerRecipients(fallbackSourceToken), ["owner2"], "OWNER users should be fallback recipients");
assert.deepEqual(alertRuntime.getOwnerAndGmRecipients(sourceToken), ["owner1", "gm1"], "owner+GM helper should not include unrelated party users");

setUser("owner1");
resetMessages();
await alertRuntime.dispatchPresenceAlert({ scene, sourceToken, targetToken: hiddenTarget, distance: 20, recipients: ["owner1"], detection });
assert.equal(messages.length, 1, "presence alert should create one owner-facing card on the sensing client");
assert.deepEqual(messages[0].whisper, ["owner1", "gm1"], "presence alert should whisper only to sensing owner and active GM");
assert.equal(messages[0].flags[MODULE_ID].private, true, "presence alert should carry module privacy flags");
assertNoForbiddenPlayerLeak(messages[0].content, "presence owner card");
assert.equal(messages[0].whisper.includes("party2"), false, "non-scent party users should not receive presence cards");
assertPlayerSocketIsRedacted(emittedPayloads[0], "presence socket payload");

setUser("owner2");
resetMessages();
await alertRuntime.handleSocketMessage({ id: "multi-owner-secondary", type: socketTypes.PRESENCE_ALERT, eventId: "multi-owner", recipients: ["owner1", "owner2"] });
assert.equal(messages.length, 0, "secondary owner client should not create a duplicate owner card");

setUser("owner1");
resetMessages();
await alertRuntime.handleSocketMessage({ id: "multi-owner-primary", type: socketTypes.PRESENCE_ALERT, eventId: "multi-owner", recipients: ["owner1", "owner2"] });
assert.equal(messages.length, 1, "primary owner client should create the shared owner card");
assert.deepEqual(messages[0].whisper, ["owner1", "owner2", "gm1"], "shared owner card should whisper all sensing owners plus GM");

setUser("gm1");
resetMessages();
await alertRuntime.dispatchPinpointAlert({ scene, sourceToken, targetToken: hiddenTarget, distance: 5, recipients: ["owner1"], detection });
assert.equal(messages.length, 1, "pinpoint dispatch should create one GM detail card from the GM client");
assert.deepEqual(messages[0].whisper, ["gm1"], "pinpoint GM detail card should whisper only to active GMs");
assert.equal(messages[0].flags[MODULE_ID].containsSecret, true, "pinpoint GM detail card should be marked as secret-bearing");
assert.match(messages[0].content, /Secret Monster/, "pinpoint GM detail card may include hidden identity");
assert.equal(messages[0].whisper.includes("owner1"), false, "pinpoint GM detail card should not include owners");
assertPlayerSocketIsRedacted(emittedPayloads[0], "pinpoint socket payload");

const pinpointPayload = emittedPayloads[0];
setUser("owner1");
resetMessages();
await alertRuntime.handleSocketMessage(pinpointPayload);
assert.equal(messages.length, 1, "pinpoint owner socket should create one owner-facing card");
assert.deepEqual(messages[0].whisper, ["owner1", "gm1"], "pinpoint owner card should whisper only to sensing owner and active GM");
assertNoForbiddenPlayerLeak(messages[0].content, "pinpoint owner card");

setUser("gm1");
resetMessages();
await alertRuntime.dispatchPresenceAlert({ scene, sourceToken, targetToken: hiddenTarget, distance: 20, recipients: ["owner1"], detection });
const presencePayload = emittedPayloads[0];
await alertRuntime.handleSocketMessage({
  id: "move-request",
  type: socketTypes.MOVE_ACTION_REQUEST,
  eventId: presencePayload.eventId,
});
assert.equal(messages.length, 1, "direction request should create one GM detail card");
assert.deepEqual(messages[0].whisper, ["gm1"], "direction request detail should whisper only to active GMs");
assert.match(messages[0].content, /Secret Monster/, "direction request GM card may include hidden identity");
assert.equal(messages[0].whisper.includes("owner1"), false, "direction request detail should not include owners");

resetMessages();
const rejectedSecret = await alertRuntime.createPrivateMessage(["owner1"], "<p>Secret Monster</p>", {
  audience: "gm",
  containsSecret: true,
  reason: "test secret card",
});
assert.equal(rejectedSecret, null, "secret-bearing cards with non-GM recipients should be rejected");
assert.equal(messages.length, 0, "rejected secret cards should not create chat messages");

const rejectedPublic = await alertRuntime.createPrivateMessage([], "<p>Public Scent</p>", {
  audience: "owner-gm",
  containsSecret: false,
  reason: "test public card",
});
assert.equal(rejectedPublic, null, "Scent cards with no whisper recipients should be rejected");

alertRuntime.registerChatMessageHook();
const preCreate = hooks.get("preCreateChatMessage");
assert.equal(typeof preCreate, "function", "preCreateChatMessage privacy guard should be registered");
assert.equal(preCreate(fakeMessage(["owner1"], { audience: "gm", containsSecret: true })), false, "preCreate guard should reject secret non-GM recipients");
assert.equal(preCreate(fakeMessage([], { audience: "owner-gm", containsSecret: false })), false, "preCreate guard should reject public Scent cards");
assert.equal(preCreate(fakeMessage(["owner1", "gm1"], { audience: "owner-gm", containsSecret: false })), undefined, "preCreate guard should allow owner+GM non-secret cards");

const render = hooks.get("renderChatMessageHTML");
setUser("party2");
const fakeHtml = [{ removed: false, remove() { this.removed = true; } }];
render(fakeMessage(["owner1"], { audience: "owner-gm", containsSecret: false }), fakeHtml);
assert.equal(fakeHtml[0].removed, true, "render guard should hide private Scent cards from non-recipients");

assertWallBlocking();
assertTrackingPromptPrivacySource();

console.warn = originalConsoleWarn;
console.error = originalConsoleError;
console.log("Scent alert confidentiality tests passed.");

function resetMessages() {
  messages = [];
  emittedPayloads = [];
  errors.length = 0;
}

function setUser(userId) {
  game.user = users.get(userId);
}

function localize(key) {
  const labels = {
    "D35EScent.Alert.GmDirectionRevealButton": "Mark direction revealed",
    "D35EScent.Alert.GmDirectionRevealMarked": "Direction revealed",
    "D35EScent.Alert.Ignore": "Ignore",
    "D35EScent.Alert.Ok": "OK",
    "D35EScent.Alert.Pinpoint": "A scent source is within 5 ft.",
    "D35EScent.Alert.Presence": "You catch a scent nearby.",
    "D35EScent.Alert.PresencePrompt": "You may spend a move action to determine the direction.",
    "D35EScent.Alert.SpendMove": "Spend move action",
    "D35EScent.Alert.Title": "Scent",
  };
  return labels[key] ?? key;
}

function format(key, data = {}) {
  if (key === "D35EScent.Alert.GmContextDetail") {
    return `range ${data.range}; wind ${data.wind}; odor ${data.odor}; masking ${data.masking}; false ${data.falseOdor}; tags ${data.tags}`;
  }
  if (key === "D35EScent.Alert.GmDirectionRequest") {
    return `${data.actor} requested Scent direction.`;
  }
  if (key === "D35EScent.Alert.GmDirectionDetail") {
    return `${data.actor} detected ${data.target} at ${data.distance} ft in ${data.scene}.`;
  }
  if (key === "D35EScent.Alert.GmPinpoint") {
    return `${data.actor} pinpointed ${data.target} in ${data.scene}.`;
  }
  return `${key}: ${JSON.stringify(data)}`;
}

function fakeMessage(whisper, { audience, containsSecret }) {
  return {
    whisper,
    flags: {
      [MODULE_ID]: {
        private: true,
        audience,
        containsSecret,
      },
    },
  };
}

function assertNoForbiddenPlayerLeak(content, label) {
  for (const forbidden of [
    hiddenTarget.name,
    hiddenTarget.id,
    hiddenTarget.actor.id,
    sourceToken.id,
    sourceToken.actor.id,
    "Test Scene",
    "100",
  ]) {
    assert.equal(String(content).includes(forbidden), false, `${label} should not contain ${forbidden}`);
  }
}

function assertPlayerSocketIsRedacted(payload, label) {
  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    hiddenTarget.name,
    hiddenTarget.id,
    hiddenTarget.actor.id,
    sourceToken.name,
    sourceToken.id,
    sourceToken.actor.id,
    "Test Scene",
    "\"point\"",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${label} should not contain ${forbidden}`);
  }
}

function assertWallBlocking() {
  const source = { center: { x: 0, y: 0 } };
  const target = { center: { x: 10, y: 0 } };
  globalThis.CONFIG = { Canvas: { polygonBackends: { sight: { testCollision: () => true } } } };
  let respectWalls = true;
  const detectionRuntime = globalThis.d35eScentSenseDetection.create({
    getSetting: () => respectWalls,
    positiveNumber: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    settings,
  });

  assert.equal(detectionRuntime.isWallBlocked(source, target), true, "blocked walls should suppress alerts");
  CONFIG.Canvas.polygonBackends.sight.testCollision = () => false;
  assert.equal(detectionRuntime.isWallBlocked(source, target), false, "clear wall collision should allow alerts");
  CONFIG.Canvas.polygonBackends.sight.testCollision = () => {
    throw new Error("collision unavailable");
  };
  assert.equal(detectionRuntime.isWallBlocked(source, target), true, "collision errors should fail closed");
  delete CONFIG.Canvas.polygonBackends.sight.testCollision;
  assert.equal(detectionRuntime.isWallBlocked(source, target), true, "missing collision API should fail closed");
  assert.equal(detectionRuntime.isWallBlocked({ center: null }, target), true, "missing centers should fail closed");
  respectWalls = false;
  assert.equal(detectionRuntime.isWallBlocked({ center: null }, target), false, "Respect Walls off should not block alerts");
}

function assertTrackingPromptPrivacySource() {
  const source = readFileSync(path.join(root, "scripts/d35e-scent-sense.js"), "utf8");
  assert.match(source, /options\.nativeRoll !== true/, "native D35E tracking rolls should be explicit opt-in");
  const gmAudienceIndex = source.indexOf('audience: "gm"');
  const gmSecretIndex = source.indexOf("containsSecret: true", gmAudienceIndex);
  assert.ok(gmAudienceIndex >= 0 && gmSecretIndex > gmAudienceIndex, "GM tracking prompt should be secret-bearing and GM-only");

  const ownerRecipientsIndex = source.indexOf("[...ownerIds, ...gmIds]");
  const ownerAudienceIndex = source.indexOf('audience: "owner-gm"', ownerRecipientsIndex);
  const ownerSecretIndex = source.indexOf("containsSecret: false", ownerAudienceIndex);
  assert.ok(ownerRecipientsIndex >= 0 && ownerAudienceIndex > ownerRecipientsIndex && ownerSecretIndex > ownerAudienceIndex, "owner tracking prompt should be redacted owner+GM whisper");
}
