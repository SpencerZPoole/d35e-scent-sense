import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedOglPath = "OGL-1.0a.txt";
const moduleManifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const currentVersion = moduleManifest.version;
const moduleId = moduleManifest.id;
const requiredScreenshotAssets = [
  "diagnostics-support.png",
  "module-settings.png",
  "scent-context-manager.png",
  "scent-range-pinpoint.png",
  "scent-trails-manager.png",
];

const forbiddenText = [
  ["D" + "&" + "D", "unsafe abbreviated tabletop trademark"],
  ["Dungeons " + "& " + "Dragons", "unsafe full tabletop trademark"],
  ["Wiz" + "ards", "publisher name outside required license text"],
  ["Monster " + "Manual", "sourcebook title"],
  ["Player" + "'s Handbook", "sourcebook title"],
  ["Dungeon " + "Master" + "'s Guide", "sourcebook title"],
  ["Forgotten " + "Realms", "setting reference"],
  ["Tome " + "of Battle", "sourcebook title"],
  ["Complete " + "Adventurer", "sourcebook title"],
  ["Complete " + "Arcane", "sourcebook title"],
  ["Complete " + "Divine", "sourcebook title"],
  ["Complete " + "Warrior", "sourcebook title"],
];

const forbiddenPatterns = [
  { pattern: /[A-Z]:\\/i, label: "absolute local Windows path" },
  { pattern: /AppData[\\/]+Local[\\/]+FoundryVTT/i, label: "private Foundry data path" },
  { pattern: /Data[\\/]+worlds[\\/]+/i, label: "private Foundry world path" },
  { pattern: /\bpage\s+\d+\b/i, label: "page-number citation marker" },
  { pattern: /\bp\.\s*\d+\b/i, label: "page-number citation marker" },
];

const mediaExtensions = new Set([
  ".apng",
  ".avif",
  ".flac",
  ".gif",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".ogg",
  ".otf",
  ".png",
  ".svg",
  ".ttf",
  ".wav",
  ".webm",
  ".webp",
]);

const textExtensions = new Set([
  ".css",
  ".hbs",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".txt",
  ".yaml",
  ".yml",
  "",
]);

const errors = [];

const allowedMediaPatterns = [
  /^docs\/assets\/foundry-page\/[a-z0-9-]+\.png$/,
];

function toRelative(fullPath) {
  return path.relative(root, fullPath).replaceAll(path.sep, "/");
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist"].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const relativePath = toRelative(fullPath);
    const extension = path.extname(entry.name).toLowerCase();

    if (mediaExtensions.has(extension)) {
      if (allowedMediaPatterns.some((pattern) => pattern.test(relativePath))) continue;
      errors.push(`${relativePath}: bundled media asset is not allowed in this public-safe package`);
      continue;
    }

    if (!textExtensions.has(extension)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const isOgl = relativePath === allowedOglPath;

    for (const [needle, label] of forbiddenText) {
      if (isOgl && needle === "Wiz" + "ards") continue;
      if (content.includes(needle)) errors.push(`${relativePath}: contains ${label}`);
    }

    for (const { pattern, label } of forbiddenPatterns) {
      if (pattern.test(content)) errors.push(`${relativePath}: contains ${label}`);
    }
  }
}

walk(root);

for (const asset of requiredScreenshotAssets) {
  const relativePath = `docs/assets/foundry-page/${asset}`;
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${relativePath}: missing required live Foundry screenshot asset`);
    continue;
  }

  const stat = fs.statSync(fullPath);
  if (stat.size <= 0) errors.push(`${relativePath}: screenshot asset is empty`);
}

const requiredPublicText = [
  {
    file: "README.md",
    text: `- Module version: \`${currentVersion}\``,
  },
  {
    file: "README.md",
    text: `release-manifest-ready for stable version \`${currentVersion}\``,
  },
  {
    file: "docs/FOUNDRY_PACKAGE_DESCRIPTION.html",
    text: `Module version: ${currentVersion}.`,
  },
  {
    file: "docs/RELEASE_AUDIT.md",
    text: `Updated: 2026-05-23 for \`v${currentVersion}\``,
  },
  {
    file: "docs/RELEASE_AUDIT.md",
    text: `release \`manifest\` and \`download\` URLs for tag \`v${currentVersion}\``,
  },
  {
    file: `docs/release-notes/v${currentVersion}.md`,
    text: `# v${currentVersion}`,
  },
  {
    file: "module.json",
    text: `/releases/download/v${currentVersion}/${moduleId}-v${currentVersion}.zip`,
  },
];

for (const asset of requiredScreenshotAssets) {
  requiredPublicText.push({
    file: "docs/FOUNDRY_PACKAGE_DESCRIPTION.html",
    text: `docs/assets/foundry-page/${asset}`,
  });
}

for (const requirement of requiredPublicText) {
  const fullPath = path.join(root, requirement.file);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${requirement.file}: missing required public file`);
    continue;
  }

  const text = fs.readFileSync(fullPath, "utf8");
  if (!text.includes(requirement.text)) {
    errors.push(`${requirement.file}: missing required public guidance: ${requirement.text}`);
  }
}

if (errors.length > 0) {
  console.error("Public surface check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Public surface check passed.");
