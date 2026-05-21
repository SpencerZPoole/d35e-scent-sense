# RAW Coverage Matrix

This matrix tracks how `d35e-scent-sense` maps 3.5e SRD Scent rules into Foundry behavior. It is intentionally conservative: when a rule needs table judgment, the module should assist the GM instead of silently replacing that judgment.

References checked:

- 3.5e SRD Scent special ability: https://www.d20srd.org/srd/specialAbilities.htm#scent
- 3.5e SRD Survival skill: https://www.d20srd.org/srd/skills/survival.htm
- 3.5e SRD Track feat: https://www.d20srd.org/srd/feats.htm#track

## Current Coverage

| Rule Area | v1.0.0 Status | Notes |
| --- | --- | --- |
| Scent sense registration | Automated | Registers `scent` as a D35E sense label when the D35E system is active. |
| Default detection range | Automated | Uses `30 ft` as the module default helper value and reads configured D35E prepared actor, base actor, and eligible item Scent ranges when present. |
| Upwind and downwind ranges | Automated helper | `scent-rules.js` computes normal, upwind, and downwind effective ranges. |
| Strong and overpowering odors | Automated helper | Effective range multipliers are implemented and exposed through API/context/profile flags. |
| Masking odor | Automated helper | Detection helper suppresses detection when masking odor is active; GM controls the context/profile. |
| Presence without exact location | Automated state and alert | Owner alerts communicate presence without target identity. |
| Direction as a move action | GM-assisted state | Player can request direction; the module whispers the GM supporting details and tracks requested/revealed status. It does not spend or audit actions automatically. |
| Pinpoint within 5 ft | Automated alert | The module identifies the pinpoint band and shows owner/GM cues. |
| Track feat requirement | Automated helper | `canTrackByScent` requires Scent plus a Track feat item. |
| Tracking DC by Scent | Automated helper | Helper computes fresh-trail, cold-trail, competing-odor, odor modifier, and water-state values. |
| Survival roll workflow | GM-assisted prompt | Trail helper computes the DC and can create a redacted GM/owner prompt; native skill rolling is best-effort when the actor exposes a compatible method. |
| Persistent trails | GM-authored scene records | The Trail Manager and API store scene-level trails under module-owned flags; movement does not automatically create trails. |
| Familiar odor identification | GM-facing helper | Odor tags and familiar tag matching are exposed through API helpers and the GM context manager; player identity is not revealed automatically. |
| Water and water-breathing UI | GM-facing trail controls | Trail records include water state and preview DC impact for selected trackers. |
| False/powerful odor sources | GM-facing helper | False odor flags and strong/overpowering odor profile fields are available for GM context and preview details. |
| Surface and visibility modifiers while scent-tracking | Explicitly ignored for Scent trail DCs | Trail DC helpers model Scent-specific age, water, competing odor, and odor modifier inputs without applying normal surface or visibility categories. |

## V1 Stable Statement

`v1.0.0` can say:

- Automated detection covers range, wind, odor strength, masking odor, presence, direction requests, and 5 ft pinpoint.
- GM tools cover scene and token scent context, false odor flags, and odor tags without editing actor flags unexpectedly.
- Tracking support covers persistent trails, Scent-specific DCs, Track eligibility, and optional Survival roll prompts.
- Public docs clearly identify which pieces are automated, which are GM-assisted, and which remain manual table adjudication.

## Stable Release Notes

`v1.0.0` does not add new RAW automation after the release-candidate line. It publishes the documented API, user workflow, release process, localization validation, and scratch-world-tested behavior as the stable public release.
