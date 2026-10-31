# Desktop Automation Research

Maintain versioned observations and PK results here, outside skill execution
content. These reports are evidence for maintenance, not runtime inventory or
an instruction to read every experiment before interacting with an app.

The current routing authority is the skill's
[native decision tree](../../../skills/vp-interaction-routing/references/native-decision-tree.md)
and [priority data](../../../skills/vp-interaction-routing/references/native-route-order.json).
Every harness prefers its own first-party tool; Codex's tool identity and bridge
exclusion are explicit. Historical timings do not
override explicit user preferences, authorization or current capability checks.

## Records

| Observation date | Report | Supporting data | Scope |
| --- | --- | --- | --- |
| October 31, 2026, Asia/Taipei | [Primary-source comparison](2026-10-31/source-comparison.md) | [Initial observations](2026-10-31/initial-observations.json) | Initial docs/inventory research before the agent-desktop installation |
| October 31, 2026, Asia/Taipei | [Live PK and cursor diagnosis](2026-10-31/live-pk.md) | [PK observations](2026-10-31/pk-observations.json) | Installed drivers, owned AppKit fixture, cursor basename fail/pass/revert, human visibility confirmation and cleanup |

The second record supersedes the first record's local agent-desktop availability
finding. It does not turn an old binary, source contract or single-app success
into a current product-wide guarantee. The unchanged npm installation's cursor
bug and the temporary correctly named copy remain separate configurations.

## Updating the evidence

1. Read the relevant dated record and identify which premise changed: binary or
   resolved executable, host protocol, OS, permissions, target app or requirement.
2. Use `vp-tool-comparison` and the smallest relevant fixture. Record observation
   time/timezone, exact versions, initial state, outcome and evidence limits.
   Keep source claims, actual actions and human observations distinct.
3. Add a dated directory for a new observation date. For a same-day follow-up,
   retain the prior phase and label the new configuration or correction rather
   than silently replacing conflicting results. Update this index and explicit
   supersession links. Do not average unrelated versions/configurations together.
4. Promote only a decision-changing operational rule into the skill. Keep full
   reports, timing samples, raw observations and experiment history here. A
   research update alone does not alter routing priority.
5. If the desired policy changes, update the skill's `native-route-order.json`,
   regenerate the diagrams, and exercise representative selection/fallback cases.
   Run the repository validation; distinguish policy tests from live UI trials.

Retain only de-identified evidence. Raw private desktop captures, account data,
clipboard contents and unrestricted menu histories do not belong in this tree.
The owned [fixture and cursor reproduction](../../../fixtures/desktop-pk/README.md)
make the relevant setup repeatable without retaining private application state.
