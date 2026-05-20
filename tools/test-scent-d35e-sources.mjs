import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(pathToFileURL(path.join(root, "scripts/scent-d35e-sources.js")).href);

const sources = globalThis.d35eScentSenseD35ESources;
assert.ok(sources, "D35E source helper API should be exposed on globalThis");

const actor = makeActor({
  prepared: 45,
  base: 30,
  items: [
    makeItem({ id: "equip", name: "Mask", type: "equipment", equipped: true, scent: 60 }),
    makeItem({ id: "race", name: "Wolfblood", type: "race", scent: 40 }),
    makeItem({ id: "class", name: "Hunter", type: "class", scent: 35 }),
    makeItem({ id: "feat", name: "Scent Feat", type: "feat", scent: 50 }),
    makeItem({ id: "buff", name: "Active Buff", type: "buff", active: true, scent: 55 }),
    makeItem({ id: "aura", name: "Inactive Aura", type: "aura", active: false, scent: 90 }),
    makeItem({ id: "broken", name: "Broken Mask", type: "equipment", equipped: true, broken: true, scent: 95 }),
    makeItem({ id: "melded", name: "Melded Mask", type: "equipment", equipped: true, melded: true, scent: 85 }),
    makeItem({ id: "unequipped", name: "Unequipped Mask", type: "equipment", equipped: false, scent: 75 }),
    makeItem({ id: "fallback", name: "Fallback Mask", type: "equipment", equipped: true, fallback: 65 }),
    makeItem({ id: "fallback-ignored", name: "Fallback Unequipped", type: "equipment", equipped: false, fallback: 70 }),
  ],
});

const breakdown = sources.getScentRangeBreakdown(actor);
assert.equal(breakdown.range, 65);
assert.equal(breakdown.supported, true);
assert.ok(breakdown.contributors.some((entry) => entry.path === "system.senses.scent" && entry.range === 45));
assert.ok(breakdown.contributors.some((entry) => entry.path === "system.attributes.senses.scent" && entry.range === 30));
assert.ok(breakdown.contributors.some((entry) => entry.id === "equip" && entry.reason === "equipped-item"));
assert.ok(breakdown.contributors.some((entry) => entry.id === "race" && entry.reason === "inherent-item"));
assert.ok(breakdown.contributors.some((entry) => entry.id === "class" && entry.reason === "inherent-item"));
assert.ok(breakdown.contributors.some((entry) => entry.id === "feat" && entry.reason === "inherent-item"));
assert.ok(breakdown.contributors.some((entry) => entry.id === "buff" && entry.reason === "active-item"));
assert.ok(breakdown.contributors.some((entry) => entry.id === "fallback" && entry.rangeSource === "flags.world.d35eScentSenseRange"));
assert.ok(breakdown.ignored.some((entry) => entry.id === "aura" && entry.reason === "inactive-item"));
assert.ok(breakdown.ignored.some((entry) => entry.id === "broken" && entry.reason === "broken"));
assert.ok(breakdown.ignored.some((entry) => entry.id === "melded" && entry.reason === "melded"));
assert.ok(breakdown.ignored.some((entry) => entry.id === "unequipped" && entry.reason === "not-eligible"));
assert.ok(breakdown.ignored.some((entry) => entry.id === "fallback-ignored" && entry.rangeSource === "flags.world.d35eScentSenseRange"));

assert.equal(sources.getScentRange(actor), 65);
assert.equal(sources.getScentRangeBreakdown(makeActor({ type: "loot", prepared: 30 })).supported, false);
assert.equal(sources.getScentRangeBreakdown({ actor, document: { detectionModes: [{ id: "scentPinpoint", enabled: true, range: 5 }] } }).tokenDetection.synchronized, true);
assert.equal(sources.getScentRangeBreakdown(makeActor({ noVisionOverride: true, prepared: 30 })).tokenDetection.reason, "no-vision-override");

console.log("D35E source helper tests passed.");

function makeActor({ type = "character", prepared = 0, base = 0, items = [], noVisionOverride = false } = {}) {
  return {
    id: "actor1",
    name: "Tracker",
    type,
    system: {
      noVisionOverride,
      senses: {
        scent: prepared,
      },
      attributes: {
        senses: {
          scent: base,
        },
      },
    },
    items,
  };
}

function makeItem({
  id,
  name,
  type,
  scent = 0,
  fallback = 0,
  equipped = undefined,
  active = undefined,
  broken = false,
  melded = false,
}) {
  const item = {
    id,
    name,
    type,
    broken,
    system: {
      senses: {
        scent,
      },
      melded,
    },
    flags: {
      world: {
        d35eScentSenseRange: fallback,
      },
    },
  };
  if (equipped !== undefined) item.system.equipped = equipped;
  if (active !== undefined) item.system.active = active;
  return item;
}
