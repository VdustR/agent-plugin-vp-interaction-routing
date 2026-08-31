#!/usr/bin/env node
// Repository checks: the two manifests and the two MCP configs must stay
// consistent, and every test suite must be discovered.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  [FIXTURE, /Electron apps.*menu list.*keyboard shortcuts.*Never background-click/s,
    "fixture must prefer menu-discovered Electron keyboard paths"],
  [FIXTURE, /`--snapshot` from a fresh `see`.*`effect: unverifiable`.*capture-and-compare.*semantic\s+predicate/s,
    "fixture must verify material Peekaboo effects and fresh coordinate snapshots"],
  [FIXTURE, /native\s+file\s+or folder picker will take the foreground/s,
    "fixture must budget Electron native-picker foreground cost"],
  [FIXTURE, /screenshot render pump.*visibility shim.*background Chromium/s,
    "fixture must cover all three hidden-page fallback tiers"],
  [FIXTURE, /800 CSS px.*1000 CSS px.*device scale factor 2.*2000 px/s,
    "fixture must preserve screenshot fidelity limits"],
  [FIXTURE, /capture a 1280 CSS px-wide page.*legible 9 px text.*tall full-page/s,
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
  [NATIVE, /Peekaboo 4\.1.*cold background `app launch`.*`open -g -a <App>`/s,
    "cold background app launch must avoid Peekaboo 4.1"],
  [NATIVE, /menu list --app <pid>.*process-targeted `press` and `type`.*coordinate clicks only as a last resort/s,
    "Electron routing must prefer menu-discovered keyboard paths"],
  [NATIVE, /never for Electron web\s+content.*`effect: unverifiable`/s,
    "Electron web content must reject background coordinate clicks"],
  [NATIVE, /native file or folder picker.*unavoidable foreground interruption/s,
    "Electron routing must budget native-picker foreground cost"],
  [NATIVE, /`effect: unverifiable` is not evidence of success.*compare a follow-up capture.*semantic readback/s,
    "material Peekaboo effects must have capture-and-compare readback"],
  [NATIVE, /`--snapshot` from a fresh `see` capture of that\s+exact target window/s,
    "background coordinate clicks must use a fresh exact-window snapshot"],
  [BROWSER, /document\.visibilityState.*Permanently `hidden`[\s\S]*0 ticks in 2 seconds/,
    "browser guidance must record the pane's hidden lifecycle"],
  [BROWSER, /Tier A.*Tier B.*Tier C/s,
    "browser guidance must preserve the foreground simulation ladder"],
  [BROWSER, /open -g -n -a.*connectOverCDP/s,
    "browser guidance must include the background real-profile recipe"],
  [BROWSER, /dedicated managed\s+user-data directory.*profile singleton lock/s,
    "background Chromium must avoid active profile locks"],
  [BROWSER, /one-time startup check.*requires Tier C.*initialization script/s,
    "startup-only visibility checks must not rely on a late shim"],
  [BROWSER, /no wider than 800 CSS px.*`preset: "desktop"`/s,
    "pane captures must preserve their measured fidelity ceiling"],
  [BROWSER, /1000 CSS px.*`deviceScaleFactor: 2`.*2000 px-wide/s,
    "file captures must preserve their measured fidelity recipe"],
  [SKILL, /do not add confirmation gates.*without prompting/s,
    "routing must honor permissive user authorization preferences"],
];

for (const [file, pattern, message] of INVARIANTS) {
  check(message, () => {
    assert.match(readFileSync(join(root, file), "utf8"), pattern);
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
