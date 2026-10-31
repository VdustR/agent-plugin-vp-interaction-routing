# Desktop Driver PK: October 31, 2026

Observed on macOS 26.6.2, ARM64, October 31, 2026 (Asia/Taipei). See the actual
OS value in the [sanitized results](pk-observations.json) if this
environment changes. This follow-up supersedes the initial agent-desktop
availability finding in [the source comparison](source-comparison.md).

## Decision

The user's current preference is **Codex first-party Computer Use first whenever
capable, then capable agent-desktop before Peekaboo**. An explicit tool request
or a requirement the earlier candidate cannot satisfy changes eligibility.
Outside Codex, a registered healthy eligible bridge remains another candidate.
Timing alone does not override the first-party preference.

agent-desktop can take over the tested native AX, exact-window, capture and
window-management fallback work. It has not established a complete replacement
for Peekaboo's macOS system surfaces, diagnostics, complex gestures or all apps.
Keep those capabilities available rather than removing Peekaboo. The current
npm installation also has a confirmed cursor-startup bug; visible feedback was
verified only with a temporary correctly named native copy, not the unchanged
mise/npm launcher. See the cursor diagnosis below.

## Setup and method

| Candidate | Actual baseline |
| --- | --- |
| agent-desktop | mise-managed 1.0.1, JSON protocol 2.5; Accessibility and Screen Recording granted, Automation unknown |
| Codex | This session's first-party `cua_repl` native App API with a persistent binding |
| Peekaboo | CLI 4.4.0, build d82dbd888; observation/action host was the matching on-demand daemon |

The installed agent-desktop core skill, macOS skill, interaction reference and
system reference were loaded **before acting** with `skills get`. These trials
used their qualified refs, explicit session, semantic headless operations,
read-after-act and retry-disposition rules. They were not raw CLI guesses or
an evaluation of upstream 1.0.2 behavior.

An owned AppKit fixture provided a counter, text field, checkbox, reset button
and a second window. Its [source and reproduction procedure](../../../../fixtures/desktop-pk/README.md)
are retained. No private documents, accounts or application settings were used.
The fixture independently wrote its logical state, a target-frontmost boolean,
pointer position and clipboard change count every 50 ms. Clipboard content and
other apps' names/content were not part of the retained witness.

Each timed round was: full AX observation at 0, click Increment, full readback at
1, click Reset, full readback at 0. Each driver completed three rounds serially.
Initial binding/setup was outside this timing. The initial agent-desktop setup
snapshot returned `WINDOW_NOT_FOUND`; a later inventory and explicit-window read
succeeded. That observation does not establish the cause of the initial failure.

## Same-task results

| Configuration | Completed rounds | Driver time, median | Observed range | Raw characters from the three reads per round |
| --- | --- | --- | --- | --- |
| Codex first-party, full reads | 3/3 | 2.161 s | 1.978–2.275 s | 1,902 |
| agent-desktop, overlay off | 3/3 | 1.651 s | 1.141–1.731 s | 5,280–5,289 |
| agent-desktop npm, overlay requested but no renderer | 3/3 | 2.393 s | 1.986–4.638 s | 5,280 |
| agent-desktop temporary native copy, actual visible renderer | 3/3 | 2.308 s | 1.444–2.339 s | 5,238–5,256 |
| Peekaboo, AX-only reads | 3/3 | 6.135 s | 5.927–7.832 s | 20,604–20,607 |

Times include awaited driver calls, not model reasoning or outer tool round
trips. CLI times include mise/CLI startup while Codex reuses its App binding;
native backend hosts were warm. Order was not randomized or interleaved. The
actual visible-cursor cohort ran later through a temporary correctly named native
copy with its official paired helper, default motion and a larger green cursor.
The npm requested-overlay cohort had no renderer and is not a measurement of
visible-cursor overhead. Launch paths, conditions and order differ; these are
observed configuration results, not isolated causal measurements of overhead.
Three samples on one app do not establish
general success rates, statistical significance or a universal speed ranking.

Raw characters measure these representations, not model tokens. Debug metadata,
full trees, diffs and caller-side filtering change what reaches the model.
Codex's default diff representation was not used for the full-read timing.

## Capability checks

| Scenario | Codex first-party | agent-desktop 1.0.1 | Peekaboo 4.4.0 |
| --- | --- | --- | --- |
| Button, text `setValue`/`set-value`, checkbox | Passed with fresh readback | Passed with fresh readback, both overlay modes | Passed with fresh readback |
| Text result semantics | Updated field read back through AX and fixture witness | `semantic_api` / AXValue, `delivered_verified`; document/application commit explicitly unverified | Background `accessibility_value`, `confirmed_change` |
| Checkbox click semantics | Updated value read back | AXPress, `delivered_unverified`, unsafe to repeat; independent value became true | Background AX action, `dispatched_unverified`, unsafe to repeat; independent value became true |
| Multiple windows | Existing App binding stayed on Main; increment changed Main without changing Secondary | Unscoped snapshot refused `AMBIGUOUS_TARGET`; explicit Secondary ID worked | Explicit Secondary ID worked |
| Arbitrary macOS window selector | No such parameter in this session's documented `getApp` API; other UI navigation was not tested | Exact window ID verified | Exact window ID verified |
| Window move and resize | No dedicated method exposed in the App interface; not exercised through AX navigation | Moved/resized own window to requested bounds and restored its exact original bounds | Dedicated route documented; not rerun for this fixture |
| Menubar | Fixture app menu present in AX tree | Scoped menu snapshot complete; only enumeration tested | Earlier documentation covers menu commands; not rerun here |
| Old/consumed target | No equivalent snapshot-qualified refusal trial performed | Hidden-window ref refused with `TIMEOUT` and `not_delivered`; no counter changed | Reusing consumed snapshot refused `SNAPSHOT_STALE`; no duplicate increment |

The hidden-window agent-desktop trial used 500 ms, then 1,500 ms with a successful
fresh Main observation as a control. Both refused before delivery. The latter
reported `resolution_window_bridge_miss` in its nested resolution details. This
does **not** prove `STALE_REF` classification, general application unresponsiveness,
or safe blind retry. Refresh the intended target and inspect delivery first.

## Cursor and desktop interference

The installed npm command returned `enabled: true` and `rendered: true`, but the
user did not see the cursor in two trials, including a foreground demonstration
with a large green cursor and explicit label. Its target-window screenshot also
had no overlay; since no renderer existed in that run, this does not establish
whether a real overlay would be included in the same capture.

### Cursor startup cause

This is not a missing official installation prerequisite. The pinned
[1.0.1 README](https://github.com/vercel-labs/agent-desktop/blob/3c3c8a956bd080497a90ba94a002b07409836e9a/README.md#installation)
explicitly supports npm. The installed official npm launcher selects the native
`agent-desktop-darwin-arm64`, matching the package's platform mapping. The
[macOS spawn implementation](https://github.com/vercel-labs/agent-desktop/blob/3c3c8a956bd080497a90ba94a002b07409836e9a/crates/macos/src/system/cursor_overlay/spawn.rs#L100)
returns success without starting a renderer when its own filename stem is not
`agent-desktop`. The
[dispatch implementation](https://github.com/vercel-labs/agent-desktop/blob/3c3c8a956bd080497a90ba94a002b07409836e9a/src/dispatch/cursor_overlay.rs)
turns that success into `rendered: true`.

A one-variable reproduction copied the same native bytes to two filenames in
one private temporary folder. It held arguments, environment and session fixed:

| Executable name | Reported rendered | Renderer sockets |
| --- | --- | --- |
| `agent-desktop-darwin-arm64` | true | 0 |
| `agent-desktop` | true | 1 |
| `agent-desktop-darwin-arm64` | true | 0 |

The user confirmed seeing the green cursor with the correctly named copy.
The [rerunnable probe](../../../../fixtures/desktop-pk/cursor-basename-probe.py)
also reproduced `0, 1, 0` and verified its cleanup. This supports a packaging/runtime
compatibility bug, not a mise-specific configuration fault. The reviewed upstream
workspace revision also contains this filename check; its runtime was not tested.

The actual visible renderer then completed three workflow rounds plus text and
checkbox checks. That temporary native launch used the official paired helper.
No installed files, permissions, mise settings or default command were changed.
A temporary successful diagnostic is not an installed fix. Do not mark visible
cursor support eligible for the unchanged npm command solely from version,
skill presence or `rendered: true`.

The user separately confirmed that the Codex Computer Use cursor is visible.
Codex remains first by explicit preference. agent-desktop's cursor is a
presentation layer over semantic AX actions; neither that layer nor a cursor in
an image proves physical OS-pointer movement.

All driver endpoint samples showed the fixture remained non-frontmost and
clipboard change count did not increase during that driver's measured cohort.
Physical pointer endpoints matched for Codex and overlay-off agent-desktop.
Pointer positions changed during the longer Peekaboo, requested-overlay and actual-renderer cohorts;
the actor is unknown on this shared desktop. A short isolated Peekaboo AX click
then changed the counter with unchanged pointer, foreground and clipboard
endpoints. These are endpoint observations, not continuous input-event traces or
proof that no transient movement/activation occurred.

## Capture checks

All captures were of the owned Main window and visually inspected for the
expected controls and values.

| Route | Observed output | Capture sample |
| --- | --- | --- |
| Codex `getScreenshot` | JPEG, 860×664 | 208 ms, one sample |
| agent-desktop exact-window screenshot | PNG, 996×800, scale factor 2, includes surrounding padding | 843 ms, one sample |
| Peekaboo default | PNG, 430×332 | 2,654 ms, one sample |
| Peekaboo `--retina` | PNG, 860×664 | 4,464 ms, one sample |

Capture boundaries, encoding and resolution differ, so these timings are not a
same-pixel-work benchmark. Peekaboo's default 1× output is not a resolution cap.
The Codex image included its agent cursor indicator; do not infer physical OS
pointer movement from a cursor painted in a captured image.

## Remaining scope

Real Electron/Chromium apps, custom canvas, file pickers, background drag,
cross-app drops, Dock/Spaces, security prompts, locked use, Windows and Linux
were not exercised. Keep the source contracts and these local results separate.
Refresh affected claims after a version, host, OS, permission or app change.

Cleanup results are retained in the observations JSON. All three owned fixture
runs exited; their logical state was restored, cursors disabled, sessions ended
and renderer sockets removed. The Peekaboo daemon had already exited by its
final status check; its pre-existing GUI host remained open. One post-close
NSWorkspace inventory read timed out; independent PID readback proved the app
was gone, and the remaining session cleanup succeeded. Private command-host
process exit is separate from manifest end and was not verified. Codex JS
bindings were reset; its documented API exposes no native session-end method.
