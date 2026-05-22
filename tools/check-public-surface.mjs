import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedOglPath = "OGL-1.0a.txt";

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

if (errors.length > 0) {
  console.error("Public surface check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Public surface check passed.");
