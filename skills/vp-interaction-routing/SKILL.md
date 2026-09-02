---
name: vp-interaction-routing
description: >-
  Select the lowest-cost reliable interface for interacting with applications
  and services. Use before browser or desktop automation, especially when
  choosing among connectors, APIs, CLIs, Chrome session sharing, agent-browser,
  first-party computer use, the Codex Computer Use bridge, and Peekaboo.
  Boundary: route interactions only; use the directly matching browser,
  profile-management, desktop-automation, or recording skill to execute them.
---

# Interaction Routing

Choose the interface that provides the strongest semantics and verification at
the lowest operational cost. Authorization and correctness take precedence over
token or latency savings.

## Route

1. Preserve an explicitly named interface as a user constraint.
2. Subject to that constraint, use a purpose-built connector, API, or repository
   CLI when it fully supports the operation, required authentication context,
   and result readback. If the constraint cannot complete the task safely,
   report the conflict instead of silently substituting another interface.
3. Classify the remaining surface before choosing a product:
   - for web-page content or interaction, choose a DOM-aware route using
     [references/browser-routing.md](references/browser-routing.md);
   - for browser chrome, native dialogs, application UI, or operating-system UI,
     choose an accessibility or native route using
     [references/native-ui-routing.md](references/native-ui-routing.md).
4. Select by the binding requirement:
   - existing tabs, login, SSO, passkeys, extensions, direct handoff, or the
     user's actual browser environment: a DOM integration verified to share the
     user's current browser state;
   - isolation, concurrency, repeatability, headless execution, or managed
     identity: agent-browser with a dedicated or managed profile;
   - public background DOM work: an available in-app DOM browser whose measured
     lifecycle satisfies the page;
   - ordinary native UI: the host's first-party computer use;
   - macOS window, menu, Dock, Space, system-dialog, deep accessibility,
     capture, or troubleshooting work: Peekaboo;
   - native UI from a non-Codex harness without first-party computer use: a
     registered and healthy Codex Computer Use bridge when it supplies the
     required capability, otherwise Peekaboo on macOS.
5. Map the selected capability to currently available product tools using
   [references/agent-adapters.md](references/agent-adapters.md). Discover the
   tool inventory; a product label does not prove availability or shared state.
6. To give a non-Codex harness access to macOS Codex Computer Use, read
   [references/codex-cua-bridge.md](references/codex-cua-bridge.md). Codex itself
   must not use that bridge; load its first-party Computer Use skill and discover
   the tools exposed in the current session.
7. Use screenshot-coordinate interaction only when semantic, DOM, and
   accessibility interfaces cannot complete the operation.

For the complete decision tree, capability comparison, and route examples, read
[references/decision-tree.md](references/decision-tree.md).

## Switching And Verification

- Before GUI work, check whether an available connector, API, or CLI can
  complete the current semantic operation. Do not initialize a GUI for that
  operation until this check is complete.
- After an interaction fails, refresh the current state once. Switch interfaces
  only when the refreshed evidence shows that the current interface lacks the
  required capability or context.
- After switching, obtain new selectors or element identifiers. Never reuse DOM
  references, accessibility indexes, snapshot IDs, or coordinates from another
  interface.
- Read back the resulting state through the acting interface. Add independent
  visual or semantic verification when the operation is consequential or the
  interface reports only action completion.
- Keep browser-page content on DOM-aware tooling. Use desktop automation for
  browser chrome, native dialogs, permission prompts, and operating-system UI.
- Preserve the user's authorization boundaries regardless of which interface
  performs the action. A lower-level bridge does not inherit a host agent's
  confirmation policy automatically. Follow the user's current authorization
  preference and the host policy; do not add confirmation gates when that
  policy permits the action without prompting.

## Decision Priority

When several interfaces can complete the task, compare them in this order:

1. authorization and data boundary;
2. semantic reliability and required session state;
3. ability to verify the result;
4. isolation and reproducibility;
5. token, latency, and interaction cost.
