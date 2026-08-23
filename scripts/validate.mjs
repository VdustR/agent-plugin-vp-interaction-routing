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

check("both manifests agree on name, version and description", () => {
  const a = read("plugin.json");
  const c = read(".claude-plugin/plugin.json");
  for (const key of ["name", "version", "description"]) {
    assert.equal(c[key], a[key], `${key} differs between manifests`);
  }
});

check("the two MCP configs differ only by the plugin-root variable", () => {
  const neutral = read("mcp.json").mcpServers;
  const claude = read(".mcp.json").mcpServers;
  assert.deepEqual(Object.keys(claude), Object.keys(neutral), "server names differ");
  for (const name of Object.keys(neutral)) {
    const normalize = (entry, variable) =>
      JSON.parse(JSON.stringify(entry).replaceAll(`\${${variable}}`, "${ROOT}"));
    assert.deepEqual(
      normalize(claude[name], "CLAUDE_PLUGIN_ROOT"),
      normalize(neutral[name], "PLUGIN_ROOT"),
      `server "${name}" differs beyond the root variable`,
    );
  }
});

check("each MCP config uses its own client's root variable", () => {
  assert.match(readFileSync(join(root, "mcp.json"), "utf8"), /\$\{PLUGIN_ROOT\}/);
  assert.doesNotMatch(readFileSync(join(root, "mcp.json"), "utf8"), /CLAUDE_PLUGIN_ROOT/);
  assert.match(readFileSync(join(root, ".mcp.json"), "utf8"), /\$\{CLAUDE_PLUGIN_ROOT\}/);
});

check("every referenced command path exists", () => {
  for (const file of ["mcp.json", ".mcp.json"]) {
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
