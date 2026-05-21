import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const langPath = path.join(root, "lang", "en.json");
const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return {};
  }
}

function walk(directory, extensions, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "dist", "node_modules"].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, extensions, files);
      continue;
    }
    if (extensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

function toRelative(fullPath) {
  return path.relative(root, fullPath).replaceAll(path.sep, "/");
}

const lang = readJson("lang/en.json");
const manifest = readJson("module.json");
const availableKeys = new Set(Object.keys(lang));
const usedKeys = new Map();
const literalKeyPattern = /(["'`])((?:D35EScent|D35E\.Sense)(?:\.[A-Za-z0-9_-]+)+)\1/g;

for (const fullPath of [
  ...walk(path.join(root, "scripts"), new Set([".js"])),
  ...walk(path.join(root, "templates"), new Set([".hbs"])),
]) {
  const relativePath = toRelative(fullPath);
  const content = fs.readFileSync(fullPath, "utf8");
  for (const match of content.matchAll(literalKeyPattern)) {
    const key = match[2];
    const entries = usedKeys.get(key) ?? [];
    entries.push(relativePath);
    usedKeys.set(key, entries);
  }
}

const dynamicRuntimeKeys = [
  "D35EScent.ContextManager.Source.explicit",
  "D35EScent.ContextManager.Source.token",
  "D35EScent.ContextManager.Source.actor",
  "D35EScent.ContextManager.Source.scene",
  "D35EScent.ContextManager.Source.default",
  "D35EScent.TrailManager.Water.None",
  "D35EScent.TrailManager.Water.Water",
  "D35EScent.TrailManager.Water.FlowingWater",
  "D35EScent.TrailManager.Reason.trackable",
  "D35EScent.TrailManager.Reason.not-rolled",
  "D35EScent.TrailManager.Reason.inactive-trail",
  "D35EScent.TrailManager.Reason.flowing-water-ruins-trail",
  "D35EScent.TrailManager.Reason.tracker-not-eligible",
  "D35EScent.TrailManager.Reason.missing-tracker",
  "D35EScent.TrailManager.Reason.missing-trail",
  "D35EScent.TrailManager.Reason.not-authorized",
  "D35EScent.TrailManager.Reason.rules-unavailable",
  "D35EScent.TrailManager.Reason.trails-unavailable",
  "D35EScent.TrailManager.Reason.unknown",
];

for (const key of dynamicRuntimeKeys) {
  const entries = usedKeys.get(key) ?? [];
  entries.push("dynamic runtime key");
  usedKeys.set(key, entries);
}

if (!Array.isArray(manifest.languages) || !manifest.languages.some((entry) => entry.lang === "en" && entry.path === "lang/en.json")) {
  fail("module.json must declare lang/en.json as the English language file");
}

for (const [key, locations] of usedKeys) {
  if (!availableKeys.has(key)) fail(`Missing localization key ${key} used by ${Array.from(new Set(locations)).join(", ")}`);
}

for (const [key, value] of Object.entries(lang)) {
  if (!key.startsWith("D35EScent.") && !key.startsWith("D35E.Sense.")) {
    fail(`Unexpected localization key prefix: ${key}`);
  }
  if (typeof value !== "string" || value.trim() === "") {
    fail(`Localization key must have a non-empty string value: ${key}`);
  }
}

if (errors.length > 0) {
  console.error("Localization check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Localization check passed (${usedKeys.size} used keys, ${availableKeys.size} available keys).`);
