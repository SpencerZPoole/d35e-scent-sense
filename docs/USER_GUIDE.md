# User Guide

`d35e-scent-sense` is a conservative GM aid for Scent in D35E worlds. It automates repeatable range and state checks, then leaves table-judgment calls visible to the GM.

## Install

Use the release manifest URL:

```text
https://github.com/SpencerZPoole/d35e-scent-sense/releases/latest/download/module.json
```

Enable **D35E Scent Sense** in a D35E world after installation.

## Give A Token Scent

The module reads Scent from D35E actor sense data and eligible item sense data. A positive range makes the actor a Scent source. The module also syncs a `scentPinpoint` token detection mode at the 5 ft pinpoint range.

Use `game.d35eScentSense.getScentRangeBreakdown(actorOrToken)` when a token does not behave as expected. The diagnostic reports contributing sources, ignored sources, and token sync status.

## Alert Scope

The default alert scope is conservative: unknown hostile targets. In practice, hidden or invisible hostile tokens can trigger owner alerts. GMs can change the scope in module settings to all hostiles, all creatures, or GM-marked hostiles.

## Scent Context

Open **Scent Context** from Token Controls as GM to edit scene defaults and token overrides for:

- wind band
- odor strength
- masking odor
- false odor
- odor tags
- GM-marked Scent relevance

Selecting `inherit` clears that token or scene flag. Actor flags remain readable for inheritance but are not edited by this UI.

## Scent Trails

Open **Scent Trails** from Token Controls as GM to create scene trail records. Trails are not generated from movement automatically. A trail can store age, water state, competing odor, odor modifier, source references, notes, and an odor profile snapshot.

The Trail Manager can preview DCs for a selected scent-capable tracker and create a redacted Survival prompt. Player-facing prompts do not reveal hidden trail source details by default.

## What Remains Manual

The module does not spend actions, decide every direction call, identify hidden creatures for players, or create movement trails automatically. Those calls remain GM-adjudicated.
