# agent-desktop change inventory

Observed November 6, 2026 (Asia/Taipei). The runtime baseline was **1.0.1**, not the newest release available on the previous observation date. Consequently this inventory includes 1.0.2 even though it was already published on October 30. All 49 commits reachable from tested 1.0.1 through released 1.2.0 are listed below, including five commits without a PR and documentation/maintenance changes. Local Git history avoids the GitHub compare API’s 300-file truncation (the full diff spans 598 files).

Release metadata: [1.0.2](https://github.com/vercel-labs/agent-desktop/releases/tag/v1.0.2), [1.1.0](https://github.com/vercel-labs/agent-desktop/releases/tag/v1.1.0), [1.2.0](https://github.com/vercel-labs/agent-desktop/releases/tag/v1.2.0). Source revision for runtime claims: [released 1.2.0 source](https://github.com/vercel-labs/agent-desktop/tree/2b0a7334fc111730454b726e6800aa41cdafc093). “Documented” below is release/source evidence, not an executed platform test. See [live results and limits](comparison.md) and [sanitized observations](observations.json).

## Complete released range

### v1.0.2 (since v1.0.1)

| Change | Evidence / validation boundary |
| --- | --- |
| [docs: make AGENTS.md the single agent instructions file and correct stale docs](https://github.com/vercel-labs/agent-desktop/pull/329) | Documented repository/docs/release change; no product UI claim tested. |
| [feat: tell npm users when the node launcher slows each call](https://github.com/vercel-labs/agent-desktop/pull/328) | Documented; launcher path inspected. No latency attribution to Node alone. |
| [fix: make the permission guide offer the launching app, see each grant, and leave no stale host](https://github.com/vercel-labs/agent-desktop/pull/330) | Documented; grant/guide not run because permissions are already granted. |
| [chore: remove the personal funding link, badges and name references before the org transfer](https://github.com/vercel-labs/agent-desktop/pull/332) | Documented repository/docs/release change; no product UI claim tested. |
| [docs(readme): add Labs badges and plain title header](https://github.com/vercel-labs/agent-desktop/pull/334) | Documented repository/docs/release change; no product UI claim tested. |
| [chore: point repository links at vercel-labs/agent-desktop after the org transfer](https://github.com/vercel-labs/agent-desktop/pull/333) | Documented repository/docs/release change; no product UI claim tested. |
| [feat: add the docs site served at agent-browser.dev/desktop](https://github.com/vercel-labs/agent-desktop/pull/335) | Documented repository/docs/release change; no product UI claim tested. |
| [docs: add the technical-writer skill for docs and other prose](https://github.com/vercel-labs/agent-desktop/pull/336) | Documented repository/docs/release change; no product UI claim tested. |
| [docs: add the architecture-diagram skill for the docs site](https://github.com/vercel-labs/agent-desktop/commit/f7ec3f012c281d4d7604788acae7ef988f48b418) | Documented repository/docs/release change; no product UI claim tested. |
| [chore: stop ignoring .agents](https://github.com/vercel-labs/agent-desktop/commit/c7394e3b577d67e19514b37d460b1bc86b06ed76) | Documented repository/docs/release change; no product UI claim tested. |
| [chore: ignore settings.local.json](https://github.com/vercel-labs/agent-desktop/commit/f73abd9f3050bc85adb6bd027cb84f1ffc4813c5) | Documented repository/docs/release change; no product UI claim tested. |
| [chore: move the settings.local.json ignore to the global git config](https://github.com/vercel-labs/agent-desktop/commit/da8a0c24fcec91442e47ca09945e6bc14ced7c83) | Documented repository/docs/release change; no product UI claim tested. |
| [docs: add the diagram component and the getting started pages (1/4)](https://github.com/vercel-labs/agent-desktop/pull/337) | Documented repository/docs/release change; no product UI claim tested. |
| [docs: document snapshots, refs, skeleton drill-down, and the other core concepts (2/4)](https://github.com/vercel-labs/agent-desktop/pull/340) | Documented repository/docs/release change; no product UI claim tested. |
| [docs: add the reference for all 60 commands and configuration (3/4)](https://github.com/vercel-labs/agent-desktop/pull/339) | Documented repository/docs/release change; no product UI claim tested. |
| [docs: add the guides, platform pages, C library docs, and changelog (4/4)](https://github.com/vercel-labs/agent-desktop/pull/338) | Documented repository/docs/release change; no product UI claim tested. |
| [chore: prepare version 1.0.2](https://github.com/vercel-labs/agent-desktop/pull/341) | Documented repository/docs/release change; no product UI claim tested. |

### v1.1.0 (since v1.0.2)

| Change | Evidence / validation boundary |
| --- | --- |
| [fix(windows): stop commands crashing at exit](https://github.com/vercel-labs/agent-desktop/pull/342) | Documented; Windows unavailable. |
| [fix(windows): stop scaling the overlay's coordinates twice](https://github.com/vercel-labs/agent-desktop/pull/343) | Documented; Windows unavailable. |
| [fix(windows): stop the overlay flashing a black square when it starts](https://github.com/vercel-labs/agent-desktop/pull/344) | Documented; Windows unavailable. |
| [fix(windows): type CR LF as one line break](https://github.com/vercel-labs/agent-desktop/pull/368) | Documented; Windows unavailable. |
| [feat(windows): draw image cursors in the overlay](https://github.com/vercel-labs/agent-desktop/pull/345) | Documented; Windows unavailable. |
| [fix(macos): draw overlay controls as they arrive and hide a cleared label](https://github.com/vercel-labs/agent-desktop/pull/346) | Documented; renderer startup checked, visual repaint/label clearance unverified. |
| [feat(core): move the cursor before taking the interaction lease](https://github.com/vercel-labs/agent-desktop/pull/347) | Source-inspected; no concurrency or physical-input trial. |
| [feat: add `type --interval-ms` to type at a steady pace](https://github.com/vercel-labs/agent-desktop/pull/348) | Observed: semantic paced text, three graphemes; unsupported field refused. |
| [feat(core, macos): show the insertion caret after text entry](https://github.com/vercel-labs/agent-desktop/pull/349) | Source-inspected; text result observed, caret pixels unverified. |
| [feat(windows): show the insertion caret after text entry](https://github.com/vercel-labs/agent-desktop/pull/350) | Documented; Windows unavailable. |
| [fix(macos): stop clipping the click highlight's glow and pop](https://github.com/vercel-labs/agent-desktop/pull/352) | Documented; click-glow pixels unverified. |
| [fix: keep the overlay caret on the insertion point after key presses](https://github.com/vercel-labs/agent-desktop/pull/353) | Source-inspected; physical key/caret follow untested. |
| [fix(macos): place the caret on an indented new line](https://github.com/vercel-labs/agent-desktop/pull/354) | Documented; multiline caret placement untested. |
| [feat: draw the cursor label as a pill that fits its text](https://github.com/vercel-labs/agent-desktop/pull/357) | Documented; label sizing/clipping unverified. |
| [feat: colour the cursor with the accent unless a fill is set](https://github.com/vercel-labs/agent-desktop/pull/361) | Documented; custom label/size enabled, color fidelity unverified. |
| [Video remove](https://github.com/vercel-labs/agent-desktop/pull/421) | Source/documentation: video interface removed; no recording run. |
| [fix: remove the macOS command host](https://github.com/vercel-labs/agent-desktop/pull/414) | Source-inspected; changing-during-wait passed twice. Legacy-host retirement not manufactured. |
| [feat(macos): re-identify refs through the element's own accessibility address](https://github.com/vercel-labs/agent-desktop/pull/441) | Observed: identical twins addressed separately and removed refs refused, twice. |
| [feat(identity): resolve Linux and Windows refs through a capture rule](https://github.com/vercel-labs/agent-desktop/pull/442) | Source-inspected docs/contract only; Windows/Linux not run. |
| [Move feature requests and questions to Discussions](https://github.com/vercel-labs/agent-desktop/commit/060c83af4be63096de33fc22d79fb9c4d02f528e) | Documented repository/docs/release change; no product UI claim tested. |
| [fix(macos): reach the Dock, menu bar status items and system panels](https://github.com/vercel-labs/agent-desktop/pull/480) | Observed: owned status snapshot/drill and headless Dock/status surface resolution. Windowless/private panels untested. |
| [chore: prepare version 1.1.0](https://github.com/vercel-labs/agent-desktop/pull/508) | Documented repository/docs/release change; no product UI claim tested. |

### v1.2.0 (since v1.1.0)

| Change | Evidence / validation boundary |
| --- | --- |
| [feat(macos): select list rows that only their container can select](https://github.com/vercel-labs/agent-desktop/pull/503) | Source-inspected; ordinary table click did not select, table select did. Container-only case not proven. |
| [fix(macos): draw the cursor overlay above menus and system panels](https://github.com/vercel-labs/agent-desktop/pull/511) | Source-inspected; menu-level visual stacking unverified. |
| [docs: simplify the README and repo docs](https://github.com/vercel-labs/agent-desktop/pull/481) | Documented repository/docs/release change; no product UI claim tested. |
| [docs: document the homebrew-core install](https://github.com/vercel-labs/agent-desktop/pull/524) | Documented; Homebrew formula install/upgrade not run. |
| [feat: agent-desktop mcp](https://github.com/vercel-labs/agent-desktop/pull/519) | Observed: 67 tools, same workload, fixed-global rejection, EOF exit/session cleanup. Cancellation not exercised. |
| [fix(macos): ignore exited apps in the workspace inventory](https://github.com/vercel-labs/agent-desktop/pull/371) | Source-inspected; owned process exit checked at cleanup, stale-workspace race not reproduced. |
| [fix: preserve partial snapshots after observation expires](https://github.com/vercel-labs/agent-desktop/pull/372) | Observed: successful partial snapshots at explicit budgets; earlier setup timeouts remain distinct. |
| [feat: accept stdin for text commands](https://github.com/vercel-labs/agent-desktop/pull/373) | Observed: UTF-8 stdin value/write/readback and result-value omission. Clipboard stdin not tested. |
| [fix: start the macos cursor overlay outside the caller's directory](https://github.com/vercel-labs/agent-desktop/pull/381) | Source-inspected current_dir("/"); identical-byte basename probe still 0/1/0. cwd fix is not basename fix. |
| [chore: release 1.2.0 with mcp support](https://github.com/vercel-labs/agent-desktop/pull/568) | Documented repository/docs/release change; no product UI claim tested. |

## Newer main changes, not in 1.2.0

The cloned main branch was [the libproc inventory change](https://github.com/vercel-labs/agent-desktop/commit/b43ac4f6). It has two commits beyond 1.2.0. They were researched with their discussion and source diffs, but no development build was installed or executed. Do not attribute them to the installed runtime.

| Unreleased change | Boundary |
| --- | --- |
| [Resolve native menus and verify lifecycle transitions](https://github.com/vercel-labs/agent-desktop/pull/376) | Process-owned menu refs, title changes and wait/focus verification. Source/discussion only; not a result for 1.2.0. |
| [Replace spawned process inventory with libproc](https://github.com/vercel-labs/agent-desktop/pull/573) | Avoid external process-list calls and skip malformed names. Source/discussion only; no new timing claim. |

## What the discussion added

All 44 linked release PRs were fetched with conversation comments, reviews and review threads/replies. Each connection fit its 100-item page and reported no next page; nested reply pagination was checked separately. The two unreleased PRs were fetched too. Bot deployment previews, empty approvals and popularity were not used as runtime evidence. Material caveats:

- [Explicit snapshot-budget reproduction](https://github.com/vercel-labs/agent-desktop/pull/372) showed that default and explicit budgets previously diverged. This refresh therefore tested explicit short budgets and distinguished setup timeouts from actual partial trees.
- [Command-host discussion](https://github.com/vercel-labs/agent-desktop/pull/414) supplied a changing-during-wait counterexample and warned that removing the host without replacement identity could retarget a stale twin. Both mechanisms received live probes here.
- [Identity contract review](https://github.com/vercel-labs/agent-desktop/pull/442) distinguishes native index gaps, subtree replacement, unnamed-but-distinct controls and whole-window proof cost. The [1.1.0 release review](https://github.com/vercel-labs/agent-desktop/pull/508) flags compatibility changes despite a minor version. Fresh refs and version-matched skills remain necessary.
- [MCP cancellation review](https://github.com/vercel-labs/agent-desktop/pull/519) caught force-kill leaving Linux input held; released source sends SIGTERM before a bounded kill. That is source evidence, not a local cancellation trial or rollback guarantee.
- [Installation-doc review](https://github.com/vercel-labs/agent-desktop/pull/481) corrected global npm approval instructions and removed obsolete private-TMPDIR host requirements. No install or permission change was needed here.
- [Cursor issue and replies](https://github.com/vercel-labs/agent-desktop/issues/385) separate macOS version claims from the executable-name mechanism. The issue was open at observation; the same-byte 1.2.0 probe confirmed the mechanism still applies.

## Refresh triggers

Rerun affected cases when the binary/helper, resolved filename, server globals, OS, permission owner, app build, or new release changes. Windows/Linux, container-only rows, visual cursor/caret fidelity, notifications, physical input and concurrency remain open coverage, not failed capabilities.
