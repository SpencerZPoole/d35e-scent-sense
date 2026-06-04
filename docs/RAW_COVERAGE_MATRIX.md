# RAW Coverage Matrix

This matrix tracks how `d35e-scent-sense` maps 3.5e SRD Scent rules into Foundry behavior. It is intentionally conservative: when a rule needs table judgment, the module should assist the GM instead of silently replacing that judgment.

References checked:

- 3.5e SRD Scent special ability: https://www.d20srd.org/srd/specialAbilities.htm#scent
- 3.5e SRD Survival skill: https://www.d20srd.org/srd/skills/survival.htm
- 3.5e SRD Track feat: https://www.d20srd.org/srd/feats.htm#track

## Current Coverage

| Rule Area | Current Status | Notes |
| --- | --- | --- |
| Scent sense registration | Automated | Registers `scent` as a D35E sense label when the D35E system is active. |
| Default detection range | Automated | Uses `30 ft` as the module default helper value and reads configured D35E prepared actor, base actor, and eligible item Scent ranges when present. |
| Upwind and downwind ranges | Automated helper | `scent-rules.js` computes normal, upwind, and downwind effective ranges. |
| Strong and overpowering odors | Automated helper | Effective range multipliers are implemented and exposed through API/context/profile flags. |
| Masking odor | Automated helper | Detection helper suppresses detection when masking odor is active; GM controls the context/profile. |
| Presence without exact location | Automated state and alert | Owner alerts communicate presence without target identity and are private owner+GM whispers. |
| Direction as a move action | GM-assisted state | Player can request direction; the module whispers the GM supporting details privately and tracks requested/revealed status. It does not spend or audit actions automatically. |
| Pinpoint within 5 ft | Automated alert | The module identifies the pinpoint band and creates redacted owner+GM alerts plus GM-only detail cards. |
| Track feat requirement | Automated helper | `canTrackByScent` requires Scent plus a Track feat item. |
| Tracking DC by Scent | Automated helper | Helper computes fresh-trail, cold-trail, competing-odor, odor modifier, and water-state values. |
| Survival roll workflow | GM-assisted prompt | Trail helper computes the DC and creates private redacted owner prompts plus GM-only detail prompts by default. Native skill rolling is explicit API opt-in. |
| Persistent trails | GM-authored visual scene records | The Scent Menu and API store scene-level Scent Sources under module-owned flags. Once the GM creates a source with **Source leaves trail** enabled, source-token movement appends path segments. |
| Familiar odor identification | Advanced GM-facing helper | Odor tags and familiar tag matching are exposed through API helpers and Advanced GM details on Scent Sources; player identity is not revealed automatically. |
| Water and water-breathing UI | GM-facing source controls | Source records include water state for tracking helper DC impact. |
| False/powerful odor sources | Mixed | Strong and overpowering odor strength modify effective range. False odor is advanced GM metadata and does not change range, suppress detection, or reveal/lie to players automatically. |
| Surface and visibility modifiers while scent-tracking | Explicitly ignored for Scent trail DCs | Trail DC helpers model Scent-specific age, water, competing odor, and odor modifier inputs without applying normal surface or visibility categories. |

## V1 Stable Statement

Current `v1.x` behavior can say:

- Automated detection covers range, wind, odor strength, masking odor, presence, direction requests, and 5 ft pinpoint.
- Automated chat output is private by default: player-facing cards stay redacted and secret-bearing GM detail cards are GM-only.
- GM tools cover source-specific wind, odor strength, and masking odor in the main Scent Source workflow. False odor flags and odor tags remain available as advanced helper data without editing actor flags unexpectedly.
- Tracking support covers Scent Sources that leave trails, visual path segments, Scent-specific DC helper APIs, Track eligibility, and age-based fade states.
- Public docs clearly identify which pieces are automated, which are GM-assisted, and which remain manual table adjudication.

## Stable Release Notes

`v1.2.2` preserves the documented conservative RAW boundary from `v1.2.0` while hardening Scent chat confidentiality and wall-respect fail-closed behavior.
