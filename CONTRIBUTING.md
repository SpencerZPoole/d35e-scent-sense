# Contributing

Thanks for helping improve D35E Scent Sense.

## Content Boundary

Keep this repository public-safe:

- Do not add copied rulebook prose.
- Do not add stat blocks, compendium packs, adventure text, setting lore, scans, artwork, audio, fonts, or private campaign material.
- Keep rules references short and SRD-derived.
- Keep GM adjudication notes generic and system-focused.

## Development Checks

Run the validation suite before opening a pull request:

```bash
npm test
```

Changes should preserve the public API exposed through `game.d35eScentSense` unless a breaking change is clearly documented.

For behavior that depends on Foundry UI, canvas rendering, token movement, chat, or document flags, pair Node validation with a live Foundry smoke test when practical. Keep reproduction notes public-safe and avoid campaign names, world data, chat logs, local paths, and player-identifying details in public issues or pull requests.
