# Release Process

Use this checklist for public releases.

## Local Gates

1. Confirm `module.json`, `package.json`, docs, validation expectations, and changelog all use the target version.
2. Run `npm run validate`.
3. Run the local security gate.
4. Build release assets with `npm run build:release`; confirm the zip is named `d35e-scent-sense-vX.Y.Z.zip` with `module.json` at archive root.
5. Inspect the zip for forbidden content: `.git`, `node_modules`, world data, packs, media, fonts, copied source prose, and private paths.

## Publish

1. Commit the release changes on `main`.
2. Tag the commit as `vX.Y.Z`.
3. Push `main` and the tag.
4. Create a GitHub release with two assets: `module.json` and the release zip.
5. Publish the same version to the Foundry package listing with `npm run publish:foundry` or the GitHub Release workflow.

## Post-Publish Gates

1. Download the latest manifest and release zip from GitHub.
2. Confirm the manifest version, manifest URL, download URL, socket flag, and compatibility metadata.
3. Unpack the zip into a temporary folder and run `npm run validate` from the extracted artifact.
4. Install the downloaded artifact in the scratch Foundry world.
5. Run GM runtime smoke tests for APIs, actor-sheet Scent setup, no-Scent behavior, Scent Menu source creation/editing, Source leaves trail movement recording, View Scent Trails, masking odor suppression, false odor/tag helper data, scan behavior, migration dry-run, cleanup, and runtime events.
6. Confirm the public Foundry package page shows the target version, verified Foundry compatibility, release manifest/download links, package description, and live Foundry screenshots.

Do not use a live campaign world for release validation unless a later plan explicitly approves it. Public screenshots must be captured from a live Foundry app session, preferably in a neutral scratch world with temporary data that is cleaned up afterward.
