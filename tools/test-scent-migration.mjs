import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(pathToFileURL(path.join(root, "scripts/scent-context.js")).href);
await import(pathToFileURL(path.join(root, "scripts/scent-odor-profile.js")).href);
await import(pathToFileURL(path.join(root, "scripts/scent-rules.js")).href);
await import(pathToFileURL(path.join(root, "scripts/scent-trails.js")).href);
await import(pathToFileURL(path.join(root, "scripts/scent-migration.js")).href);

const migration = globalThis.d35eScentSenseMigration;
assert.ok(migration, "migration helper API should be exposed on globalThis");

const scene = makeDocument({
  id: "scene1",
  name: "Scratch",
  flags: {
    windBand: "up",
    odorStrength: "overpower",
    maskingOdor: "yes",
    falseOdor: "no",
    odorTags: " wolf, smoke, wolf ",
    scentTrails: [
      {
        id: "trail1",
        label: "  Old   trail ",
        waterState: "flowing",
        powerfulCompetingOdor: "1",
        odorProfile: {
          odorStrength: "strong",
          odorTags: "ash, ash",
        },
      },
    ],
  },
});
const token = makeDocument({
  id: "token1",
  name: "Token",
  flags: {
    windBand: "inherit",
    odorStrength: "Strong",
    maskingOdor: "0",
    scentRelevant: false,
    falseOdor: "yes",
    odorTags: [" Smoke ", "SMOKE", "wolf"],
  },
});
token.actor = makeDocument({ id: "actor1", name: "Actor", flags: { odorTags: ["wolf"] } });
scene.tokens = [token];

const report = migration.planMigration({
  scene,
  contextApi: globalThis.d35eScentSenseContext,
  odorProfileApi: globalThis.d35eScentSenseOdorProfile,
  trailApi: globalThis.d35eScentSenseTrails,
  worldTime: 3600,
});

assert.equal(report.changed, true);
assert.equal(report.scene.set.windBand, "upwind");
assert.equal(report.scene.set.odorStrength, "overpowering");
assert.equal(report.scene.set.maskingOdor, true);
assert.equal(report.scene.set.falseOdor, false);
assert.deepEqual(report.scene.set.odorTags, ["wolf", "smoke"]);
assert.equal(report.scene.set.scentTrails[0].label, "Old trail");
assert.equal(report.scene.set.scentTrails[0].waterState, "flowingWater");
assert.deepEqual(report.tokens[0].unset, ["windBand", "scentRelevant"]);
assert.equal(report.tokens[0].set.odorStrength, "strong");
assert.equal(report.tokens[0].set.maskingOdor, false);
assert.equal(report.tokens[0].set.falseOdor, true);
assert.deepEqual(report.tokens[0].set.odorTags, ["smoke", "wolf"]);
assert.deepEqual(report.actors[0].keys, ["odorTags"]);
assert.equal(report.actors[0].action, "report-only");

await applyReport(scene, report.scene);
await applyReport(token, report.tokens[0]);
assert.equal(scene.flags["d35e-scent-sense"].windBand, "upwind");
assert.equal(scene.flags["d35e-scent-sense"].scentTrails[0].schemaVersion, 1);
assert.equal("windBand" in token.flags["d35e-scent-sense"], false);
assert.equal("scentRelevant" in token.flags["d35e-scent-sense"], false);
assert.equal(token.flags["d35e-scent-sense"].falseOdor, true);

console.log("Scent migration tests passed.");

function makeDocument({ id, name, flags = {} }) {
  return {
    id,
    name,
    flags: {
      "d35e-scent-sense": { ...flags },
    },
    getFlag(moduleId, key) {
      return this.flags[moduleId]?.[key];
    },
    async setFlag(moduleId, key, value) {
      this.flags[moduleId] ??= {};
      this.flags[moduleId][key] = value;
    },
    async unsetFlag(moduleId, key) {
      delete this.flags[moduleId]?.[key];
    },
  };
}

async function applyReport(document, report) {
  for (const key of report.unset ?? []) await document.unsetFlag("d35e-scent-sense", key);
  for (const [key, value] of Object.entries(report.set ?? {})) await document.setFlag("d35e-scent-sense", key, value);
}
