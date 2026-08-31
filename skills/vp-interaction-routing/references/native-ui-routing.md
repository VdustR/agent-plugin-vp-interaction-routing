# Native UI Routing

Use native UI automation only after confirming that no purpose-built connector,
API, CLI, or browser DOM interface can complete the current operation.

## First-Party Computer Use

Prefer Codex first-party Computer Use for native application work when operating
as Codex. In another agent, prefer that agent's first-party computer use when it
is available; otherwise use the Codex Computer Use bridge through Codex
app-server when it is registered and healthy. Typical operations include
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

Prefer the host's first-party surface when it provides equal capability and
better integration. Use the bridge when the host has no native UI surface or
when the bridge materially improves background-safe accessibility interaction.

## Peekaboo

Peekaboo can move focus, pointer, windows, and Spaces in the user's live desktop,
so it can contend with the user's own interaction. Use the installed `peekaboo`
skill only when first-party computer use and a healthy bridge are unavailable on macOS,
or when the task requires a capability they do not provide:

- operating an unfocused application or a specifically identified window;
- window movement, resizing, focus, menus, Dock, Spaces, or system dialogs;
- deep accessibility inspection, identifiers, bounds, and named AX actions;
- comparing accessibility actions with synthetic input paths;
- window-scoped capture and annotated inspection;
- stable predicate verification and desktop automation troubleshooting.

Refresh Peekaboo state before interaction. Treat its element and snapshot IDs
as valid only for the observed UI state. Avoid Peekaboo interaction while the
user is actively using the same desktop. If contention is likely and the task
cannot be isolated, pause for user coordination before acting.

Prefer background accessibility actions when Peekaboo can resolve the target
process. Use foreground interaction only when the operation requires a key
window, a Space switch, or a synthetic foreground event. Confirm command-level
support before relying on a background-specific flag such as
`--focus-background`.

Peekaboo 4 requires explicit targets for background input. Always pass `--app`
or `--pid` to `peekaboo click`, `type`, `scroll`, and `press`. Untargeted
background input is refused rather than delivered:

```
Keyboard input requires --app, --pid, or --snapshot for background delivery.
```

`--foreground` is the documented escape hatch and does send global input, so
treat an untargeted foreground call as input aimed at whatever the user is
using. Pass a process id through `--pid <pid>` or `--app 'PID:<pid>'`; `--app`
with a bare number is read as an application name and fails with
`Application '<pid>' not found`.

Peekaboo also refuses a cold background `app launch` before dispatch and directs
the caller to retry in the foreground. When an app must start without taking the
foreground, use `open -g -a <App>` instead, which was measured to leave the
active application unchanged.

For a native Electron app, use this background-first order:

1. Run `peekaboo menu list --pid <pid>` to enumerate the menu tree and discover
   keyboard shortcuts without activating the app. This read is background-safe.
2. Try process-targeted `press` and `type` keyboard input next, and prove the
   result with a readback. Background keyboard delivery into Electron web
   content is not reliable: it can be accepted and reported as `success: true`
   with `effect: unverifiable` while changing nothing.
3. Use coordinate clicks only as a last resort. A background click presses the
   accessibility element under the point, so the route exists only where the
   target app exposes one. Probe the app with `see` before relying on it: an
   app whose window returns only chrome controls has nothing for the click to
   press, and the call fails with
   `No pressable accessibility element was found`.
4. Before opening a native file or folder picker, disclose and budget the
   unavoidable foreground interruption.

How much of steps 2 and 3 survives is a property of the app, not of Electron.
Accessibility exposure differs between builds, so establish it per target rather
than assuming it. In the one app measured here, Antigravity 90766, the window
exposed 12 elements, all of them window chrome, and neither keyboard input nor a
coordinate click reached the web content. When a readback shows nothing changed
in an app like that, escalate to `--foreground`, disclose the foreground cost,
or move the task to a DOM-aware surface.

`effect: unverifiable` is not evidence of success, for pointer and keyboard
input alike. Capture the exact target window before the interaction and
compare a follow-up capture before another step depends on a visual effect.
Verify the intended predicate through a semantic readback when the effect is
nonvisual or when unrelated animation, caret movement, or other visual noise
could change the capture. A background coordinate click also requires
`--snapshot` from a fresh `see` capture of that exact target window; PID-only
or app-only coordinates are refused.

The Peekaboo behavior in this section was measured against Peekaboo 4.0.0. Treat
a specific message, flag, or refusal as version-dependent and re-derive it from
the installed build before relying on it; the routing rules above hold because
of what the input model can reach, not because of any one release.

Reading and acting use different observations. The text-only read, `inspect_ui`
over MCP or `see --tree --no-screenshot` on the command line, is the cheap way to
inspect a tree, but its snapshot cannot drive a click:

```
Snapshot is stale: Exact-window click snapshot has no capture-time process-generation receipt and bounds. Re-run peekaboo see to refresh.
```

Use `see` when the intent is to act, and reserve the text-only read for
inspection.

Use the `vp-recording` skill when the requested artifact is a video or contact
sheet rather than an automation diagnostic.

## Final Fallback

Use screenshot interpretation and coordinate interaction only when semantic,
DOM, and accessibility paths are unavailable. Verify the visible result after
every consequential coordinate action.
