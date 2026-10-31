# Agent Adapters

Map the capability names in this skill to the tools available in the current
agent. Tool discovery and installed tool documentation are authoritative; this
file records routing intent rather than a permanent tool inventory.

## Native Candidate Gate

Read the [native decision tree](native-decision-tree.md). Codex selects its
first-party Computer Use whenever capable, then agent-desktop, then Peekaboo.
Other harnesses also start with their own first-party tool, then verified
agent-desktop, then an eligible registered healthy bridge, then Peekaboo. The
first-party-first principle is shared; the first-party tool identity and bridge
eligibility differ. This is not a measured ranking of every host's own driver.
Preserve explicit tool requests and all input/platform constraints. Archived PK
results are under the repository's `docs/research/desktop-automation/`; current
availability and exact operation support still require discovery.

## Codex

- Prefer Apps, connectors, APIs, and repository CLIs for semantic operations.
- For authenticated web work, prefer Codex in Chrome when it is available and
  verified to share the user's real Chrome state. Use agent-browser for isolated
  or managed-profile automation.
- Use Codex first-party Computer Use for ordinary native applications.
- Do not route Codex through a Codex Computer Use MCP bridge. The bridge exists
  to open this capability to other harnesses. Load the installed first-party
  Computer Use skill, discover its current session tools, and follow its
  authorization rules.
- Use Peekaboo after capable agent-desktop, or for a remaining macOS capability;
  its live-desktop interaction can contend with the user.

## Claude Code

- Prefer MCP connectors, APIs, and repository CLIs for semantic operations.
- For authenticated web work, prefer Claude in Chrome when it is available and
  verified to share the user's real Chrome state. Use agent-browser for isolated
  or managed-profile automation.
- Prefer Claude Code first-party computer use when available and capable.
  Use verified agent-desktop next when the first-party route is ineligible.
- A compatible Codex Computer Use MCP bridge is another native-application
  option when it is registered in this client and healthy; this skill ships one
  at `scripts/codex-cua-bridge.mjs`, which still has to be registered before its
  tools exist in a session.
- Use Peekaboo after capable agent-desktop, or for a remaining macOS capability;
  its live-desktop interaction can contend with the user.

## Antigravity

- Prefer MCP connectors, APIs, and repository CLIs for semantic operations.
- Use available DOM-aware browser tooling for web pages, but do not assume it
  shares the user's live browser state. Use agent-browser for isolated or
  managed-profile automation.
- Prefer Antigravity first-party computer use when available and capable.
  Use verified agent-desktop next when the first-party route is ineligible.
- A compatible Codex Computer Use MCP bridge is another native-application
  option when it is registered in this client and healthy; this skill ships one
  at `scripts/codex-cua-bridge.mjs`, which still has to be registered before its
  tools exist in a session.
- Prefer capable agent-desktop before Peekaboo. Retain Peekaboo for remaining
  macOS system/inspection requirements.
  Account for contention with the user's live desktop before interacting.

## Every Adapter

- Foreground cost, page lifecycle, and capture resolution are properties of the
  installed build, not of the adapter category. Measure them in the current
  session rather than inheriting a value recorded here or in a reference table.
- A shared-state integration sandboxes itself to its own tab container. Reaching
  one of the user's existing tabs means moving that tab into the container,
  which is a change to the user's window that the user makes or approves.
- An existing login can be carried into a dedicated profile, so it does not by
  itself select a shared-state integration. Verify the carried session before
  the first consequential action.

Do not claim that an adapter is available merely because this file names it.
Discover the current session's tools and follow their directly matching skills
before acting.
