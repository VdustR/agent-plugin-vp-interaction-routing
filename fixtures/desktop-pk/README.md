# Owned Native Desktop Fixture

`Fixture.swift` creates an AppKit app containing a counter button, text field,
checkbox, reset button and a second window with its own counter. It writes its
own state to `DESKTOP_PK_OUTPUT`; no clipboard contents or other apps' content
are read. Pointer coordinates and clipboard change count stay in local witness
files; durable reports should retain only relevant changes/unchanged endpoints.

Build with an existing macOS Swift toolchain in a task-specific temporary folder:

```sh
mkdir -p "$PK_DIR/Routing PK Fixture.app/Contents/MacOS"
cp fixtures/desktop-pk/Info.plist "$PK_DIR/Routing PK Fixture.app/Contents/Info.plist"
swiftc fixtures/desktop-pk/Fixture.swift \
  -o "$PK_DIR/Routing PK Fixture.app/Contents/MacOS/RoutingPKFixture"
DESKTOP_PK_OUTPUT="$PK_DIR/fixture-state.json" \
  "$PK_DIR/Routing PK Fixture.app/Contents/MacOS/RoutingPKFixture"
```

Choose a new absolute `PK_DIR` before running those commands. Track the fixture
process in the harness; the launch command stays running until the app exits.
This is a local owned test app, not an installable desktop tool.

1. Discover the app's actual PID and window IDs. Do not copy IDs from evidence.
2. Load each installed driver's matching skills/help. For agent-desktop create
   a task session with `--no-trace` and pass that scope to every UI command.
3. Warm each candidate with one successful observation. At logical state
   counter 0, text `seed`, checkbox off, second window hidden, time three rounds
   of observe, Increment, observe 1, Reset, observe 0. Refresh refs each time.
4. Independently confirm text replacement and checkbox change from the fixture
   state file; Reset before changing drivers. Record foreground, pointer and
   clipboard-change-count samples immediately around the cohort.
5. Open the second window. Verify exact-window selection changes its counter
   without touching Main. Treat an ambiguous unscoped selection as a refusal.
   Capture only an explicitly selected owned window.
6. Negative target trials are only for this disposable fixture: a consumed
   snapshot or hidden Secondary reference must not increment an unrelated
   counter. Record the actual error rather than expecting one specific name.
7. If testing visible cursors, enable the task session's overlay, retain the
   `rendered` result and repeat the same workload in that intended configuration.
   Verify physical visibility separately; renderer acknowledgement is not pixels.
8. Reset, restore any changed window bounds, disable cursors, close only this
   owned app, end the task session and read back cleanup state. Preserve all
   pre-existing hosts and sessions.

The witness samples every 50 ms and writes when its state changes. Endpoint
comparisons do not identify the actor behind concurrent user movement or prove
the absence of transient side effects. Do not present this fixture's success as
compatibility with arbitrary native, Electron, canvas or system surfaces.

## Cursor basename reproduction

`cursor-basename-probe.py` is a separate narrow probe for the macOS npm cursor
startup failure. Give it the trusted installed native binary, not the JavaScript
launcher, and a new absolute output directory. It copies the same bytes into
two filenames, uses identical arguments/state, and checks renderer sockets in
the sequence platform name, plain name, platform name. The command does not
modify an installation, configuration or permissions; a cursor may appear during
the plain-name phase. Cleanup disables its cursors and ends its private session.

```sh
python3 fixtures/desktop-pk/cursor-basename-probe.py \
  --binary "$INSTALLED_NATIVE_BINARY" --out "$NEW_PROBE_DIRECTORY"
```

The October 31 binary reproduced socket counts `0, 1, 0` while every enable
returned `rendered: true`. The retained PK also includes human confirmation of
the renamed copy's actual visible cursor. Socket presence alone is not a visual
assertion. Keep a successful temporary diagnostic separate from a persistent
installation repair.

## Refresh probes

`compare-native.py` repeats the same counter/text/checkbox workload through
agent-desktop CLI or Peekaboo, with state-file assertions and three timed rounds.
Start the original fixture, discover window IDs separately for each driver, and
load its installed guidance before running. Run drivers serially: they share one
fixture. Use a task-owned agent-desktop session and explicit private state root;
the caller owns session teardown. `--pb-bin` accepts an official task-local
Peekaboo release without replacing the installed binary. All paths are examples
with caller-supplied values:

```sh
python3 fixtures/desktop-pk/compare-native.py --driver ad \
  --window "$AD_WINDOW" --session "$AD_SESSION" --state-root "$AD_STATE" \
  --witness "$PK_DIR/fixture-state.json" --out "$PK_DIR/ad-cli.json"
python3 fixtures/desktop-pk/compare-native.py --driver pb \
  --window "$PB_WINDOW" --state-root "$AD_STATE" \
  --witness "$PK_DIR/fixture-state.json" --out "$PK_DIR/peekaboo.json"
```

The output is a local raw record, not automatically safe to publish. It includes
paths, process identifiers, driver diagnostics and pointer/clipboard endpoints.
Do not run it against a private app or reuse an output filename. The script
checks the owned Main title and initial logical state before mutations; it is
not an identity/security boundary for arbitrary untrusted applications.

`AdvancedFixture.swift` is a separate app for macOS address identity, row
selection, changing values during waits, owned status items and dense snapshots.
Build it with the same recipe, changing the app bundle/executable/display name
to `Routing PK Advanced` / `RoutingPKAdvanced` and its bundle ID to
`dev.local.routing-pk-advanced` in a copied Info.plist. Give it a separate
`DESKTOP_PK_OUTPUT`. Do not run the original fixture's comparison script against
this app.

1. Snapshot the Advanced window. Two buttons named `Twin` have no identifiers.
   Click each with its own fresh ref; the state file must show `[1, 1]`.
   Capture the first ref, click `Remove first twin`, then try that removed ref.
   Inspect delivery and confirm the second count did not change. Rebuild and
   repeat once. This distinguishes address identity from label matching.
2. On a fresh tree, click the row containing `Owned row 2` and inspect
   `selectedRow`; action success alone is insufficient. Then use the table's
   `select <ref> 'Owned row 2'` and compare selection. Rebuild before repeating.
3. Use `set-value <input-ref> --stdin` with owned Unicode text. Verify the state
   file and omission of `post_state.value`. Test `type --interval-ms` only on a
   fresh element advertising TypeText; preserve a semantic-policy refusal and
   do not grant focus or physical input to make it pass.
4. Click `Arm value change`, snapshot the input, then immediately start
   `wait --element <ref> --predicate value --value arrived --timeout 5000`.
   The fixture changes it after 1.5 seconds. Repeat twice; a value that already
   matches when the wait begins is not this test.
5. Read `--surface menu-bar-extras --app 'Routing PK Advanced'`, then drill its
   returned ref. This covers this owned status item while its window exists,
   not all windowless apps, Notification Center, or private system menus.
6. Open the dense window, rediscover its ID and compare explicit observation
   budgets (for example 300, 500 and 3000 ms). A setup timeout and a successful
   partial observation are different outcomes. Hardware/load can change which
   budget reaches the tree. Read `complete`, `truncated` and `nodes_observed`.
7. For the original fixture, separately check a hidden Secondary ref after
   Reset. In 1.2.0 this live retained element still incremented the hidden
   window; removal and hiding are different controls. Reobserve before normal
   mutations and do not use this intentionally old ref pattern in real work.
8. End private sessions, disable overlays and close only these owned fixture
   processes. Read back session/renderer/process cleanup. Never stop an
   existing shared helper to improve a benchmark.

For MCP, start `agent-desktop --session "$AD_SESSION" mcp` as a task-owned stdio
process, initialize it, list schemas, and load `desktop_skills_get` for `desktop`
and `platform`. Repeat the workload through `desktop_snapshot`, `desktop_click`
and `desktop_set_value`, obtaining each ref from that server. A per-call
`headed: true` must be refused by a headless server. Close stdin, wait for server
exit, explicitly end the session via the CLI, then read `session list`.
Starting a stdio probe does not register an MCP server in an agent client.
