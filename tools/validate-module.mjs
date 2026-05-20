import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "module.json",
  "package.json",
  "README.md",
  "LICENSE.md",
  "OGL-1.0a.txt",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/ARCHITECTURE.md",
  "docs/RAW_COVERAGE_MATRIX.md",
  "docs/V1_ROADMAP.md",
  "lang/en.json",
  "scripts/scent-rules.js",
  "scripts/scent-context.js",
  "scripts/scent-odor-profile.js",
  "scripts/scent-state.js",
  "scripts/scent-detection.js",
  "scripts/scent-overlay.js",
  "scripts/scent-alerts.js",
  "scripts/scent-d35e-integration.js",
  "scripts/scent-context-manager.js",
  "scripts/scent-api.js",
  "scripts/d35e-scent-sense.js",
  "styles/d35e-scent-sense.css",
  "templates/scent-context-manager.hbs",
  "tools/check-public-surface.mjs",
  "tools/test-scent-context.mjs",
  "tools/test-scent-odor-profile.mjs",
  "tools/test-scent-rules.mjs",
  "tools/test-scent-state.mjs",
  "tools/validate-module.mjs",
];

const errors = [];
const expectedManifestUrl = "https://github.com/SpencerZPoole/d35e-scent-sense/releases/latest/download/module.json";
const expectedDownloadUrl = "https://github.com/SpencerZPoole/d35e-scent-sense/releases/download/v0.6.3/d35e-scent-sense-v0.6.3.zip";
const expectedScripts = [
  "scripts/scent-rules.js",
  "scripts/scent-context.js",
  "scripts/scent-odor-profile.js",
  "scripts/scent-state.js",
  "scripts/scent-detection.js",
  "scripts/scent-overlay.js",
  "scripts/scent-alerts.js",
  "scripts/scent-d35e-integration.js",
  "scripts/scent-context-manager.js",
  "scripts/scent-api.js",
  "scripts/d35e-scent-sense.js",
];

function fail(message) {
  errors.push(message);
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`Missing required file: ${relativePath}`);
  }
}

const manifest = readJson("module.json");
const packageJson = readJson("package.json");
readJson("lang/en.json");

if (manifest) {
  if (manifest.id !== "d35e-scent-sense") fail("module.json id must be d35e-scent-sense");
  if (manifest.title !== "D35E Scent Sense") fail("module.json title must be D35E Scent Sense");
  if (manifest.version !== "0.6.3") fail("module.json version must be 0.6.3");
  if (manifest.license !== "LICENSE.md") fail("module.json license must point to LICENSE.md");
  if (typeof manifest.url !== "string" || !manifest.url.includes("d35e-scent-sense")) fail("module.json url is missing or incorrect");
  if (manifest.manifest !== expectedManifestUrl) fail("module.json manifest URL is missing or incorrect");
  if (manifest.download !== expectedDownloadUrl) fail("module.json download URL is missing or incorrect");
  if (!Array.isArray(manifest.authors) || manifest.authors[0]?.name !== "Spencer Poole") fail("module.json author must be Spencer Poole");
  if (manifest.compatibility?.minimum !== "14") fail("module.json Foundry minimum compatibility must be 14");
  if (manifest.compatibility?.verified !== "14.361") fail("module.json Foundry verified compatibility must be 14.361");

  const system = manifest.relationships?.systems?.find((entry) => entry.id === "D35E");
  if (!system) fail("module.json must declare D35E system relationship");
  if (system?.compatibility?.minimum !== "3.0.2") fail("D35E minimum compatibility must be 3.0.2");
  if (system?.compatibility?.verified !== "3.0.2") fail("D35E verified compatibility must be 3.0.2");
  if (JSON.stringify(manifest.scripts) !== JSON.stringify(expectedScripts)) {
    fail("module.json scripts must load helper runtimes before scripts/d35e-scent-sense.js");
  }

  for (const scriptPath of manifest.scripts ?? []) {
    const fullScriptPath = path.join(root, scriptPath);
    if (!fs.existsSync(fullScriptPath)) {
      fail(`Manifest script path does not exist: ${scriptPath}`);
      continue;
    }

    const scriptContent = fs.readFileSync(fullScriptPath, "utf8");
    if (scriptContent.includes("game.socket") && manifest.socket !== true) {
      fail(`Manifest script uses game.socket but module.json socket is not true: ${scriptPath}`);
    }
  }

  for (const language of manifest.languages ?? []) {
    if (!fs.existsSync(path.join(root, language.path))) fail(`Manifest language path does not exist: ${language.path}`);
  }

  for (const stylePath of manifest.styles ?? []) {
    if (!fs.existsSync(path.join(root, stylePath))) fail(`Manifest style path does not exist: ${stylePath}`);
  }
}

if (packageJson) {
  if (packageJson.name !== "d35e-scent-sense") fail("package.json name must be d35e-scent-sense");
  if (packageJson.version !== "0.6.3") fail("package.json version must be 0.6.3");
  if (packageJson.license !== "MIT") fail("package.json license must be MIT");
  if (packageJson.private !== true) fail("package.json should be private to prevent accidental npm publication");
  for (const scriptName of ["check:js", "check:public", "test:context", "test:odor-profile", "test:rules", "test:state", "validate", "test"]) {
    if (!packageJson.scripts?.[scriptName]) fail(`package.json missing script: ${scriptName}`);
  }
}

if (errors.length > 0) {
  console.error("Module validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Module validation passed.");
