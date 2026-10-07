import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { codexBinaryCandidates, readAppVersion, resolveCodexBinary }
  from "../skills/vp-interaction-routing/scripts/codex-installation.mjs";

function installation(t) {
  const root = mkdtempSync(join(tmpdir(), "codex-installation-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const candidates = codexBinaryCandidates({
    applicationsDirectory: join(root, "Applications"), homeDirectory: join(root, "home"),
  });
  const write = (path, content = "") => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return path;
  };
  return { root, candidates, write };
}

test("discovers the nested signed binary and reads the outer app's version", (t) => {
  const { candidates, write } = installation(t);
  const binary = write(candidates[0]);
  const bundle = binary.split("/Contents/Resources/")[0];
  write(join(bundle, "Contents/Info.plist"),
    "<key>CFBundleShortVersionString</key><string>1.2.3</string>");
  write(join(dirname(dirname(binary)), "Info.plist"),
    "<key>CFBundleShortVersionString</key><string>9.9.9</string>");
  assert.equal(resolveCodexBinary({ candidates, override: "" }), binary);
  assert.equal(readAppVersion(binary), "1.2.3");
});

test("retains legacy and per-user app layouts", (t) => {
  const { candidates, write } = installation(t);
  const userBinary = write(candidates[2]);
  assert.equal(resolveCodexBinary({ candidates, override: "" }), userBinary);
  const legacyBinary = write(candidates[1]);
  assert.equal(resolveCodexBinary({ candidates, override: "" }), legacyBinary);
  write(join(dirname(dirname(legacyBinary)), "Info.plist"),
    "<key>CFBundleShortVersionString</key><string>0.9.0</string>");
  assert.equal(readAppVersion(legacyBinary), "0.9.0");
});

test("uses an explicit binary override and rejects a missing override", (t) => {
  const { root, candidates, write } = installation(t);
  const override = write(join(root, "custom-codex"));
  write(candidates[0]);
  assert.equal(resolveCodexBinary({ candidates, override }), override);
  assert.throws(() => resolveCodexBinary({ candidates, override: `${override}-missing` }),
    /CODEX_CUA_BRIDGE_CODEX_BIN does not exist/);
});

test("reports missing installations instead of selecting an arbitrary CLI", (t) => {
  const { candidates } = installation(t);
  assert.throws(() => resolveCodexBinary({ candidates, override: "" }),
    /Could not find the Codex binary inside ChatGPT.app/);
});

test("unknown executables and missing version metadata remain unverified", (t) => {
  const { root, candidates, write } = installation(t);
  const unrelated = write(join(root, "custom-codex"),
    "<key>CFBundleShortVersionString</key><string>9.9.9</string>");
  assert.equal(readAppVersion(unrelated), null);
  assert.equal(readAppVersion(write(candidates[0])), null);
  assert.equal(readAppVersion(null), null);
});
