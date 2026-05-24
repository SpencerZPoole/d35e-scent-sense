import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(pathToFileURL(path.join(root, "scripts/scent-rules.js")).href);
await import(pathToFileURL(path.join(root, "scripts/scent-odor-profile.js")).href);
await import(pathToFileURL(path.join(root, "scripts/scent-trails.js")).href);

const trails = globalThis.d35eScentSenseTrails;
assert.ok(trails, "scent trails API should be exposed on globalThis");

assert.deepEqual(
  trails.resolveTokenMovementPosition({ x: 10, y: 20 }, { x: 80, y: 90 }),
  { x: 80, y: 90 }
);
assert.deepEqual(
  trails.resolveTokenMovementPosition({ x: 10, y: 20 }, { x: 80 }),
  { x: 80, y: 20 }
);
assert.deepEqual(
  trails.resolveTokenMovementPosition({ x: 10, y: 20 }, { y: 90 }),
  { x: 10, y: 90 }
);
assert.equal(trails.hasMeaningfulMovement({ x: 10, y: 20 }, { x: 11, y: 20 }, 2), false);
assert.equal(trails.hasMeaningfulMovement({ x: 10, y: 20 }, { x: 80, y: 90 }, 2), true);

const normalized = trails.normalizeTrail({
  id: "wolf-trail",
  label: "  Wolf   trail ",
  sourceTokenId: "tok1",
  sourceActorId: "act1",
  sourceName: "Hidden Wolf",
  createdWorldTime: 0,
  windBand: "down",
  waterState: "flowing",
  powerfulCompetingOdor: "yes",
  odorDcModifier: "2",
  sizeNotes: "Large",
  countNotes: "two",
  notes: "near old stones",
  odorProfile: {
    odorStrength: "overpower",
    falseOdor: true,
    odorTags: " wolf, smoke, wolf ",
  },
}, { worldTime: 7200 });

assert.deepEqual(
  pickTrail(normalized),
  {
    id: "wolf-trail",
    active: true,
    label: "Wolf trail",
    sourceTokenId: "tok1",
    sourceActorId: "act1",
    sourceName: "Hidden Wolf",
    createdWorldTime: 0,
    updatedWorldTime: 7200,
    windBand: "downwind",
    waterState: "flowingWater",
    powerfulCompetingOdor: true,
    odorDcModifier: 2,
    recordMovement: false,
    visibleToPlayers: false,
    sizeNotes: "Large",
    countNotes: "two",
    notes: "near old stones",
    odorProfile: {
      odorStrength: "overpowering",
      maskingOdor: false,
      falseOdor: true,
      odorTags: ["wolf", "smoke"],
    },
    pathSegments: [],
  }
);

assert.equal(trails.calculateTrailAgeHours(normalized, { worldTime: 7200 }), 2);

const scene = makeScene([normalized]);
assert.equal(trails.getSceneTrails(scene)[0].label, "Wolf trail");

const updated = trails.upsertTrail(trails.getSceneTrails(scene), { ...normalized, label: "Wolf trail refreshed" }, { worldTime: 7200 });
assert.equal(updated.length, 1);
assert.equal(updated[0].label, "Wolf trail refreshed");
assert.equal(trails.normalizeTrail({ id: "plain", sourceTokenId: "tok1", odorProfile: { odorStrength: "loud" } }).odorProfile.odorStrength, "normal");
assert.equal(trails.normalizeTrail({ id: "windy", sourceTokenId: "tok1", windBand: "crosswind" }).windBand, "normal");
assert.equal(trails.normalizeTrail({ id: "legacy", sourceTokenId: "tok1" }).odorProfile.odorStrength, "normal");

const added = trails.upsertTrail(updated, {
  id: "second-trail",
  label: "Second trail",
  createdWorldTime: 3600,
}, { worldTime: 7200 });
assert.equal(added.length, 2);
assert.equal(trails.deleteTrail(added, "wolf-trail").length, 1);

const segmented = trails.addTrailSegment(added, "wolf-trail", {
  id: "seg-1",
  sourceTokenId: "tok1",
  sceneId: "scene1",
  createdWorldTime: 3600,
  start: { x: 10, y: 20 },
  end: { x: 110, y: 120 },
}, { worldTime: 7200, sceneId: "scene1" });
const segmentedTrail = segmented.find((trail) => trail.id === "wolf-trail");
assert.equal(segmentedTrail.pathSegments.length, 1);
assert.deepEqual(segmentedTrail.pathSegments[0].start, { x: 10, y: 20 });
assert.deepEqual(trails.getTrailDisplayState(segmentedTrail.pathSegments[0], { worldTime: 7200 }), {
  visible: true,
  ageHours: 1,
  opacity: 0.72,
  state: "aging",
});
assert.equal(trails.getTrailDisplayState(segmentedTrail.pathSegments[0], { worldTime: 3600 + (72 * 3600) }).visible, false);

assert.equal(
  trails.getScentTrailDc({ ...normalized, waterState: "none", powerfulCompetingOdor: false, odorDcModifier: 0 }, makeActor({ scent: 30, trackFeat: true }), { worldTime: 0 }).dc,
  10
);
assert.equal(
  trails.getScentTrailDc({ ...normalized, waterState: "none", createdWorldTime: 0 }, makeActor({ scent: 30, trackFeat: true }), { worldTime: 7200 }).dc,
  26
);
assert.deepEqual(
  pickDc(trails.getScentTrailDc({ ...normalized, waterState: "flowingWater" }, makeActor({ scent: 30, trackFeat: true }), { worldTime: 0 })),
  { trackable: false, dc: null, reason: "flowing-water-ruins-trail" }
);
assert.deepEqual(
  pickDc(trails.getScentTrailDc({ ...normalized, waterState: "flowingWater" }, makeActor({ scent: 30, trackFeat: true, breathesWater: true }), { worldTime: 0 })),
  { trackable: true, dc: 22, reason: "trackable" }
);
assert.deepEqual(
  pickDc(trails.getScentTrailDc(normalized, makeActor({ scent: 30, trackFeat: false }), { worldTime: 0 })),
  { trackable: false, dc: null, reason: "tracker-not-eligible" }
);
assert.deepEqual(
  pickDc(trails.getScentTrailDc({ ...normalized, active: false }, makeActor({ scent: 30, trackFeat: true }), { worldTime: 0 })),
  { trackable: false, dc: null, reason: "inactive-trail" }
);

const dcResult = trails.getScentTrailDc({ ...normalized, waterState: "none" }, makeActor({ scent: 30, trackFeat: true }), { worldTime: 0 });
const prompt = trails.buildRollPromptData(normalized, { name: "Tracker Token" }, dcResult, { worldTime: 0 });
assert.equal(prompt.player.trailLabel, "Scent trail");
assert.equal(prompt.player.sourceName, undefined);
assert.equal(prompt.gm.trailLabel, "Wolf trail");
assert.equal(prompt.gm.sourceName, "Hidden Wolf");
assert.equal(prompt.player.dc, prompt.gm.dc);
assert.equal(prompt.gm.odorProfile.odorStrength, "overpowering");

console.log("Scent trail tests passed.");

function pickTrail(trail) {
  return {
    id: trail.id,
    active: trail.active,
    label: trail.label,
    sourceTokenId: trail.sourceTokenId,
    sourceActorId: trail.sourceActorId,
    sourceName: trail.sourceName,
    createdWorldTime: trail.createdWorldTime,
    updatedWorldTime: trail.updatedWorldTime,
    windBand: trail.windBand,
    waterState: trail.waterState,
    powerfulCompetingOdor: trail.powerfulCompetingOdor,
    odorDcModifier: trail.odorDcModifier,
    recordMovement: trail.recordMovement,
    visibleToPlayers: trail.visibleToPlayers,
    sizeNotes: trail.sizeNotes,
    countNotes: trail.countNotes,
    notes: trail.notes,
    odorProfile: trail.odorProfile,
    pathSegments: trail.pathSegments,
  };
}

function pickDc(result) {
  return {
    trackable: result.trackable,
    dc: result.dc,
    reason: result.reason,
  };
}

function makeScene(trailList = []) {
  return {
    flags: {
      "d35e-scent-sense": {
        scentTrails: trailList,
      },
    },
    getFlag(moduleId, key) {
      return this.flags[moduleId]?.[key];
    },
  };
}

function makeActor({ scent, trackFeat, breathesWater = false }) {
  return {
    system: {
      attributes: {
        senses: {
          scent,
        },
        breathing: {
          water: breathesWater,
        },
      },
    },
    items: trackFeat ? [{ type: "feat", name: "Track", system: {} }] : [],
  };
}
