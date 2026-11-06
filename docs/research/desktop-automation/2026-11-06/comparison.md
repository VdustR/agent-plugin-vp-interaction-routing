# Desktop and browser comparison refresh

Observed November 6, 2026, Asia/Taipei, on macOS 26.6.2 ARM64. This refresh covers
agent-desktop **1.0.1 → 1.2.0**, adds its MCP adapter, reruns the existing native
drivers and includes browser routes at their own layer. It supersedes the
[October 31 live PK](../2026-10-31/live-pk.md) only for the configurations and
scenarios rerun below. Historical human cursor confirmation remains historical.

## Result and routing decision

Keep the existing order: the current harness's first-party Computer Use,
capable agent-desktop, an eligible healthy registered Codex bridge outside
Codex, then Peekaboo. No result justifies changing that preference or deleting
Peekaboo. Treat agent-desktop CLI and registered MCP as two adapters of the same
candidate; verify their different invocation, mode and session constraints.

The decision trees now name both adapters. Execution guidance adds current
cursor limits, partial-observation handling and retained-ref visibility checks.
It does not add automatic installation, registration, physical-input escalation,
or a route around an action denial.

## Version and source coverage

The [complete change inventory](change-inventory.md) covers all **49 released
commits**, including 1.0.2, 1.1.0 and 1.2.0, plus two newer main commits kept
separate as unreleased source evidence. Release dates are October 30, November 3
and November 5 respectively (UTC). The prior installed runtime was 1.0.1 even
though 1.0.2 was already released. All 44 linked release PRs and their discussion
were read; substantive corrections shaped the identity, wait, timeout and
installation checks. Windows/Linux changes and unexercised visual details are
explicitly classified rather than reported as locally verified.

| Candidate | Configuration actually exercised |
| --- | --- |
| Codex first-party | Current session's native `cua_repl` App API; no Codex bridge |
| agent-desktop CLI | Installed 1.2.0 / JSON 2.6; existing local wrapper invokes a version-local symlink named `agent-desktop` with the official paired npm helper |
| agent-desktop MCP | Same installed bytes; task-local stdio server with an explicit private session and headless globals; no persistent MCP registration |
| Peekaboo installed | CLI 4.4.0, source d82dbd888; observations selected its matching on-demand host |
| Peekaboo task-local | Official signed 4.9.8 ARM64 archive, source 70dbc4183; observations/actions selected matching 4.9.8 on-demand host; installed CLI/app untouched |
| agent-browser | Installed 0.41.2; new isolated named session and owned file page; no user profile/login |

The Peekaboo archive was 15.5 MB, verified against the release checksum and
`codesign --verify --strict`; signer was OpenClaw Foundation. The 30 GiB available
space exceeded the bounded archive/extraction allowance of 0.2 GiB. Nothing was
installed globally. The currently granted agent-desktop Accessibility/Screen
Recording permissions were reused; Automation remained unknown. Peekaboo's
permission query could select the pre-existing 4.4.0 GUI host, so that query
alone is not permission evidence for the later matching on-demand hosts.

## Same native task

The unchanged [original AppKit fixture](../../../../fixtures/desktop-pk/README.md)
provided an independent logical-state witness. Each round was full observation
at 0, Increment, fresh observation at 1, Reset, fresh observation at 0. Text and
checkbox writes were also read through the acting driver and the witness. There
were three serial warm rounds per configuration; binding/setup was excluded.

| Configuration | Completed rounds | Median driver time | Range |
| --- | --- | --- | --- |
| Codex first-party, full reads | 3/3 | 1.718 s | 1.685–1.870 s |
| agent-desktop CLI, overlay off | 3/3 | 1.110 s | 1.106–1.242 s |
| agent-desktop CLI, wrapper + renderer enabled | 3/3 | 1.659 s | 1.633–1.752 s |
| agent-desktop MCP, persistent stdio connection | 3/3 | 1.172 s | 1.017–1.665 s |
| Peekaboo 4.4.0, AX-only reads | 3/3 | 4.584 s | 4.558–4.623 s |
| Peekaboo 4.9.8, AX-only reads | 3/3 | 11.557 s | 11.405–11.578 s |

These are configuration samples, not an isolated performance regression or a
universal ranking. Every CLI includes process/launcher startup; Codex reuses an
App binding, and MCP still spawns one CLI child per call. Order was not randomized
or interleaved. Shared-desktop load, host versions, observation representations
and cursor settings differ. Driver time excludes model reasoning and outer
harness round trips. Serialized characters are retained in the JSON only as
representation sizes; they are not token counts or equivalent across serializers.
The enabled renderer was socket-verified, not newly human-confirmed visible.

An initial Peekaboo 4.9.8 cohort accidentally overlapped a fixture reset; it was
excluded in full and rerun serially. Probe argument/setup mistakes were corrected
from live help/inventory and kept separate from product failures. Additional
runs of the committed CLI runner passed without replacing these cohorts.

## Capability and safety results

| Scenario | Codex first-party | agent-desktop 1.2.0 | Peekaboo 4.4.0 / 4.9.8 |
| --- | --- | --- | --- |
| Button, text replacement, checkbox | Fresh AX readbacks and independent witness passed | CLI and MCP passed; AXValue reports element-value verification, not application commit | Both passed; text confirmed, checkbox dispatch still unverified until readback |
| Multiple windows | Existing App binding stayed on Main; no explicit arbitrary-window parameter exposed | Unscoped read refused ambiguity; exact Secondary changed only Secondary | Previous 4.4 exact-window result retained; both current baseline cohorts used exact Main; current Secondary not rerun |
| Identical buttons without native IDs | Not rerun | Two trials selected each exact twin; removing the first ref gave `STALE_REF`, `retained_object_stale`, `not_delivered`; remaining twin unchanged | Not rerun |
| Hidden but retained window element | Not rerun | Two isolated trials still dispatched and incremented hidden Secondary after Reset; Main unchanged | Not rerun |
| Row click versus table selection | Not rerun | Standard table row click reported descendant activation verified but `selectedRow` stayed -1; table `select` changed it to 1 | Not rerun |
| Value changes after wait begins | Not rerun | Two waits observed delayed `seed → arrived`, about 1.1–1.3 seconds inside the wait | Not rerun |
| Explicit snapshot budgets | Not rerun | 300/500 ms returned successful partial trees (551/1544 observed nodes); 3000 ms completed. Shorter setup budgets returned TIMEOUT | Not rerun |
| stdin text | Not applicable to App API | Owned UTF-8 value written/read back; `post_state.value` omitted from command result. Other snapshots remain unredacted | Not rerun |
| Paced text | Not rerun | A field advertising TypeText accepted `Aé👩‍💻` as three graphemes at interval 40 ms via AXSelectedText. A field without it refused headless input before delivery | Not rerun |
| Status/system surfaces | Not rerun | Owned status snapshot + rooted drill passed while its window existed; Dock/menu-bar-extras resolution returned headlessly | Not rerun; specialized Peekaboo capability remains available |
| Exact-window capture | API capability retained; not captured here | Main-window PNG visually inspected: expected owned controls/state | Not rerun |

A retained address proves element identity more narrowly than visibility or the
user's intended action. The hidden-window result differs from 1.0.1's timeout;
it is not a retarget to an unrelated twin. The ordinary table result does not
exercise the new container-only-row mechanism, so that feature remains
source-inspected rather than proven by this fixture. Fresh target observation
and goal-specific readback remain necessary even for `delivered_verified`.

Recorded CLI foreground endpoints were false.
Recorded clipboard change-count deltas were zero; contents were never read. Pointer
endpoints were unchanged for the measured agent-desktop cohorts and changed in
both Peekaboo cohorts. On this shared desktop that does **not** identify the
actor, prove a driver moved the pointer, or exclude transient interference.
No continuous attributed trace was taken.

## Cursor: distinct fixes and remaining failure

The [released spawn implementation](https://github.com/vercel-labs/agent-desktop/blob/2b0a7334fc111730454b726e6800aa41cdafc093/crates/macos/src/system/cursor_overlay/spawn.rs)
starts the renderer with working directory `/`, but still returns success early
unless its executable stem is exactly `agent-desktop`. Thus the working-directory
fix does not repair the npm platform-name condition. The existing identical-byte
[basename probe](../../../../fixtures/desktop-pk/cursor-basename-probe.py) reproduced:

| Invoked filename | `rendered` | Renderer sockets |
| --- | --- | --- |
| `agent-desktop-darwin-arm64` | true | 0 |
| `agent-desktop` | true | 1 |
| `agent-desktop-darwin-arm64` | true | 0 |

The original installed wrapper is a pre-existing local workaround, not the
unmodified npm launcher. Its renderer-enabled workload passed, but this run does
not establish cursor pixels above menus, pill sizing, caret alignment, human
visibility, or macOS 27 behavior. No workaround, installation, dotfile or
permission was changed. Renderer sockets were gone after probe cleanup.

## MCP findings

The new [MCP implementation](https://github.com/vercel-labs/agent-desktop/tree/2b0a7334fc111730454b726e6800aa41cdafc093/src/mcp)
advertised 67 tools and negotiated protocol `2025-11-25`. Version-matched desktop
and platform skills were read through MCP before actions. Schemas use keys such
as `ref_id` and `window_id`; `stdin` is omitted. Each tool runs a CLI subprocess,
so persistent transport does not mean a persistent native command host.

The server fixed its global session/mode at startup. Passing `headed: true` to
`desktop_click` was refused as an unknown argument; the counter stayed zero.
Creating another session would not switch that server's namespace. EOF produced
exit code 0, then an explicit CLI session end and list readback confirmed sealing.
Cancellation sends SIGTERM then a bounded kill in source; no local cancellation,
concurrent drag or rollback trial was performed. A future registered server still
needs its own host/client integration check.

## Other existing routes, compared at their own layer

| Route | Current evidence | Decision boundary |
| --- | --- | --- |
| Purpose-built connector/API/repository CLI | Existing semantic gate retained; no service task in this fixture | Prefer when it completes the exact authorized operation/readback |
| agent-browser 0.41.2 | Owned file page increment, fill, check and reset passed; acting DOM snapshots confirmed 1/text/true then 0/seed/false; session close and empty session list verified | Dedicated browser DOM automation; no native AppKit capability inferred |
| Codex in Chrome | Current first-party inventory showed a live Chrome extension provider; private tabs/profile were not opened | Candidate for explicitly needed live-browser state; login context not tested here |
| First-party in-app browser | Provider present; a proposed `data:` fixture was rejected by URL policy before creation | Mark policy-blocked for that test. No alternate URL/interface was used to recover the denied action; no general http/https or lifecycle conclusion |
| Chrome DevTools MCP | No separately exposed tool found in this session; not executed | Availability unknown outside this inventory; do not install or assume state sharing |
| Codex CUA bridge | Explicitly ineligible inside Codex; not executed | Retain for eligible non-Codex clients, never a Codex fallback |

## Verification and cleanup

[Sanitized observations](observations.json) preserve outcomes, delivery metadata,
rounds and evidence limits without private app inventories, absolute local paths,
pointer coordinates or clipboard contents. The original and advanced fixture
sources and a serial CLI runner are retained in `fixtures/desktop-pk/`.

Routing changes received repeated manual decision walkthroughs for registered
headless MCP, absent registration, live-but-hidden refs, incomplete observation,
explicit CLI/MCP constraints, and action denial. The mechanism was checked
separately from task success: fixed globals, fresh visible-target observation,
`complete` inspection and no headed escalation. The old prose could miss the new
MCP fixed-global requirement and treat the dated cursor/hidden-ref observations
as sufficient. These are two manual walkthrough passes, **not blind independent
agent trials**. Existing executable routing tests cover first-party priority,
unavailable candidates, explicit constraints, platform gates and forbidden
Codex bridge fallback; their passing does not establish agent behavior.

Repository validation uses the documented routing-only live-bridge skip;
first-party native work was exercised directly. Final validation and cleanup
receipts are recorded in the [delivery record](delivery.md). No Windows/Linux,
physical input, locked use, private notification content, permission changes,
concurrent agent arbitration or general application compatibility was verified.
