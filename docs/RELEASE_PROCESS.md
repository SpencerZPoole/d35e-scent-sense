# Release Process

Use this checklist for public releases.

## Local Gates

1. Confirm `module.json`, `package.json`, docs, validation expectations, and changelog all use the target version.
2. Run `npm test`.
3. Run the local security gate.
4. Build a zip named `d35e-scent-sense-vX.Y.Z.zip` with `module.json` at archive root.
5. Inspect the zip for forbidden content: `.git`, `node_modules`, world data, packs, media, fonts, copied source prose, and private paths.

## Publish

1. Commit the release changes on `main`.
2. Tag the commit as `vX.Y.Z`.
3. Push `main` and the tag.
4. Create a GitHub release with two assets: `module.json` and the release zip.

## Post-Publish Gates

1. Download the latest manifest and release zip from GitHub.
2. Confirm the manifest version, manifest URL, download URL, socket flag, and compatibility metadata.
3. Unpack the zip into a temporary folder and run `npm test` from the extracted artifact.
4. Install the downloaded artifact in the scratch Foundry world.
5. Run GM runtime smoke tests for APIs, context manager, trail manager, scan behavior, migration dry-run, cleanup, and runtime events.

Do not use a live campaign world for release validation unless a later plan explicitly approves it.
