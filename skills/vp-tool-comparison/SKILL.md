---
name: vp-tool-comparison
description: >-
  Compare automation tools or competing interfaces by scenario, verify capability
  claims, preserve reusable evidence, and derive conditional routing rules.
  Use for a tool PK, capability matrix, or evidence-based routing revision.
  Boundary: not an installation workflow or a synthetic universal leaderboard.
---

# Tool Comparison

Produce a comparison another agent can audit and refresh. A product's claim,
implementation, installed version, and observed outcome are different evidence.

## Frame the comparison

Define the intended outcome, target OS/apps, authorization, and binding needs
before choosing winners. Compare tools at the same layer: a harness-integrated
driver, standalone CLI, and model-backed autonomous agent have different costs
and policy boundaries. Keep browser DOM work distinct from desktop UI work.

Choose representative scenarios that could change the decision: ordinary UI,
background operation, exact-window targeting, custom-rendered content, system
surfaces, unavailable permissions, stale targets, retry uncertainty, and cleanup.
Use the subset relevant to the request; do not expand research into installing
software, changing permissions, or operating private applications without scope.

## Establish evidence

Inspect current local inventory and official sources. Pin source revisions or
release versions; record observation time with timezone, host/adapter, permission
context, resolved native executable when a launcher is involved, and source links. Inspect implementation when docs disagree or when a
boundary matters. A test found in a repository is source evidence until executed.

For each material claim retain:

| Field | Required meaning |
| --- | --- |
| Claim and scope | Exact command, OS, app/window, mode, and outcome predicate |
| Evidence class | Documented, source-inspected, locally observed, contradicted, or unknown |
| Basis | Version/revision, date, primary link or sanitized local evidence |
| Limits | Missing permissions, absent installation, untested apps or platforms |
| Routing consequence | Which candidate becomes eligible, preferred, or excluded, and why |

“Confirmed documented” means the source makes that claim. It does not mean the
behavior worked locally. “Not installed” means unavailable here, not unsupported
by the product. Preserve conflicting claims and resolve only what evidence
allows. Do not promote unknowns to negative capability claims.

## Run discriminating checks

Prefer a small reversible fixture with an observable initial state, one action,
readback, and restoration. Use the same task and initial conditions for each
candidate. Record skips and setup failures separately from action failures.
Refresh identifiers through the acting interface, never copy them between tools.

Distinguish semantic AX actions, window-routed synthetic events, shared-pointer
input, and clipboard use. Labels such as headless or background do not prove
focus, pointer, clipboard, or isolation guarantees. Measure those separately if
the decision depends on them. Observe an uncertain result before retrying.

Distinguish endpoint samples from a continuous event trace. Movement during a
shared-desktop trial does not identify who caused it; mark attribution unknown
and use a short discriminating control when useful. Treat visible-cursor
presentation separately from movement of the user's physical pointer. Compare
the intended cursor-enabled configuration too, not only a faster invisible mode.

When setup reports success but the output is absent, separate saved configuration,
worker startup/handshake and actual visible output. If source inspection identifies
a testable condition, use an isolated one-variable fail/pass/revert check with the
same payload and binary bytes. Record the cause only when the observed reversal
supports it. A diagnostic copy is not a repaired installation.

Use owned fixture data for writes. Track task-created processes, snapshots,
windows, and sessions; restore state and use documented teardown. Never stop
shared services to manufacture a clean result. Report unavailable teardown.

If an uncertain external behavior determines the design, use `vp-minimal-repro`
when available before broader testing. Do not repeat expensive full-system runs
without a new discriminating question.

Compare latency or token cost only after equivalent correctness. Record sample
count, warm/cold state, payload shape, and measurement boundary. A tool-call
duration is not model-inclusive task latency; bytes are not token counts. Without
comparable measurements, report costs as unmeasured rather than inventing scores.

## Derive routing and preserve the result

Reject candidates that violate authorization, policy, platform, target, or
required state. Rank eligible candidates by semantic reliability, result
verification, contention, repeatability, then measured operational cost. Explain
ties and preserve explicit user priorities; a microbenchmark does not override
them. Retain an integrated default when no evidence warrants changing it.

Prefer scenario-specific rules to a single product ranking. Each rule needs
prerequisites, an expected result, fallback eligibility, and a stop condition.
An absent optional candidate must not become a mandatory install. A fallback
must satisfy the original constraints and cannot bypass an action denial.

Save durable findings in the requested repository research directory or document,
separate from skill execution instructions; keep private raw
captures out of public artifacts. Link evidence near each claim and state what
should trigger a refresh, such as a version, OS, permission, or target-app change.
Keep findings separate from routing recommendations. Update all active routing
surfaces together so adapters and diagrams cannot retain an opposing order.

Exercise the changed rules with representative positive, unavailable, conflict,
and failure cases. Separate executable policy checks, manual decision walkthroughs,
and independent agent trials; none alone establishes live application behavior.
Report completed work, remaining unknowns, and whether user action is needed.
