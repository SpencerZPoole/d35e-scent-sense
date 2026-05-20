import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(pathToFileURL(path.join(root, "scripts/scent-state.js")).href);

const state = globalThis.d35eScentSenseState;
assert.ok(state, "scent state API should be exposed on globalThis");

assert.deepEqual(
  pick(state.evaluateScentState({ detection: detection({ detectable: false, reason: "out-of-range" }) })),
  {
    state: "none",
    states: [],
    detectable: false,
    pinpoint: false,
    directionAvailable: false,
    directionRequested: false,
    directionRevealed: false,
    notificationBand: null,
  }
);

assert.deepEqual(
  pick(state.evaluateScentState({ detection: detection({ detectable: false, reason: "masking-odor" }) })),
  {
    state: "none",
    states: [],
    detectable: false,
    pinpoint: false,
    directionAvailable: false,
    directionRequested: false,
    directionRevealed: false,
    notificationBand: null,
  }
);

assert.deepEqual(
  pick(state.evaluateScentState({ detection: detection({ detectable: true, pinpoint: false }) })),
  {
    state: "directionAvailable",
    states: ["presence", "directionAvailable"],
    detectable: true,
    pinpoint: false,
    directionAvailable: true,
    directionRequested: false,
    directionRevealed: false,
    notificationBand: "presence",
  }
);

assert.deepEqual(
  pick(state.evaluateScentState({ detection: detection({ detectable: true, pinpoint: true }) })),
  {
    state: "pinpoint",
    states: ["presence", "pinpoint"],
    detectable: true,
    pinpoint: true,
    directionAvailable: false,
    directionRequested: false,
    directionRevealed: false,
    notificationBand: "pinpoint",
  }
);

assert.deepEqual(
  pick(state.evaluateScentState({ detection: detection({ detectable: true, pinpoint: false }), directionStatus: "requested" })),
  {
    state: "directionRequested",
    states: ["presence", "directionAvailable", "directionRequested"],
    detectable: true,
    pinpoint: false,
    directionAvailable: true,
    directionRequested: true,
    directionRevealed: false,
    notificationBand: "presence",
  }
);

assert.deepEqual(
  pick(state.evaluateScentState({ detection: detection({ detectable: true, pinpoint: false }), directionStatus: "revealed" })),
  {
    state: "directionRevealed",
    states: ["presence", "directionAvailable", "directionRequested", "directionRevealed"],
    detectable: true,
    pinpoint: false,
    directionAvailable: true,
    directionRequested: true,
    directionRevealed: true,
    notificationBand: "presence",
  }
);

assert.equal(state.normalizeDirectionStatus("direction-requested"), "requested");
assert.equal(state.normalizeDirectionStatus("directionRevealed"), "revealed");
assert.equal(state.normalizeDirectionStatus("ignored"), "none");

console.log("Scent state tests passed.");

function detection(overrides = {}) {
  const detectable = overrides.detectable === true;
  const pinpoint = detectable && overrides.pinpoint === true;
  return {
    detectable,
    pinpoint,
    band: detectable ? pinpoint ? "pinpoint" : "presence" : null,
    reason: detectable ? "detectable" : overrides.reason ?? "out-of-range",
    reasons: detectable ? [] : [overrides.reason ?? "out-of-range"],
    baseRange: 30,
    effectiveRange: detectable ? 30 : 0,
    distance: detectable ? pinpoint ? 5 : 30 : 31,
    context: { windBand: "normal", odorStrength: "normal", maskingOdor: false },
    pinpointRange: 5,
  };
}

function pick(result) {
  return {
    state: result.state,
    states: result.states,
    detectable: result.detectable,
    pinpoint: result.pinpoint,
    directionAvailable: result.directionAvailable,
    directionRequested: result.directionRequested,
    directionRevealed: result.directionRevealed,
    notificationBand: result.notificationBand,
  };
}
