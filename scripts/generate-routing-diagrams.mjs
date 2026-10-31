#!/usr/bin/env node
// One priority source feeds the executable policy and the full-tree fragment and focused native diagram.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import orders from "../skills/vp-interaction-routing/references/native-route-order.json" with { type: "json" };

const root = new URL("../", import.meta.url);
const checkOnly = process.argv.includes("--check");
const routes = {
  "host-first-party-computer-use": { id: "O", label: "Use the selected host's first-party Computer Use" },
  "agent-desktop": { id: "AD", label: "Use agent-desktop" },
  "healthy-codex-cua-bridge": { id: "S", label: "Use the registered healthy Codex CUA bridge" },
  "peekaboo": { id: "T", label: "Use Peekaboo" },
};
assert.ok(Array.isArray(orders) && orders.length);
assert.equal(new Set(orders).size, orders.length, "duplicate native route");
for (const route of orders) assert.ok(routes[route], `unknown route ${route}`);

function question(route) {
  if (route === "host-first-party-computer-use") {
    return "This harness's first-party computer use<br/>available, capable and eligible?";
  }
  if (route === "healthy-codex-cua-bridge") {
    return "Identified non-Codex harness with a registered<br/>healthy, capable and eligible macOS Codex bridge?";
  }
  if (route === "peekaboo") return "Peekaboo on macOS<br/>available, capable and eligible?";
  return "agent-desktop<br/>available, capable and eligible?";
}

function combinedFragment() {
  const lines = [
    "  %% BEGIN GENERATED NATIVE ROUTING",
    '  N0["Check original constraints, current inventory,<br/>platform, exact action, input mode and readback"] --> NQ0',
  ];
  orders.forEach((route, index) => {
    const node = `NQ${index}`;
    lines.push(`  ${node}{${JSON.stringify(question(route))}}`);
    lines.push(`  ${node} -->|Yes| ${routes[route].id}`);
    lines.push(`  ${node} -->|No| ${index + 1 < orders.length ? `NQ${index + 1}` : "U0"}`);
  });
  for (const [route, { id, label }] of Object.entries(routes)) {
    lines.push(`  ${id}[${JSON.stringify(`${label}<br/><small>route: ${route}</small>`)}]`);
  }
  lines.push("  %% END GENERATED NATIVE ROUTING");
  return lines.join("\n");
}

function standalone() {
  const lines = ["flowchart TD", '  A["Native UI request<br/>retain original requirements"] --> Q0'];
  orders.forEach((route, index) => {
    const label = routes[route].label;
    lines.push(`  Q${index}{${JSON.stringify(question(route))}}`);
    lines.push(`  Q${index} -->|Yes| R${index}[${JSON.stringify(label)}]`);
    lines.push(`  R${index} --> V`);
    lines.push(`  Q${index} -->|No| ${index + 1 < orders.length ? `Q${index + 1}` : "P"}`);
  });
  lines.push(
    '  P{"Verified pixel input satisfies<br/>every original constraint?"}',
    '  P -->|Yes| PX["Use that acting surface with fresh coordinates"]',
    "  PX --> V",
    '  P -->|No| STOP["Report interface conflict or capability unavailable"]',
    '  V["Act once and read back the predicate<br/>verify and clean up"]',
  );
  return lines.join("\n");
}

const nativeDocument = `# Native UI Decision Tree

Read this reference when routing native apps, browser chrome or OS UI. Complete
the connector/API/service-CLI and page-DOM gates in the
[full decision tree](decision-tree.md) first. Identify the current harness before
selecting a native driver.

An eligible candidate must be available, authorized, supported on the platform,
compatible with an explicit interface choice, capable of the exact action and
all original input/state requirements, and able to read back the result. Apply
the same gate to every fallback. A policy or action denial is not a capability
gap that another tool may bypass.

## Shared selection policy

Every harness follows one order: its own first-party tool, agent-desktop, an
eligible registered healthy macOS Codex bridge, then Peekaboo. The current
harness determines the first-party tool identity and bridge eligibility; it
does not select a different tree. For Codex, the first-party tool is Codex
Computer Use and the bridge is always ineligible. An unknown harness cannot
use the bridge. Missing installation or registration does not authorize setup.
This is a selection preference among capable eligible tools, not a proven
performance ranking. Neither a microbenchmark nor a visible cursor preference
overrides the order.

\`\`\`mermaid
${standalone()}
\`\`\`

## Execution and maintenance

Use [native UI routing](native-ui-routing.md) for discovery, cursor caveats,
session lifecycle and exact-target rules. A failed action needs observation
before retry or switching; rederive identifiers after a switch. A visible cursor
requirement needs actual renderer/visibility evidence, not just a saved setting.

The diagrams and executable candidate order use
[native-route-order.json](native-route-order.json). Change that source and run
\`npm run routing:generate\`; \`npm run routing:check\` rejects stale diagrams.
Research runs and PK observations live under the repository's
\`docs/research/desktop-automation/\`, outside the skill's execution content.
They inform changes but are not runtime inventory or required per-task reading.
`;

function output(relative, expected) {
  const url = new URL(relative, root);
  if (checkOnly) {
    assert.equal(readFileSync(url, "utf8"), expected,
      `${fileURLToPath(url)} is stale; run npm run routing:generate`);
  } else writeFileSync(url, expected);
}

const treePath = "skills/vp-interaction-routing/references/decision-tree.md";
const current = readFileSync(new URL(treePath, root), "utf8");
const marker = /  %% BEGIN GENERATED NATIVE ROUTING[\s\S]*?  %% END GENERATED NATIVE ROUTING/;
assert.match(current, marker, "full tree must retain the generated native-section markers");
output(treePath, current.replace(marker, combinedFragment()));
output("skills/vp-interaction-routing/references/native-decision-tree.md", nativeDocument);
console.log(checkOnly ? "Routing diagrams match policy." : "Routing diagrams generated.");
