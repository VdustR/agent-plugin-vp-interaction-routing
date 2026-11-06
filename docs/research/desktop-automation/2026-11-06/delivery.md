# Delivery record

Observed November 6, 2026, Asia/Taipei. User authorization: “auto dev to merge”
for the desktop-tool research, actual verification, comparison/routing refresh
and delivery. Temporary working notes and local raw evidence were kept in a
single task-owned scratch directory outside the repository; this document is
the sanitized durable record.

## Delivery brief and pre-implementation checkpoint

| Gate | Baseline decision and evidence |
| --- | --- |
| Acceptance | Complete released agent-desktop delta since tested 1.0.1; real owned-fixture checks of available native drivers/new MCP; compare browser routes separately; update evidence and justified routing; merge verified result |
| Base / ownership | main; authenticated VdustR; repository admin/push verified; no CODEOWNERS or alternate integration owner |
| Protection / review | main protection returned “Branch not protected”; rulesets empty; no size cap or PR template found. Self-review, complete feedback snapshot and current-head CI remain required |
| Deployment / release | Only Validate workflow on PR and main, with npm ci / npm run validate; no deploy/publish/tag workflow. Consumer metadata synchronized to 0.4.2; no separate binary release needed |
| Delivery unit | One coherent unit: research, owned fixture reproduction, routing wording/diagrams and version sync. One review must assess evidence and resulting advice together |
| Host prerequisites | No goal created because no explicit goal-creation request. No PR-monitor tool exposed; bounded in-turn status waits cover CI. No user-only permission/install prerequisite |
| Delivery authority | Existing AUTO authorization includes branch, commit, push, Draft/Ready and merge; no private app writes, global tool updates or permission changes |

Pre-implementation checkpoint: no unresolved or blocking question and no
required communication awaiting a reply. Planned future verification remains a
mandatory later gate, not an already-passing check.

| ID | Matter and risk | Resolution fixed before edits | Disposition |
| --- | --- | --- | --- |
| C1 | Entry wrapper/native/helper/version can differ | Pin executable configurations and compare wrapper with same-byte official native copies separately | Resolved |
| C2 | One macOS host cannot exercise every change | Complete released/source inventory; explicitly retain Windows/Linux, visual and unsupported-environment limits | Resolved scope |
| C3 | Native and browser products serve different layers | Same native fixture for native drivers, separate DOM evidence; no common leaderboard | Resolved scope |
| C4 | Cursor success can be a false positive | Use basename fail/pass/revert and renderer evidence; no new human-visibility claim | Resolved evidence boundary |
| C5 | Shared hosts/sessions must be preserved | Private agent-desktop state, owned fixtures and exact snapshots; inspect ownership before helper teardown | Resolved safety |

## Verification

The [comparison](comparison.md) and [observations](observations.json) distinguish
source evidence, actual driver actions, independent fixture readback and
unverified claims. The committed CLI runner passed against agent-desktop and
Peekaboo; AdvancedFixture compiled and executed. Both live old-ref cases were
repeated: removing a twin refused without retargeting, while a retained hidden
window still accepted the same target's action. A wrong probe expectation or
syntax is not a product regression.

No production routing evaluator changed. The generated diagrams expose two
adapters of the existing agent-desktop candidate. Existing routing tests cover
the unchanged candidate ordering/constraints. Manual instruction walkthroughs
were repeated with distinct ordinary scenarios; neither pass is an independent
agent experiment:

| Decision scenario | Old guidance gap / discriminating mechanism | Pass A | Pass B |
| --- | --- | --- | --- |
| Native work, first-party capable | Existing priority must survive CLI/MCP availability | First-party retained | Retained with cursor preference |
| Headless MCP native work | New fixed-global constraint, not one-call headed override | Read schemas/startup scope | Refuse per-call mode substitution |
| MCP absent or wrong namespace | CLI installation is not registration; session creation does not rebind server | Mark unavailable | Keep original namespace/constraints |
| Window hidden after prior read | Retained object is not visibility proof | Reobserve visible intended window | No mutation from hidden cached ref |
| Control absent in partial snapshot | Successful response can still be incomplete | Inspect complete/truncated | Raise budget or drill, no false absence |
| Action/policy refusal | Delivery success must not come from unauthorized escalation | Stop affected action | Preserve refusal across adapters |

Mechanism and outcome were scored separately in each walkthrough: selection,
namespace/mode inspection, freshness/completeness, readback and stop behavior all
passed; actual agent selection under blind conditions remains untested. The
unchanged prose could miss the new MCP globals or overgeneralize old dated
hidden-ref/cursor evidence. Live MCP refusal, partial-snapshot and retained-ref
probes establish those premises separately from the walkthrough outcomes.

Repository validation: 87 passed, 12 intentionally skipped live bridge tests,
zero failures. Codex used its first-party native tool for actual UI checks;
`CODEX_CUA_BRIDGE_CODEX_BIN` pointed at a deliberately absent task-local path
only for the documented routing-only validation skip. This does not verify live
bridge behavior or every harness's discovery/agent behavior.

## Reconciliation and integration

The integration gate requires final current-head CI, complete feedback pagination
and merge readback on the delivery PR. Local verification above is complete; the
final PR and merge state are reported in the delivery reply and GitHub metadata.
No external escalation was required. A normal revert of the merged unit remains
the rollback path.

Installed plugin copies and the pre-existing local agent-desktop wrapper are
outside this repository change and are not synchronized by a merge. No dotfile
was changed. Source-only and visual/platform coverage limits are listed in the
comparison; they do not represent promised in-scope implementation work.

## Cleanup receipt and confirmation comparison

Both owned fixture processes exited after graceful close requests. The private
agent-desktop manifest session was sealed; its renderer socket count was zero.
An earlier ad-hoc snapshot namespace had no manifest and thus no live session to
end; its files remain only in local scratch. MCP servers exited and their
sessions were explicitly ended. agent-browser closed and listed no sessions.
All 55 exact task-owned Peekaboo snapshot cleanup requests succeeded; in-memory
state ended with the owned on-demand daemons. Both version-specific daemons
reported running false and their PIDs were gone. The pre-existing Peekaboo MCP
process and GUI host were preserved. Codex's documented App API has no native
end/disconnect operation: completion_summary was acknowledged, but native
service teardown remains unverified; the client Stop control releases it.

Pre-integration comparison against C1–C5: scope, decisions and deferral reasons
are unchanged. Newly observed hidden-ref, row-selection and browser-policy
limits fit the original evidence boundaries; no deferred implementation or
required human decision was introduced. No session TODO, external escalation or
unresolved confirmation remains. Installed-copy synchronization is outside the
requested repository delivery. The final integration gate still requires the
current-head PR checks and complete feedback snapshot.
