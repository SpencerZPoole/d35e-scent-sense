import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(pathToFileURL(path.join(root, "scripts/scent-api.js")).href);

const apiFactory = globalThis.d35eScentSenseApi;
assert.ok(apiFactory, "scent API factory should be exposed on globalThis");

const createScentSource = () => "created-source";
const updateScentSource = () => "updated-source";
const deleteScentSource = () => "deleted-source";
const getScentSources = () => ["source"];
const getScentSourceDc = () => ({ dc: 10 });
const getScentSourceDisplayState = () => ({ state: "fresh" });

const api = apiFactory.create({
  constants: {},
  getContextApi: () => ({}),
  getOdorProfileApi: () => ({}),
  getScentRules: () => ({}),
  getScentStateApi: () => ({}),
  getScentTrailsApi: () => ({}),
  createScentSource,
  createScentTrail: createScentSource,
  updateScentSource,
  updateScentTrail: updateScentSource,
  deleteScentSource,
  deleteScentTrail: deleteScentSource,
  getScentSources,
  getScentTrails: getScentSources,
  getScentSourceDc,
  getScentTrailDc: getScentSourceDc,
  getScentSourceDisplayState,
  getScentTrailDisplayState: getScentSourceDisplayState,
});

assert.equal(api.createScentSource, createScentSource, "new createScentSource alias should be public");
assert.equal(api.createScentTrail, createScentSource, "legacy createScentTrail API should remain public");
assert.equal(api.updateScentSource, updateScentSource, "new updateScentSource alias should be public");
assert.equal(api.updateScentTrail, updateScentSource, "legacy updateScentTrail API should remain public");
assert.equal(api.deleteScentSource, deleteScentSource, "new deleteScentSource alias should be public");
assert.equal(api.deleteScentTrail, deleteScentSource, "legacy deleteScentTrail API should remain public");
assert.equal(api.getScentSources, getScentSources, "new getScentSources alias should be public");
assert.equal(api.getScentTrails, getScentSources, "legacy getScentTrails API should remain public");
assert.equal(api.getScentSourceDc, getScentSourceDc, "new getScentSourceDc alias should be public");
assert.equal(api.getScentTrailDc, getScentSourceDc, "legacy getScentTrailDc API should remain public");
assert.equal(api.getScentSourceDisplayState, getScentSourceDisplayState, "new source display state alias should be public");
assert.equal(api.getScentTrailDisplayState, getScentSourceDisplayState, "legacy trail display state API should remain public");

console.log("Scent API alias tests passed.");
