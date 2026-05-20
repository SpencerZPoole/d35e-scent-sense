import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(pathToFileURL(path.join(root, "scripts/scent-context.js")).href);

const context = globalThis.d35eScentSenseContext;
assert.ok(context, "scent context API should be exposed on globalThis");

const scene = makeDocument({ windBand: "downwind", odorStrength: "strong", maskingOdor: true });
const actor = makeDocument({ windBand: "upwind" });
const token = makeDocument({ odorStrength: "overpowering" });

const resolved = context.getScentContext({
  explicit: { maskingOdor: false },
  targetDocument: token,
  targetActor: actor,
  scene,
});

assert.deepEqual(resolved.context, {
  windBand: "upwind",
  odorStrength: "overpowering",
  maskingOdor: false,
});
assert.deepEqual(resolved.sources, {
  windBand: "actor",
  odorStrength: "token",
  maskingOdor: "explicit",
});

assert.deepEqual(
  context.getScentContext({ targetDocument: makeDocument(), targetActor: makeDocument(), scene: makeDocument() }).context,
  { windBand: "normal", odorStrength: "normal", maskingOdor: false }
);

assert.deepEqual(
  context.buildFlagChanges({
    windBand: "inherit",
    odorStrength: "Strong",
    maskingOdor: "0",
    scentRelevant: false,
  }),
  {
    set: { odorStrength: "strong", maskingOdor: false },
    unset: ["windBand", "scentRelevant"],
  }
);

assert.deepEqual(
  context.buildFlagChanges({
    windBand: "up",
    odorStrength: "overpower",
    maskingOdor: "yes",
    scentRelevant: true,
  }),
  {
    set: { windBand: "upwind", odorStrength: "overpowering", maskingOdor: true, scentRelevant: true },
    unset: [],
  }
);

assert.deepEqual(
  context.buildFlagChanges({ scentRelevant: true }, { token: false }),
  { set: {}, unset: [] }
);

assert.equal(context.readFlag(makeDocument({ windBand: "normal" }), "windBand"), "normal");
assert.equal(context.readFlag({ flags: { "d35e-scent-sense": { windBand: "downwind" } } }, "windBand"), "downwind");

console.log("Scent context tests passed.");

function makeDocument(flags = {}) {
  return {
    flags: {
      "d35e-scent-sense": flags,
    },
    getFlag(moduleId, key) {
      return this.flags[moduleId]?.[key];
    },
  };
}
