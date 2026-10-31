import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("a priority change makes diagrams stale until regenerated", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const fixture = mkdtempSync(join(tmpdir(), "routing-diagram-"));
  try {
    for (const file of [
      "scripts/generate-routing-diagrams.mjs",
      "skills/vp-interaction-routing/references/native-route-order.json",
    ]) {
      mkdirSync(dirname(join(fixture, file)), { recursive: true });
      copyFileSync(join(root, file), join(fixture, file));
    }
    const references = join(fixture, "skills/vp-interaction-routing/references");
    writeFileSync(join(references, "decision-tree.md"),
      "```mermaid\nflowchart TD\n  %% BEGIN GENERATED NATIVE ROUTING\n  %% END GENERATED NATIVE ROUTING\n```\n");
    const run = (...args) => spawnSync(process.execPath,
      ["scripts/generate-routing-diagrams.mjs", ...args], { cwd: fixture, encoding: "utf8" });
    const generated = run();
    assert.equal(generated.status, 0, generated.stderr);
    assert.equal(run("--check").status, 0);
    const diagram = readFileSync(join(references, "native-decision-tree.md"), "utf8");
    assert.equal((diagram.match(/```mermaid/g) ?? []).length, 1);
    assert.match(diagram, /Identified non-Codex harness/);
    assert.doesNotMatch(diagram, /## Codex|## Other harnesses/);

    const policyFile = join(references, "native-route-order.json");
    const policy = JSON.parse(readFileSync(policyFile, "utf8"));
    [policy[0], policy[1]] = [policy[1], policy[0]];
    writeFileSync(policyFile, JSON.stringify(policy));
    const stale = run("--check");
    assert.notEqual(stale.status, 0, "a changed priority must invalidate the existing diagrams");
    assert.match(stale.stderr, /stale/);
    assert.equal(run().status, 0);
    assert.equal(run("--check").status, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
