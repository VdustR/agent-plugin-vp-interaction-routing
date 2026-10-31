# Desktop Tool Evidence

Observed October 31, 2026 (Asia/Taipei). This is a versioned research record,
not a claim that every tool has passed the same live benchmark. The later
[live PK](live-pk.md) records the installed agent-desktop 1.0.1
trials and the current first-party-first routing preference. The method is
maintained in [vp-tool-comparison](../../../../skills/vp-tool-comparison/SKILL.md).

## Baselines and evidence classes

| Candidate | Verified baseline | Evidence level |
| --- | --- | --- |
| agent-desktop | Upstream workspace version 1.0.2 at the [reviewed source revision](https://github.com/vercel-labs/agent-desktop/tree/a47ed664e0db00d1d4df364eb3fe8a5599882f3c); initially absent from PATH; later mise installation reports 1.0.1 | Initial source review only; later local execution is in the live PK |
| Codex first-party Computer Use | This session's `cua_repl` native App API; official Computer Use documentation retrieved on the observation date | API inventory plus a live Calculator round trip; other capabilities documented or unknown |
| Peekaboo installed | CLI 4.4.0, build d82dbd888; selected GUI host and observation daemon report 4.4.0 | Live CLI help, permission/host inventory, Calculator observation/action/readback |
| Peekaboo upstream | [Reviewed source revision](https://github.com/openclaw/Peekaboo/tree/653645cbddb596c8077940fce2506a32cb48f580), README describes 4.9.7 | Current upstream documentation; not proof that the installed 4.4.0 supports newer behavior |

Documented means a primary source states the contract. Source-inspected means
the named implementation was inspected, not executed. Locally observed applies
only to the named fixture and mode. Unknown does not mean unsupported.

## Confirmed source facts

| Area | agent-desktop | Codex first-party Computer Use | Peekaboo |
| --- | --- | --- | --- |
| Integration | Rust CLI and C FFI; agent owns the loop ([README](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/README.md)) | Harness-integrated app access with per-app approvals ([official docs](https://learn.chatgpt.com/docs/computer-use)) | macOS CLI/app and MCP; optional model-backed agent ([README](https://github.com/openclaw/Peekaboo/blob/653645cbddb596c8077940fce2506a32cb48f580/README.md)) |
| Platforms | macOS, Windows, Linux with different adapter limits; macOS 13+ ([install](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/docs/install.md)) | Official desktop product docs cover macOS and Windows; this session is macOS ([official docs](https://learn.chatgpt.com/docs/computer-use)) | Released CLI/app require macOS 15+; no Windows/Linux route documented ([README](https://github.com/openclaw/Peekaboo/blob/653645cbddb596c8077940fce2506a32cb48f580/README.md)) |
| Observation | AX snapshots, qualified refs, skeleton/subtree reads, partial-tree indication ([core skill](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/skills/agent-desktop/SKILL.md)) | This session exposes numeric AX indexes, diff/full reads, app screenshots and combined reads | AX trees without images, element/snapshot IDs, window screenshots and annotations ([see](https://github.com/openclaw/Peekaboo/blob/653645cbddb596c8077940fce2506a32cb48f580/docs/commands/see.md)) |
| Semantic vs physical | Ref actions default to semantic AX and fail closed when unavailable; headed click/type/scroll become physical first. macOS `press` is explicitly physical keyboard input even in the headless table ([macOS guide](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/apps/docs/content/docs/platforms/macos.mdx)) | Mac background use is documented; this API has AX-index and coordinate actions. No per-action delivery/retry metadata exposed in the session's documented App return types | Background AX actions and targeted event routes coexist; foreground input is explicit. Exact mode and host capability matter ([click](https://github.com/openclaw/Peekaboo/blob/653645cbddb596c8077940fce2506a32cb48f580/docs/commands/click.md)) |
| Staleness/retry | Snapshot-qualified refs; stale/ambiguous targets require observation. Retry only on safe disposition; an uncertain action may already have landed ([JSON contract](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/docs/json-output.md)) | Re-read after actions and rederive numeric indexes; a successful void-returning call alone does not establish the predicate | Fresh snapshots and delivery/effect/retry metadata. Live click reported unsafe-to-retry dispatch despite top-level success |
| Windows/menus/system | Window management and menu/sheet/popover/alert surfaces documented on macOS. `open-system-surface` unsupported there ([macOS guide](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/apps/docs/content/docs/platforms/macos.mdx)) | App AX tree included menu bar and window controls in the fixture. No dedicated Space/window-management methods in this session's App interface | Dedicated window, menu, menubar, Dock, dialog and Space command families ([command map](https://github.com/openclaw/Peekaboo/blob/653645cbddb596c8077940fce2506a32cb48f580/README.md)); Space operations not exercised |
| Drag | macOS drag needs headed mode ([platform skill](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/skills/agent-desktop-macos/SKILL.md)) | `App.drag` exposed; delivery/focus behavior not measured | Current upstream documents constrained exact-window background drag; cross-app/window variants require foreground ([drag](https://github.com/openclaw/Peekaboo/blob/653645cbddb596c8077940fce2506a32cb48f580/docs/commands/drag.md)); installed behavior untested |
| Browser/Electron | May enable Chromium AX; fresh Electron launch with CDP can hand web content to agent-browser ([macOS guide](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/apps/docs/content/docs/platforms/macos.mdx)) | Unified tool also exposes separate DOM-aware browser bindings; native AX is not DOM | Configured browser integration exists separately from native AX ([README](https://github.com/openclaw/Peekaboo/blob/653645cbddb596c8077940fce2506a32cb48f580/README.md)); neither integration nor Electron behavior tested here |
| Locked computer | No reviewed locked-use guarantee | Optional macOS locked use documented; requires explicit setup, not tested or enabled here. Windows requires active visible desktop ([official docs](https://learn.chatgpt.com/docs/computer-use)) | No reviewed locked-use guarantee |
| Lifecycle | macOS private command host retains native objects; documented idle exit is 15 minutes ([README](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/README.md)) | This session's documented API has no native App end/disconnect method; reset clears JS bindings but does not prove native teardown | Existing GUI host and on-demand daemon are separate execution/permission contexts ([bridge host](https://github.com/openclaw/Peekaboo/blob/653645cbddb596c8077940fce2506a32cb48f580/docs/bridge-host.md)) |

The [official Codex documentation](https://learn.chatgpt.com/docs/computer-use)
also excludes automating terminal apps or ChatGPT itself, administrator
authentication, and approval of security/privacy prompts. These are policy
boundaries, not missing features to recover through another driver. A tool
comparison grants no exception to an action denial or access control.

The session API documents that macOS App `paste` restores the prior clipboard;
that behavior was not exercised here. agent-desktop exposes explicit clipboard
commands and documents no clipboard use for semantic headless ref actions.
Peekaboo also exposes clipboard commands. None of this establishes that every
typing mode in all three tools preserves clipboard state.

The agent-desktop slogan about safe retries is not a blanket guarantee. Its
[core workflow](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/skills/agent-desktop/SKILL.md)
requires safe disposition and observation after uncertain delivery. The
[inspected retry enum](https://github.com/vercel-labs/agent-desktop/blob/a47ed664e0db00d1d4df364eb3fe8a5599882f3c/crates/core/src/response/retry_disposition.rs)
includes unknown and unsafe as well as safe.

## Live checks and limits

Acceptance: start at Calculator display 0, observe an element for Seven, click
it through that candidate, read display 7, refresh the Clear element, restore
0, and read the restored display. No expression evaluation or history writes
were needed. Checks ran serially on the same macOS session and app.

| Check | Observed result | What it does not prove |
| --- | --- | --- |
| Codex native AX | `getApp("Calculator")` produced an AX tree; index click changed 0 to 7; diff readback showed 7; fresh Clear index restored 0 | Other apps, screenshot accuracy, focus/pointer preservation, locked use or throughput |
| Peekaboo host/permissions | CLI 4.4.0; GUI host available; selected Bridge source reported Screen Recording, Accessibility and Event Synthesizing granted. Observation then selected a matching on-demand 4.4.0 daemon | A GUI-host grant alone proves neither the daemon's permission context nor every operation |
| Peekaboo native AX | Exact-window `see --tree --no-screenshot` reported mutation targeting available. Snapshot element click reported background accessibility delivery, unverified effect and unsafe retry. Fresh AX read showed 7; fresh Clear click restored 0; AX read and independent Codex read showed 0 | No universal text-only-snapshot guarantee; no proof of background drag, clipboard preservation, or unchanged foreground/pointer |
| agent-desktop runtime, initial research | Initially absent on PATH; no installation performed by this chat | Superseded by the follow-up live PK after installation in a separate chat |

This corrects the old routing reference's blanket statement that an AX-only
Peekaboo snapshot cannot click. The installed build accepted that exact semantic
click. Coordinates still need the capture/target receipts required by their
command; semantic-click success does not establish coordinate eligibility.

The initial research ran no comparable latency, model-token cost, CPU, memory,
or success-rate benchmark. Later driver-time samples are in the live PK. Tool timings and output sizes are not substitutes for those metrics.
No global performance winner is established.

Cleanup: the task-created Peekaboo on-demand daemon was stopped after checking
its identity and idle state; daemon status then reported `running: false`.
The pre-existing GUI host was retained. Calculator was restored to 0. Codex JS
bindings were reset, but the exposed API offers no native session end method;
native teardown was not verified. The client Stop control is the available
user-facing way to release native access.

## Scenario decisions

These are recommendations derived from the evidence, not additional observations.

| Scenario | Preferred eligible route | Boundary or fallback |
| --- | --- | --- |
| Complete service operation or web page | Connector/API/service CLI, or DOM-aware browser route | Desktop CLIs are GUI drivers, not a reason to skip the semantic/DOM gate |
| Ordinary native app inside Codex | First-party Computer Use | Integrated session default when no binding need favors another route |
| Repeatable shell workflow or cross-harness native automation | Codex first-party when capable; otherwise verified agent-desktop before Peekaboo | Explicit tool/CLI requirements still apply; no implicit setup |
| Strictly no synthetic input | Verified semantic AX action, potentially agent-desktop refs or Peekaboo AX | Gate the command and target, not the word headless; exclude physical `press` and unverified fallbacks |
| Deep macOS inspection, Dock/Spaces, capture diagnostics | First-party when capable, then verified agent-desktop; retain Peekaboo for gaps | Do not infer a missing capability solely from a command family or a generic AX test |
| Native UI outside Codex without a first-party driver | Verified agent-desktop for CLI needs; otherwise a registered healthy eligible bridge, then capable Peekaboo | Codex itself must not use the bridge; do not add a bridge hop merely to reach native UI |
| Canvas/custom drawing or missing AX | DOM/CDP where applicable; otherwise verified pixel input on an eligible surface | AX availability cannot be inferred from framework name; coordinates remain the last resort |
| Windows/Linux | Inventory native platform adapters first; agent-desktop is a documented candidate | No macOS Peekaboo fallback; Codex Windows foreground semantics differ; Linux product support not established by these official Codex docs |
| Locked Mac | Only an already authorized, configured and verified locked-use route | No new unlock setup, privilege grant or alternative-tool bypass in routing |

## Refresh and retained evidence

Refresh when a binary, host protocol, OS, app build, permissions, or adapter
changes. Rerun only the scenarios whose claims changed. A new upstream release
does not upgrade this local evidence automatically.

The initial research retained sanitized command extracts in
[initial-observations.json](initial-observations.json). Raw local
logs and temporary session notes were kept under a task-specific temporary
directory; those temporary files are not required to understand this record.
