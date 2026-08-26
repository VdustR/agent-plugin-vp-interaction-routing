# Agent Adapters

Map the capability names in this skill to the tools available in the current
agent. Tool discovery and installed tool documentation are authoritative; this
file records routing intent rather than a permanent tool inventory.

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
- Use Peekaboo only as a fallback or for missing macOS-specific capabilities;
  its live-desktop interaction can contend with the user.

## Claude Code

- Prefer MCP connectors, APIs, and repository CLIs for semantic operations.
- For authenticated web work, prefer Claude in Chrome when it is available and
  verified to share the user's real Chrome state. Use agent-browser for isolated
  or managed-profile automation.
- Use Claude Code first-party computer use when available and appropriate.
- A compatible Codex Computer Use MCP bridge is the next native-application
  option when it is registered in this client and healthy; this skill ships one
  at `scripts/codex-cua-bridge.mjs`, which still has to be registered before its
  tools exist in a session.
- Use Peekaboo only as a fallback or for missing macOS-specific capabilities;
  its live-desktop interaction can contend with the user.

## Antigravity

- Prefer MCP connectors, APIs, and repository CLIs for semantic operations.
- Use available DOM-aware browser tooling for web pages, but do not assume it
  shares the user's live browser state. Use agent-browser for isolated or
  managed-profile automation.
- Use Antigravity first-party computer use when available and appropriate.
- A compatible Codex Computer Use MCP bridge is the next native-application
  option when it is registered in this client and healthy; this skill ships one
  at `scripts/codex-cua-bridge.mjs`, which still has to be registered before its
  tools exist in a session.
- Use Peekaboo as the macOS fallback when first-party computer use and the
  bridge are unavailable, or for missing system and inspection capabilities.
  Account for contention with the user's live desktop before interacting.

Do not claim that an adapter is available merely because this file names it.
Discover the current session's tools and follow their directly matching skills
before acting.
