# Native UI Routing

Use native UI automation only after confirming that no purpose-built connector,
API, CLI, or browser DOM interface can complete the current operation.

## Session Lifecycle

Track identifiers for Computer Use sessions and helper processes started by the
task. A session that existed before the task remains user-owned when the task
uses or activates it. End task-owned sessions when native interaction finishes,
the route changes, or the task ends through success, failure, cancellation, or
handoff. Use the selected interface's documented lifecycle operation, then read
its state to confirm that the session ended.

Ending a Computer Use session does not require quitting the target application
or a shared host service. Close task-created temporary windows and helper
processes. Leave existing user state unchanged unless the user requested its
closure. If the client provides no end or disconnect control, report the active
resource and the client action required to release it.

## First-Party Computer Use

Prefer Codex first-party Computer Use for ordinary native application work when
operating as Codex and no binding requirement favors another eligible route.
In another agent, prefer that host's own first-party surface whenever capable.
Apply the capability gate below before choosing a CLI or registered healthy bridge.
Typical operations include
reading an application's accessibility state, clicking controls, entering text,
scrolling, dragging, and reading back the result.

## Codex Computer Use Bridge

To expose Codex Computer Use as directly callable tools in Claude Code,
Antigravity, or another MCP client, use a compatible MCP bridge. Codex
app-server speaks its own JSON-RPC protocol and is not itself a standard MCP
server. Delegating an entire task to a separate Codex agent through a generic
agent MCP server is a different route; do not describe it as direct access to
Codex Computer Use or assume that it exposes the same tools.

This skill ships one such bridge at
[scripts/codex-cua-bridge.mjs](../scripts/codex-cua-bridge.mjs). Read
[references/codex-cua-bridge.md](codex-cua-bridge.md) for its requirements,
registration, verification procedure, tool surface, and cost comparison against
Peekaboo.

Shipping it is not the same as it being available. It is available only once the
current client has it registered as an MCP server, which shows up as bridge tools
in the session's tool list. When those tools are absent the bridge is installed
but not registered, and registering it is a privileged change that needs the
user's authorization: say so and offer the command rather than assuming the
capability is missing. The reference has the registration and verification
steps.

**The bridge is for harnesses other than Codex.** When operating as Codex, load
the installed first-party Computer Use skill, discover the tools exposed in the
current session, and follow that skill's authorization rules. Do not register or
call this bridge: it adds an app-server hop and moves the action outside the
Codex Computer Use confirmations policy.

Treat the bridge as an optional capability, not a universal dependency:

- treat bridge installation or registration as a persistent, privileged
  configuration change that requires explicit user authorization;
- verify the bridge's source and provenance; do not imply that a third-party
  bridge is an official Codex component;
- require a compatible macOS host and installed official Computer Use
  component;
- verify bridge health and upstream tool inventory before relying on it, and
  reverify after a host application update rather than assuming continuity;
- pin or compatibility-test the bridge because app-server surfaces may change;
- do not assume it works while the Mac is locked;
- apply the host agent's authorization policy before mutating UI because a
  direct bridge call does not automatically execute the Codex Computer Use
  confirmation policy; honor a policy that permits the action without prompting
  and do not add a separate confirmation gate in this routing layer.

Prefer the host's first-party surface over the optional bridge when both
provide equal capability and the former has better integration. Use the bridge when the host has no native UI surface or
when the bridge materially improves background-safe accessibility interaction.

## Capability-Gated Native Selection

Read the [native decision tree](native-decision-tree.md) before selecting a
route. Every harness prefers its own first-party surface; Codex uses Codex
Computer Use and must not use the bridge. Do not derive a global product ranking
from one app or upstream docs.
Filter candidates by platform, availability, authorization, exact operation,
required state, and readback before ranking. Apply the same filters to fallbacks.

- In every harness, prefer its own first-party computer use whenever it can
  complete the authorized operation and readback. In Codex, this is Codex Computer
  Use. This preference remains first even when a small driver benchmark favors
  another tool. Preserve explicit tool
  requests and genuinely binding requirements it cannot satisfy.
- Next prefer capable agent-desktop over Peekaboo. Verify the exact operation,
  target and readback; read its version-matched core, platform and relevant
  command skills.
  An absent binary or missing permission is not an implicit setup request.
- For visible feedback, use a task-owned session with `session start --cursor`
  or `cursor-overlay enable --session <id>`. Check `data.rendered`: saved settings
  are not proof of rendering. In the tested npm 1.0.1 package, even `rendered: true`
  was a false positive because the platform-suffixed binary skipped renderer
  startup. Verify the actual executable and renderer/visibility before treating
  visible feedback as available; the repository research contains the source-backed reproduction.
  Do not introduce its temporary renamed-copy diagnostic as a persistent fix.
  The overlay is presentation, not physical-pointer delivery; it does not require
  `--headed`. Inspect its actual visibility when that matters, measure the intended enabled mode, and disable/end it on exit.
- For no-synthetic-input work, require evidence for the exact command and target.
  macOS `press` explicitly uses physical keyboard input even without `--headed`.
  A semantic ref action's delivery metadata and readback establish a narrower
  fact than a product-wide headless label.
- Retain Peekaboo for requirements still missing or unverified in the preceding
  candidates, including specialized system/AX diagnostics. A dedicated command
  family helps discovery but does not establish that no other tool can do it.
- Outside Codex, a registered healthy eligible bridge remains another native
  candidate after a capable CLI and the host first-party surface. Codex itself
  must not use that bridge. Do not route around an app or action denial.
- For locked use, use only an already authorized, configured and verified route.
  Do not enable unlock support or change permissions as part of tool selection.

Installed-version PK results and raw observations are maintained outside the
skill under `docs/research/desktop-automation/`. They are maintenance evidence,
not a prerequisite for an ordinary native task. All selection
and fallback paths require a current candidate inventory; a generic native UI
label is insufficient. Inspect nested resolution details and delivery disposition
before interpreting an error such as `TIMEOUT`; refresh the intended target
rather than treating the top-level name as proof that the whole app is dead.

## Peekaboo

Peekaboo can contend with the user's own interaction through focus, pointer and
system state. It also supports background semantic and exact-target input; do
not infer contention from the product name alone. Use the installed `peekaboo`
skill and inspect the actual host, version, permissions and command help.

Prefer background accessibility actions when the exact target supports them.
Use foreground interaction only when authorized and necessary. A refused
background operation does not authorize foreground input. Untargeted background
input is refused rather than delivered; target by the exact window and fresh
snapshot or another command-supported exact selector. Pass a process id through
`--pid <pid>` or `--app 'PID:<pid>'`, not a bare numeric app name.

Refresh identifiers after mutation. `success: true` or `effect: unverifiable`
does not establish an app change; inspect delivery/retry metadata and read the
intended predicate before another input. For a visual effect compare a follow-up
capture; use semantic readback for nonvisual state or noisy captures. Background
coordinate clicks require `--snapshot` from a fresh `see` capture of that
exact target window with the receipts required by the installed command.

An exact-window AX-only snapshot can support semantic mutation when its current
host reports mutation targeting available. Check that capability and the command's
receipts rather than requiring screenshots for every semantic click. Coordinates
still require a qualifying fresh capture; an AX-only observation is insufficient.

For Electron/Chromium, inspect the actual app's AX exposure first. Menu discovery
can reveal a semantic action or shortcut, but accepted targeted keyboard dispatch
can still have no visible effect. Background reachability is a property of the
app, build and input route, not of Electron as a whole. Prefer a verified DOM/CDP
route for web content when available. Do not relaunch an existing private profile
with CDP merely to get another automation interface. Check native-picker focus
requirements before opening one; no universal focus-free guarantee is established.

Use the `vp-recording` skill for video or contact sheets rather than automation
diagnostics. Track task-created snapshots and helper processes; use documented
cleanup without stopping pre-existing shared hosts.

## Final Fallback

Use screenshot interpretation and coordinate interaction only when semantic,
DOM, and accessibility paths are unavailable. Verify the visible result after
every consequential coordinate action.
