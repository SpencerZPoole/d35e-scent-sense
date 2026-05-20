# D35E Scent Sense

`d35e-scent-sense` is a Foundry Virtual Tabletop module for the D35E system. It adds conservative 3.5e SRD Scent support for tokens and actors, including presence alerts, optional owner/GM range rings, and 5 ft pinpoint detection.

This repository contains module code, public-safe documentation, and validation tooling only. It does not include copied rulebook prose, stat blocks, adventure text, setting lore, compendium data, artwork, audio, fonts, or private campaign material.

## Compatibility

- Foundry Virtual Tabletop: minimum `14`, verified `14.361`
- D35E system: minimum `3.0.2`, verified `3.0.2`
- Module version: `0.1.1`

## Release Status

This repository is release-manifest-ready for version `0.1.1`.

Install through this manifest URL:

```text
https://github.com/SpencerZPoole/d35e-scent-sense/releases/latest/download/module.json
```

For development testing, copy or clone this folder into your Foundry `Data/modules` directory, then enable **D35E Scent Sense** in a D35E world.

## Features

- Registers `scent` as a D35E sense label when the D35E system is active.
- Adds a Foundry detection mode for 5 ft Scent pinpoint handling.
- Reads Scent range from actor senses or active item senses.
- Adds owner/GM-local Scent range rings.
- Sends owner and GM alerts for presence, direction requests, and pinpoint events.
- Keeps GM adjudication in the loop for direction and exact-location calls.

## Usage

Give a D35E actor a positive Scent range through the actor sense data or an active item sense value. The module uses `30` as the default SRD-derived Scent range where its own helper constants are needed, and `5` for pinpoint handling.

The module exposes `game.d35eScentSense` after initialization:

```js
game.d35eScentSense.getScentRange(actor);
game.d35eScentSense.hasScent(actor);
game.d35eScentSense.refresh({ persist: true });
```

## Content And License Boundary

Original code and documentation are licensed under MIT. SRD-derived Scent mechanics are handled under the Open Game License v1.0a; see `OGL-1.0a.txt`.

This module is an independent community module. It is not affiliated with Foundry Gaming LLC, the D35E system maintainers, or any tabletop publisher.

## Public Safety Checks

Run the local validation suite before publishing or packaging:

```bash
npm test
```

The checks verify manifest structure, required legal files, script syntax, and public-surface cleanliness.
