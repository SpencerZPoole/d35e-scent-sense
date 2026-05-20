import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(pathToFileURL(path.join(root, "scripts/scent-rules.js")).href);

const rules = globalThis.d35eScentSenseRules;
assert.ok(rules, "scent rules API should be exposed on globalThis");

assert.equal(rules.calculateEffectiveRange(30, { windBand: "normal" }), 30);
assert.equal(rules.calculateEffectiveRange(30, { windBand: "upwind" }), 60);
assert.equal(rules.calculateEffectiveRange(30, { windBand: "downwind" }), 15);
assert.equal(rules.calculateEffectiveRange(30, { odorStrength: "strong" }), 60);
assert.equal(rules.calculateEffectiveRange(30, { odorStrength: "overpowering" }), 90);
assert.equal(rules.calculateEffectiveRange(30, { maskingOdor: true }), 0);

assert.deepEqual(
  pickDetection(rules.evaluateDetection({ baseRange: 30, distance: 30 })),
  { detectable: true, pinpoint: false, band: "presence", reason: "detectable", effectiveRange: 30 }
);
assert.deepEqual(
  pickDetection(rules.evaluateDetection({ baseRange: 30, distance: 31 })),
  { detectable: false, pinpoint: false, band: null, reason: "out-of-range", effectiveRange: 30 }
);
assert.deepEqual(
  pickDetection(rules.evaluateDetection({ baseRange: 30, distance: 5 })),
  { detectable: true, pinpoint: true, band: "pinpoint", reason: "detectable", effectiveRange: 30 }
);
assert.deepEqual(
  pickDetection(rules.evaluateDetection({ baseRange: 30, distance: 1, context: { maskingOdor: true } })),
  { detectable: false, pinpoint: false, band: null, reason: "masking-odor", effectiveRange: 0 }
);

assert.equal(rules.getTrackingByScentDc().dc, 10);
assert.equal(rules.getTrackingByScentDc({ powerfulCompetingOdor: true }).dc, 20);
assert.equal(rules.getTrackingByScentDc({ trailAgeHours: 2 }).dc, 14);
assert.equal(rules.getTrackingByScentDc({ powerfulCompetingOdor: true, trailAgeHours: 2, odorDcModifier: -2 }).dc, 22);

assert.deepEqual(
  pickTracking(rules.getTrackingByScentDc({ waterState: "flowingWater", trackerBreathesWater: false })),
  { trackable: false, dc: null, reason: "flowing-water-ruins-trail" }
);
assert.deepEqual(
  pickTracking(rules.getTrackingByScentDc({ waterState: "flowingWater", trackerBreathesWater: true })),
  { trackable: true, dc: 10, reason: "trackable" }
);

assert.equal(rules.canTrackByScent(makeActor({ scent: 30, trackFeat: true })), true);
assert.equal(rules.canTrackByScent(makeActor({ scent: 30, trackFeat: false })), false);
assert.equal(rules.canTrackByScent(makeActor({ scent: 0, trackFeat: true })), false);

console.log("Scent rules tests passed.");

function pickDetection(result) {
  return {
    detectable: result.detectable,
    pinpoint: result.pinpoint,
    band: result.band,
    reason: result.reason,
    effectiveRange: result.effectiveRange,
  };
}

function pickTracking(result) {
  return {
    trackable: result.trackable,
    dc: result.dc,
    reason: result.reason,
  };
}

function makeActor({ scent, trackFeat }) {
  return {
    system: {
      attributes: {
        senses: {
          scent,
        },
      },
    },
    items: trackFeat ? [{ type: "feat", name: "Track", system: {} }] : [],
  };
}
