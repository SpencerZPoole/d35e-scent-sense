import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(pathToFileURL(path.join(root, "scripts/scent-odor-profile.js")).href);

const odorProfile = globalThis.d35eScentSenseOdorProfile;
assert.ok(odorProfile, "scent odor profile API should be exposed on globalThis");

assert.deepEqual(
  odorProfile.normalizeOdorProfile({
    odorStrength: "Overpower",
    maskingOdor: "yes",
    falseOdor: "0",
    odorTags: " Wolf, smoke , wolf ",
  }),
  {
    odorStrength: "overpowering",
    maskingOdor: true,
    falseOdor: false,
    odorTags: ["wolf", "smoke"],
  }
);

const scene = makeDocument({ odorStrength: "strong", maskingOdor: false, falseOdor: true, odorTags: "scene musk" });
const actor = makeDocument({ maskingOdor: true, odorTags: ["actor scent"] });
const token = makeDocument({ odorStrength: "overpowering", odorTags: "wet dog, sulfur" });

const resolved = odorProfile.getOdorProfile({
  explicit: { falseOdor: false },
  targetDocument: token,
  targetActor: actor,
  scene,
});

assert.deepEqual(resolved.profile, {
  odorStrength: "overpowering",
  maskingOdor: true,
  falseOdor: false,
  odorTags: ["wet dog", "sulfur"],
});
assert.deepEqual(resolved.sources, {
  odorStrength: "token",
  maskingOdor: "actor",
  falseOdor: "explicit",
  odorTags: "token",
});

const explicitMasking = odorProfile.getOdorProfile({
  explicit: { maskingOdor: true },
  targetDocument: makeDocument({ maskingOdor: false }),
  targetActor: makeDocument(),
  scene: makeDocument(),
});
assert.equal(explicitMasking.profile.maskingOdor, true, "explicit odor profile should override document flags");
assert.equal(explicitMasking.sources.maskingOdor, "explicit");

assert.deepEqual(
  odorProfile.getOdorProfile({ targetDocument: makeDocument(), targetActor: makeDocument(), scene: makeDocument() }).profile,
  { odorStrength: "normal", maskingOdor: false, falseOdor: false, odorTags: [] }
);

assert.deepEqual(
  odorProfile.buildFlagChanges({
    odorStrength: "overpower",
    maskingOdor: "false",
    falseOdor: "true",
    odorTags: "Wolf, smoke, wolf",
    familiarOdorTags: ["smoke", "rain"],
  }),
  {
    set: {
      odorStrength: "overpowering",
      maskingOdor: false,
      falseOdor: true,
      odorTags: ["wolf", "smoke"],
      familiarOdorTags: ["smoke", "rain"],
    },
    unset: [],
  }
);

assert.deepEqual(
  odorProfile.buildFlagChanges({
    falseOdor: "inherit",
    odorTags: "",
    familiarOdorTags: [],
  }),
  {
    set: {},
    unset: ["falseOdor", "odorTags", "familiarOdorTags"],
  }
);

const tracker = makeDocument({ familiarOdorTags: " smoke, rain " });
assert.deepEqual(
  odorProfile.identifyFamiliarOdor(tracker, { odorTags: ["wolf", "smoke"] }),
  {
    familiar: true,
    matchedTags: ["smoke"],
    actorTags: ["smoke", "rain"],
    targetTags: ["wolf", "smoke"],
  }
);

assert.deepEqual(
  odorProfile.identifyFamiliarOdor(tracker, { odorTags: ["wolf"] }),
  {
    familiar: false,
    matchedTags: [],
    actorTags: ["smoke", "rain"],
    targetTags: ["wolf"],
  }
);

assert.equal(odorProfile.readFlag(makeDocument({ falseOdor: true }), "falseOdor"), true);

console.log("Scent odor profile tests passed.");

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
