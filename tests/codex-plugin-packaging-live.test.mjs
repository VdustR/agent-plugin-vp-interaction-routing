// Live coverage for how Codex packages this plugin. It installs a copy of the
// plugin into a throwaway CODEX_HOME with the real Codex CLI and asks the
// app-server which MCP servers the install registers. It needs the Codex
// binary from ChatGPT.app but not the Computer Use service, and skips without
// the binary.
//
// Codex falls back to `.mcp.json` when `.codex-plugin/plugin.json` leaves
// `mcpServers` unset, which used to start an idle bridge for every Codex
// thread. The control case removes the declaration, so the suite cannot pass
// by being unable to see any server.

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { resolveCodexBinary } from "../skills/vp-interaction-routing/scripts/codex-installation.mjs";
import { liveUnavailable, pluginRoot } from "./helpers/mcp-client.mjs";

// Node treats any non-undefined `skip` value as a skip directive, so an absent
// reason must be `false` rather than null or the whole suite silently skips.
const skip = liveUnavailable() ?? false;
const PLUGIN = "vp-interaction-routing";
const MARKETPLACE = "vp-agent-plugins";
// Only what a Codex install reads: its marketplace, its manifest, the fallback
// MCP config, and the skills.
const PACKAGED = [".agents", ".codex-plugin", ".mcp.json", "skills"];

function stagePlugin(t, editManifest = (manifest) => manifest) {
  const root = mkdtempSync(join(tmpdir(), "codex-packaging-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const copy = join(root, "plugin");
  for (const entry of PACKAGED) {
    cpSync(join(pluginRoot, entry), join(copy, entry), { recursive: true });
  }
  const manifestPath = join(copy, ".codex-plugin", "plugin.json");
  const manifest = editManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const codexHome = join(root, "codex-home");
  mkdirSync(codexHome);
  return { copy, codexHome };
}

// Installs the staged copy and returns the MCP server names `plugin/read`
// reports for it. `mcpServerStatus/list` is not used because it does not answer
// without a signed-in CODEX_HOME.
async function registeredServers({ copy, codexHome }) {
  const bin = resolveCodexBinary({});
  const env = { ...process.env, CODEX_HOME: codexHome };
  execFileSync(bin, ["plugin", "marketplace", "add", copy], { env, stdio: "pipe" });
  execFileSync(bin, ["plugin", "add", `${PLUGIN}@${MARKETPLACE}`], { env, stdio: "pipe" });

  const child = spawn(bin, ["app-server", "--stdio"], { env, stdio: ["pipe", "pipe", "ignore"] });
  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  try {
    const reply = new Promise((resolve, reject) => {
      let buffer = "";
      child.stdout.on("data", (chunk) => {
        buffer += chunk;
        for (let end; (end = buffer.indexOf("\n")) >= 0;) {
          const message = JSON.parse(buffer.slice(0, end));
          buffer = buffer.slice(end + 1);
          if (message.id === 0) {
            send({ method: "initialized", params: {} });
            send({
              id: 1,
              method: "plugin/read",
              params: {
                marketplacePath: join(copy, ".agents", "plugins", "marketplace.json"),
                pluginName: PLUGIN,
              },
            });
          } else if (message.id === 1) {
            if (message.error) reject(new Error(`plugin/read failed: ${message.error.message}`));
            else resolve(message.result.plugin.mcpServers);
          }
        }
      });
      child.once("exit", (code) => reject(new Error(`app-server exited early with ${code}`)));
    });
    send({ id: 0, method: "initialize", params: { clientInfo: { name: "packaging-test", version: "0" } } });
    return await reply;
  } finally {
    child.kill();
    if (child.exitCode === null && child.signalCode === null) await once(child, "exit");
  }
}

test("a Codex install of the plugin registers no MCP server", { skip, timeout: 60000 }, async (t) => {
  assert.deepEqual(await registeredServers(stagePlugin(t)), []);
});

test("without the declaration, Codex falls back to .mcp.json", { skip, timeout: 60000 }, async (t) => {
  // The control: proves the probe sees a server when one is registered, and
  // documents why the manifest must keep its empty `mcpServers`.
  const staged = stagePlugin(t, ({ mcpServers, ...rest }) => rest);
  assert.deepEqual(await registeredServers(staged), ["codex-cua"]);
});
