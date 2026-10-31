import assert from "node:assert/strict";
import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const list = (relative) => readdirSync(join(root, relative), { withFileTypes: true });

test("plugin discovery contains consumer skills, not repository maintenance skills", () => {
  const entries = list("skills");
  assert.ok(entries.length);
  for (const entry of entries) {
    assert.ok(entry.isDirectory(), "ship real skill folders, not maintenance aliases");
    assert.match(entry.name, /^vp-(?!tool-comparison$)/);
  }
  assert.equal(JSON.parse(readFileSync(join(root, ".codex-plugin/plugin.json"))).skills, "./skills/");
});

test("maintainer skills have one canonical source and resolving Claude aliases", () => {
  const entries = list(".agents/skills");
  assert.ok(entries.some((entry) => entry.name === "vpir-tool-comparison"));
  assert.deepEqual(list(".claude/skills").map((entry) => entry.name).sort(),
    entries.map((entry) => entry.name).sort());
  for (const entry of entries) {
    assert.ok(entry.isDirectory());
    assert.match(entry.name, /^vpir-/);
    const canonical = join(root, ".agents/skills", entry.name);
    const alias = join(root, ".claude/skills", entry.name);
    assert.ok(lstatSync(alias).isSymbolicLink());
    assert.equal(readlinkSync(alias), `../../.agents/skills/${entry.name}`);
    assert.equal(realpathSync(alias), realpathSync(canonical));
    const source = readFileSync(join(canonical, "SKILL.md"), "utf8");
    const linked = readFileSync(join(alias, "SKILL.md"), "utf8");
    assert.equal(linked, source);
    assert.ok(source.includes(`name: ${entry.name}\n`));
    const metadata = readFileSync(join(canonical, "agents/openai.yaml"), "utf8");
    assert.ok(metadata.includes(`$${entry.name}`));
  }
});

test("Claude project instructions share the canonical repository guidance", () => {
  assert.ok(lstatSync(join(root, "CLAUDE.md")).isSymbolicLink());
  assert.equal(readlinkSync(join(root, "CLAUDE.md")), "AGENTS.md");
  assert.equal(realpathSync(join(root, "CLAUDE.md")), realpathSync(join(root, "AGENTS.md")));
});
