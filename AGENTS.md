# AGENTS.md - d35e-scent-sense

## Project Guidance

- Keep changes narrow, compatible with Foundry VTT 14 and the D35E system, and aligned with the existing module structure.
- Treat README, docs, screenshots, release notes, `module.json`, and the Foundry package page as release surfaces, not afterthoughts.
- Do not use AI-generated, staged, or mock screenshots for public module documentation. Use live Foundry screenshots from a running app session whenever screenshots are updated.
- Before calling public user documentation complete, walk through the first-run human setup path from an empty actor: install/enable the module, open the D35E actor sheet, add Scent through **Attributes > Senses > pencil > Scent**, place/select a token, verify the module diagnostic sees the range, and make sure the docs tell that story plainly.
- Keep public wording aligned with the current table workflow: one **Scent Menu**, **Create New Scent Source**, **Scene Scent Sources**, **Source leaves trail**, and a separate **View Scent Trails** overlay toggle. Avoid reintroducing old standalone context-window or tracker-preview language unless describing historical compatibility.
- Document the live-tested mechanic boundary plainly: masking odor suppresses Scent detection, while false odor, odor tags, and notes are advanced GM helper data unless a future workflow gives them a clearer table action.
- Follow the official Foundry VTT module-development guidance when changing manifest metadata, compatibility, module structure, release packaging, or installation URLs: https://foundryvtt.com/article/module-development/
- A public release is not complete after pushing GitHub tags alone. Publish or verify the matching version on the Foundry VTT package listing using the package release workflow/API, then confirm the public package page shows the expected version, compatibility, manifest link, download link, and description.

## Validation

- Run `npm run validate` before release.
- Run `npm run build:release` before publishing release assets.
- Run the local security gate after code, package, release, or documentation changes that could affect public packaging or credential safety.
