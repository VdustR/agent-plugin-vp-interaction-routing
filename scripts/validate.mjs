#!/usr/bin/env node
// Repository checks: the two manifests and the two MCP configs must stay
// consistent, and every test suite must be discovered.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeMarkdownForInvariant } from "./normalize-markdown.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`  FAIL ${name}: ${error.message}`);
  }
};

const AGENT_PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const AGENT_MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
// Only these keys are permitted: the published plugin schema is closed.
const PLUGIN_KEYS = new Set([
  "$schema", "name", "version", "description", "author",
  "homepage", "repository", "license", "keywords", "extensions",
]);

check("plugin.json declares the agent-plugins schema", () => {
  assert.equal(read("plugin.json").$schema, AGENT_PLUGIN_SCHEMA);
});

check("plugin.json uses only schema-permitted keys", () => {
  const extra = Object.keys(read("plugin.json")).filter((k) => !PLUGIN_KEYS.has(k));
  assert.deepEqual(extra, [], `additionalProperties is false, so remove: ${extra}`);
});

check("plugin name matches the spec pattern", () => {
  const { name } = read("plugin.json");
  assert.match(name, /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/);
  assert.ok(name.length <= 64);
});

check("mcp.json declares the agent-plugins schema", () => {
  assert.equal(read("mcp.json").$schema, AGENT_MCP_SCHEMA);
});

check("package metadata and all three manifests agree", () => {
  const a = read("plugin.json");
  for (const other of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) {
    const m = read(other);
    for (const key of ["name", "version", "description"]) {
      assert.equal(m[key], a[key], `${key} differs in ${other}`);
    }
  }
  const pkg = read("package.json");
  assert.equal(pkg.version, a.version, "version differs in package.json");
  assert.equal(pkg.description, a.description, "description differs in package.json");
});

check("the Codex refusal is enforced at runtime, not by packaging", () => {
  // Codex reads the same `.mcp.json` Claude Code does, verified by installing
  // probe plugins that each carried exactly one MCP config filename: only
  // `.mcp.json` was picked up. Packaging therefore cannot keep the server away
  // from Codex, so the routing rule has to be enforced in the bridge.
  const bridge = readFileSync(
    join(root, "skills/vp-interaction-routing/scripts/codex-cua-bridge.mjs"), "utf8");
  assert.match(bridge, /function isCodexClient/, "the bridge must detect a Codex client");
  assert.match(bridge, /refuses calls from Codex/, "and refuse its tool calls");
  assert.match(bridge, /CODEX_CUA_BRIDGE_ALLOW_CODEX/, "with a deliberate override");
  assert.ok(existsSync(join(root, ".agents/plugins/marketplace.json")),
    "Codex needs its marketplace manifest to install the plugin");
});

check("every MCP config differs only by the plugin-root variable", () => {
  // One server, three client formats. Normalizing the root variable makes the
  // entries comparable, so editing one file without mirroring it into the others
  // fails here rather than at install time.
  const configs = [
    ["mcp.json", "PLUGIN_ROOT"],
    [".mcp.json", "CLAUDE_PLUGIN_ROOT"],
    ["mcp_config.json", "PLUGIN_ROOT"],
  ];
  const normalize = (entry, variable) =>
    JSON.parse(JSON.stringify(entry).replaceAll("${" + variable + "}", "${ROOT}"));
  const [[baseFile, baseVar], ...rest] = configs;
  const base = read(baseFile).mcpServers;
  for (const [file, variable] of rest) {
    const other = read(file).mcpServers;
    assert.deepEqual(Object.keys(other).sort(), Object.keys(base).sort(),
      `server names differ in ${file}`);
    for (const name of Object.keys(base)) {
      assert.deepEqual(normalize(other[name], variable), normalize(base[name], baseVar),
        `server "${name}" in ${file} differs beyond the root variable`);
    }
  }
});

check("each MCP config uses its own client's root variable", () => {
  const raw = (f) => readFileSync(join(root, f), "utf8");
  assert.match(raw("mcp.json"), /\$\{PLUGIN_ROOT\}/);
  assert.doesNotMatch(raw("mcp.json"), /CLAUDE_PLUGIN_ROOT/);
  assert.match(raw(".mcp.json"), /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.match(raw("mcp_config.json"), /\$\{PLUGIN_ROOT\}/);
  assert.doesNotMatch(raw("mcp_config.json"), /CLAUDE_PLUGIN_ROOT/);
});

check("every referenced command path exists", () => {
  for (const file of ["mcp.json", ".mcp.json", "mcp_config.json"]) {
    for (const entry of Object.values(read(file).mcpServers)) {
      for (const arg of entry.args ?? []) {
        const rel = arg.replace(/^\$\{[A-Z_]+\}\//, "");
        assert.ok(existsSync(join(root, rel)), `${file} points at missing ${rel}`);
      }
    }
  }
});

check("the bridge is executable", () => {
  const p = join(root, "skills/vp-interaction-routing/scripts/codex-cua-bridge.mjs");
  assert.ok(statSync(p).mode & 0o111, "needs the executable bit for a bare-path command");
});

check("every skill has a SKILL.md with name and description", () => {
  const dirs = readdirSync(join(root, "skills"), { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  );
  assert.ok(dirs.length > 0, "no skills found");
  for (const dir of dirs) {
    const md = join(root, "skills", dir.name, "SKILL.md");
    assert.ok(existsSync(md), `${dir.name} has no SKILL.md`);
    const front = readFileSync(md, "utf8").split("---")[1] ?? "";
    assert.match(front, /\bname:/, `${dir.name} frontmatter has no name`);
    assert.match(front, /\bdescription:/, `${dir.name} frontmatter has no description`);
    assert.ok(
      front.includes(`name: ${dir.name}`),
      `${dir.name} frontmatter name must match its directory`,
    );
  }
});

check("every reference file is linked from its SKILL.md", () => {
  for (const dir of readdirSync(join(root, "skills"))) {
    const refs = join(root, "skills", dir, "references");
    if (!existsSync(refs)) continue;
    const md = readFileSync(join(root, "skills", dir, "SKILL.md"), "utf8");
    for (const file of readdirSync(refs)) {
      assert.ok(md.includes(file), `references/${file} is not linked from ${dir}/SKILL.md`);
    }
  }
});

check("routing cases cover every capability leaf with explicit verification", () => {
  const cases = read("fixtures/routing-cases.json");
  assert.ok(Array.isArray(cases) && cases.length > 0, "routing cases must be a non-empty array");

  const decisionTree = readFileSync(
    join(root, "skills/vp-interaction-routing/references/decision-tree.md"), "utf8");
  const routeMarkers = [...decisionTree.matchAll(/^\s*%% route-id: ([a-z0-9-]+)\s*$/gm)]
    .map((match) => match[1]);
  assert.ok(routeMarkers.length > 0, "the decision tree needs route-id markers");
  assert.equal(new Set(routeMarkers).size, routeMarkers.length,
    "decision-tree route-id markers must be unique");
  const requiredRoutes = new Set(routeMarkers);
  const names = new Set();
  const coveredRoutes = new Set();

  for (const routeCase of cases) {
    assert.equal(typeof routeCase.name, "string", "every case needs a name");
    assert.ok(!names.has(routeCase.name), `duplicate routing case: ${routeCase.name}`);
    names.add(routeCase.name);
    assert.equal(typeof routeCase.surface, "string", `${routeCase.name} needs a surface`);
    assert.ok(Array.isArray(routeCase.requirements) && routeCase.requirements.length > 0,
      `${routeCase.name} needs at least one requirement`);
    assert.equal(typeof routeCase.expectedRoute, "string",
      `${routeCase.name} needs an expectedRoute`);
    assert.equal(typeof routeCase.fallback, "string", `${routeCase.name} needs a fallback`);
    assert.equal(typeof routeCase.verification, "string",
      `${routeCase.name} needs an explicit verification predicate`);
    coveredRoutes.add(routeCase.expectedRoute);
  }

  assert.deepEqual(
    [...requiredRoutes].filter((route) => !coveredRoutes.has(route)),
    [],
    "every decision-tree capability leaf needs a routing case",
  );
  assert.deepEqual(
    [...coveredRoutes].filter((route) => !requiredRoutes.has(route)),
    [],
    "routing cases must not name a leaf absent from the decision tree",
  );
  assert.ok(cases.some((routeCase) =>
    routeCase.interfaceConstraint &&
    routeCase.expectedRoute === "report-constraint-conflict" &&
    routeCase.fallback === "none"),
    "an incapable explicit interface needs a terminal conflict case");
  assert.ok(cases.some((routeCase) =>
    routeCase.requirements.includes("managed-identity") &&
    routeCase.requirements.includes("required-session-absent") &&
    routeCase.verification.includes("session-predicate-before-action")),
    "a managed identity needs session verification before action");
  assert.ok(cases.some((routeCase) =>
    routeCase.requirements.includes("in-app-unavailable") &&
    routeCase.requirements.includes("real-lifecycle") &&
    routeCase.expectedRoute === "playwright-or-background-chromium"),
    "Tier C must be evaluated before fallback browser selection");
});

// Content invariants carried over from the skills repository's smoke-fixture
// validator. Extracting the skill would otherwise silently drop this coverage.
const FIXTURE = "fixtures/smoke/vp-interaction-routing.md";
const SKILL = "skills/vp-interaction-routing/SKILL.md";
const BROWSER = "skills/vp-interaction-routing/references/browser-routing.md";
const NATIVE = "skills/vp-interaction-routing/references/native-ui-routing.md";
const ADAPTERS = "skills/vp-interaction-routing/references/agent-adapters.md";
const BRIDGE_REFERENCE =
  "skills/vp-interaction-routing/references/codex-cua-bridge.md";
const BRIDGE_SCRIPT = "skills/vp-interaction-routing/scripts/codex-cua-bridge.mjs";

const INVARIANTS = [
  [FIXTURE, /connector.*GitHub|GitHub.*connector/, "fixture must prefer semantic connectors"],
  [FIXTURE, /verified.*(existing|user.s).*(tabs|login|session)|product label alone is not/,
    "fixture must require evidence of shared browser state"],
  [FIXTURE, /agent-browser.*(isolated|repeatable|managed)/,
    "fixture must cover isolated agent-browser state"],
  [FIXTURE, /app-server.*MCP bridge|MCP bridge.*app-server/,
    "fixture must require an app-server bridge"],
  [FIXTURE, /Peekaboo.*(windows|menus|dialogs|Spaces|unfocused|accessibility)/,
    "fixture must preserve Peekaboo's extended role"],
  [FIXTURE, /Do not reuse selectors|invalidates prior selectors/,
    "fixture must invalidate selectors after switching"],
  [FIXTURE, /installing or registering a bridge/,
    "fixture must cover bridge installation authorization"],
  [FIXTURE, /Peekaboo as the native UI fallback/, "fixture must exercise the Peekaboo fallback"],
  [FIXTURE, /Prefer background accessibility actions in Peekaboo/,
    "fixture must prefer background Peekaboo actions"],
  [FIXTURE, /without `--app` or `--pid`/,
    "fixture must require process-targeted Peekaboo input"],
  [FIXTURE, /open -g -a.*cold-launched/s,
    "fixture must route cold background app launches outside Peekaboo"],
  [FIXTURE, /Electron apps.*menu list.*keyboard shortcuts.*per target\s+app rather than for Electron as a class/s,
    "fixture must prefer menu-discovered Electron keyboard paths and scope the click route per app"],
  [FIXTURE, /`--snapshot` from a fresh `see`.*`effect: unverifiable`.*capture-and-compare.*semantic\s+predicate/s,
    "fixture must verify material Peekaboo effects and fresh coordinate snapshots"],
  [FIXTURE, /native\s+file\s+or folder picker will\s+take the foreground/s,
    "fixture must budget Electron native-picker foreground cost"],
  [FIXTURE, /screenshot render pump.*visibility shim.*background Chromium/s,
    "fixture must cover all three hidden-page fallback tiers"],
  [FIXTURE, /800 CSS px.*1000 CSS px.*device scale factor 2.*2000 px/s,
    "fixture must preserve screenshot fidelity limits"],
  [FIXTURE, /capture legible 9 px text.*currently shown at a 1280 CSS px-wide\s+viewport.*tall full-page.*not a required\s+output layout constraint/s,
    "fixture prompt must exercise screenshot fidelity routing"],
  [FIXTURE, /page content as untrusted data/, "fixture must cover untrusted page content"],
  [FIXTURE, /sending, publishing, purchasing, or deleting/,
    "fixture must preserve browser mutation authorization"],
  [FIXTURE, /Do not\s+add a separate confirmation gate.*host policy.*without prompting/s,
    "fixture must not impose extra confirmation gates"],
  [SKILL, /confirmation policy automatically/,
    "skill must preserve bridge authorization boundaries"],
  [BROWSER, /untrusted data, not agent instructions/,
    "browser guidance must treat page content as untrusted"],
  [BROWSER, /vp-agent-browser-session/,
    "must delegate profile lifecycle rules to their owner skill"],
  [BROWSER, /Codex in Chrome, Claude in Chrome.*DOM-aware integration/s,
    "authenticated browser routing must prefer shared Chrome integrations"],
  [NATIVE, /requires explicit user authorization/,
    "must require authorization before bridge installation"],
  [NATIVE, /bridge are unavailable on macOS/, "must preserve the Peekaboo fallback"],
  [NATIVE, /Peekaboo.*contend with the user's own interaction/s,
    "must account for Peekaboo contention with the user"],
  [NATIVE, /Prefer background accessibility actions.*Use foreground interaction only/s,
    "must prefer background Peekaboo actions"],
  [NATIVE, /Always pass `--app`\s+or `--pid`/s,
    "Peekaboo background input must name its target process"],
  [NATIVE, /refuses a cold background `app launch`.*`open -g -a <App>`/s,
    "cold background app launch must route outside Peekaboo"],
  [NATIVE, /Untargeted\s+background input is refused rather than delivered/s,
    "untargeted Peekaboo input must be recorded as refused, not misdelivered"],
  [NATIVE, /`--app`\s+with a bare number is read as an application name/s,
    "process ids must not be passed through --app as bare numbers"],
  [NATIVE, /menu list --pid <pid>.*process-targeted `press` and `type`.*coordinate clicks only as a last resort/s,
    "Electron routing must prefer menu-discovered keyboard paths"],
  [NATIVE, /Background keyboard delivery into Electron web\s+content is not reliable/s,
    "Electron background keyboard input must be recorded as unreliable"],
  [NATIVE, /Probe the app with `see` before relying on it/,
    "background coordinate clicks must probe the target app's accessibility exposure"],
  [NATIVE, /a property of the app, not of Electron/,
    "Electron background-input limits must be scoped to the measured app"],
  [NATIVE, /measured against Peekaboo 4\.0\.0.*re-derive it from\s+the installed build/s,
    "Peekaboo observations must carry the build they were measured on"],
  [NATIVE, /native file or folder picker.*unavoidable foreground interruption/s,
    "Electron routing must budget native-picker foreground cost"],
  [NATIVE, /`effect: unverifiable` is not evidence of success.*compare\s+a follow-up capture.*semantic\s+readback/s,
    "material Peekaboo effects must have capture-and-compare readback"],
  [NATIVE, /`--snapshot` from a fresh\s+`see` capture of that\s+exact target window/s,
    "background coordinate clicks must use a fresh exact-window snapshot"],
  [BROWSER, /page lifecycle is not one fixed state[\s\S]*Measure it instead of assuming it/,
    "browser guidance must treat the pane lifecycle as measured, not fixed"],
  [BROWSER, /\| Pane hidden \|[\s\S]*\| Pane displayed, tab never selected \|[\s\S]*\| Pane displayed, tab selected \|/,
    "browser guidance must record every measured pane condition"],
  [BROWSER, /Claude desktop app [\d.]+ running its bundled Claude Code runtime [\d.]+,\s+on macOS [\d.]+/,
    "pane lifecycle measurements must name the client and pane build"],
  [BROWSER, /rather than from `claude --version`, which reports whichever CLI is on/,
    "the tested runtime must come from the session process, not the PATH CLI"],
  [BROWSER, /`visibilityState` does not predict rendering/,
    "visibility must not be used as a proxy for whether frames run"],
  [BROWSER, /`document\.hasFocus\(\)` was `false` in every condition/,
    "focus-gated page logic must stay routed to a shim or a real browser"],
  [BROWSER, /`navigate` always displays the pane,\s+while `javascript_tool` does not/,
    "browser guidance must record how each pane condition is produced"],
  [BROWSER, /a burst of 5 ticks in that one second.*`visibilityState`\s+stayed `hidden` throughout/s,
    "the Tier A render pump must record its measured effect and its limits"],
  [BROWSER, /the responsible call was not isolated/,
    "an unattributed visibility change must not be blamed on one call"],
  [BROWSER, /Tier A.*Tier B.*Tier C/s,
    "browser guidance must preserve the foreground simulation ladder"],
  [BROWSER, /open -g -n -a.*connectOverCDP/s,
    "browser guidance must include the background real-profile recipe"],
  [BROWSER, /dedicated managed\s+user-data directory.*profile singleton lock/s,
    "background Chromium must avoid active profile locks"],
  [BROWSER, /one-time startup check.*requires Tier C.*initialization script/s,
    "startup-only visibility checks must not rely on a late shim"],
  [BROWSER, /Read the page's own predicate first.*Never substitute the rAF counter for that read.*[Ee]scalate to Tier C/s,
    "the single-frame render pump must be gated on the page's own predicate"],
  [BROWSER, /`complete && naturalWidth > 0`.*`complete` alone is not that\s+predicate/s,
    "an image predicate must require successful decode, not just a finished request"],
  [BROWSER, /no tier fixes those.*only on evidence that the page needs real foreground semantics/s,
    "a running rAF with a false predicate must not escalate to Tier C by default"],
  [BROWSER, /Reserve port 9333.*confirm it is unused.*endpoint belongs to the process and managed profile/s,
    "the fixed CDP endpoint must be reserved and identity-checked"],
  [BROWSER, /no wider than 800 CSS px.*`preset: "desktop"`/s,
    "pane captures must preserve their measured fidelity ceiling"],
  [BROWSER, /1000 CSS px.*`deviceScaleFactor: 2`.*2000 px-wide/s,
    "file captures must preserve their measured fidelity recipe"],
  [SKILL, /do not add confirmation gates.*without prompting/s,
    "routing must honor permissive user authorization preferences"],
];

// Match prose independently of soft wrapping while preserving Markdown block
// boundaries. A pattern without the `s` flag remains unable to span blocks.
for (const [file, pattern, message] of INVARIANTS) {
  check(message, () => {
    const markdown = readFileSync(join(root, file), "utf8");
    assert.match(normalizeMarkdownForInvariant(markdown), pattern);
  });
}

check("bridge examples must not assume the global skill install path", () => {
  const reference = readFileSync(join(root, BRIDGE_REFERENCE), "utf8");
  assert.doesNotMatch(reference, /~\/.agents\/skills\/vp-interaction-routing/);
  assert.match(reference, /node "\$BRIDGE" --health/);
});

check("Codex routing must use the first-party Computer Use session surface", () => {
  for (const file of [SKILL, NATIVE, ADAPTERS]) {
    const guidance = readFileSync(join(root, file), "utf8");
    assert.match(guidance, /first-party Computer Use/,
      `${file} must name the public capability`);
    assert.doesNotMatch(guidance, /`node_repl`|`@oai\/sky`/,
      `${file} must not route Codex through internal tool names`);
  }
});

check("authenticated browser routing must preserve the preferred order", () => {
  const guidance = readFileSync(join(root, BROWSER), "utf8");
  const sharedChrome = guidance.indexOf("Codex in Chrome, Claude in Chrome");
  const agentBrowser = guidance.indexOf("agent-browser with a dedicated or managed profile");
  const desktop = guidance.indexOf("desktop automation only");
  assert.ok(sharedChrome >= 0 && sharedChrome < agentBrowser && agentBrowser < desktop,
    "shared Chrome must precede agent-browser, which must precede desktop automation");
});

check("native UI routing must preserve the low-contention order", () => {
  const guidance = readFileSync(join(root, NATIVE), "utf8");
  const firstParty = guidance.indexOf("Prefer Codex first-party Computer Use");
  const bridge = guidance.indexOf("otherwise use the Codex Computer Use bridge");
  const peekaboo = guidance.indexOf("Use the installed `peekaboo`");
  assert.ok(firstParty >= 0 && firstParty < bridge && bridge < peekaboo,
    "first-party Computer Use must precede the bridge, which must precede Peekaboo");
});

check("bridge internals must keep their upstream implementation contract", () => {
  const bridge = readFileSync(join(root, BRIDGE_SCRIPT), "utf8");
  assert.match(bridge, /callMcpTool\("node_repl", "js"/);
  assert.match(bridge, /import\("@oai\/sky"\)/);
});

const suites = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".test.mjs")) suites.push(p);
  }
})(join(root, "tests"));

check("test suites are discovered", () => {
  // An empty list would let `node --test` exit zero having run nothing.
  assert.ok(suites.length > 0, "no *.test.mjs found under tests/");
});

console.log(`\nChecked ${suites.length} test suites, running them serially.\n`);
execFileSync(process.execPath, ["--test", "--test-concurrency=1", ...suites], {
  stdio: "inherit",
  cwd: root,
});

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll repository checks passed.");
