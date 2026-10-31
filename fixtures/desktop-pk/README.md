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
