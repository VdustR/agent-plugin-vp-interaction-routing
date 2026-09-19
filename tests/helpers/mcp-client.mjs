import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const bridgePath = join(
  pluginRoot,
  "skills",
  "vp-interaction-routing",
  "scripts",
  "codex-cua-bridge.mjs",
);
export const fakeAppServerPath = join(pluginRoot, "tests", "helpers", "fake-app-server.mjs");

const CODEX_CANDIDATES = [
  "/Applications/ChatGPT.app/Contents/Resources/codex",
  join(process.env.HOME ?? "", "Applications/ChatGPT.app/Contents/Resources/codex"),
];

/**
 * Why the live suite is unavailable here from what the host looks like, or null
 * when nothing in the installation rules it out. Computer Use needs macOS and
 * the Codex binary inside ChatGPT.app, so CI on Linux skips rather than fails.
 *
 * This answers only "is it installed". `liveUnavailableReason` adds the
 * question that cannot be answered from the filesystem: whether the service
 * will actually serve.
 */
export function liveUnavailable() {
  if (process.platform !== "darwin") return `requires macOS, running on ${process.platform}`;
  const override = process.env.CODEX_CUA_BRIDGE_CODEX_BIN;
  if (override) {
    // A pointer to a missing binary must skip, not run and fail.
    return existsSync(override) ? null : `CODEX_CUA_BRIDGE_CODEX_BIN does not exist: ${override}`;
  }
  if (!CODEX_CANDIDATES.some((candidate) => existsSync(candidate))) {
    return "ChatGPT.app with the Computer Use component is not installed";
  }
  return null;
}

/**
 * Upstream refusals that mean the Computer Use service is serving nothing at
 * all, as opposed to answering this particular call wrongly or failing once.
 *
 * Entry bar: the message must have been observed refusing every call, not just
 * one. This one was, on a host whose installation was intact and whose bridge
 * handshake succeeded, across twenty freshly spawned app-server processes over
 * seven minutes; it cleared only when `SkyComputerUseService` was restarted.
 *
 * Deliberately absent: `Sky Computer Use native pipe startup failed` and
 * `Sky Computer Use native pipe closed before response`. Both were seen under
 * heavy concurrent load, and the second was seen recovering on the very next
 * call, so neither is established as a service-wide outage. A single failed
 * call must fail the suite, where it gets looked at, rather than skip it.
 *
 * Never add a wrong answer here. A bad tree, a bad coordinate result, or any
 * bridge defect must keep failing.
 */
const SERVICE_STATE_REFUSALS = [
  "This application session has been explicitly stopped by the user",
];

/**
 * The service-state refusal contained in this upstream text, or null. Exported
 * so the classification is testable without a live service, including on CI.
 */
export function serviceRefusal(text) {
  if (typeof text !== "string") return null;
  return SERVICE_STATE_REFUSALS.find((refusal) => text.includes(refusal)) ?? null;
}

/**
 * Why the live suite cannot run here, or null when it can. Adds a single live
 * read to `liveUnavailable()`, because an intact installation does not mean the
 * service will serve: `health` reports
 * "healthy: Computer Use is reachable through this bridge" from the app-server
 * handshake and the reflected sky surface alone, and was observed saying so
 * while every Computer Use call was refused.
 *
 * Only a refusal the service makes about its own state skips. Anything else,
 * including a read that answers with the wrong content, is left to fail in the
 * test that asserts it.
 */
export async function liveUnavailableReason(app = "Calculator") {
  const installed = liveUnavailable();
  if (installed) return installed;
  return probeServiceState({ app });
}

/**
 * One live read, reported as a skip reason when the service refuses it on its
 * own state, or null otherwise. Separate from the installation check so it can
 * be exercised against the fake upstream on any platform.
 *
 * It fails open by design: a timeout, an unparseable answer, a degraded bridge,
 * or a thrown error all return null and let the suite run. Skipping is the
 * destructive outcome, because it deletes coverage silently, so only a
 * recognized refusal reaches it.
 */
export async function probeServiceState({ app = "Calculator", env = {}, timeoutMs = 90000 } = {}) {
  const client = new BridgeClient({ env });
  try {
    await client.initialize();
    const response = await client.callTool("get_app_state", { app, full_tree: true }, timeoutMs);
    const refusal = serviceRefusal(toolText(response));
    return refusal ? `the Computer Use service is not serving: ${refusal}` : null;
  } catch (error) {
    // A probe that cannot run is not evidence the service is down, so let the
    // suite run and fail with its own message rather than skipping silently.
    // Say so on stderr: a guard that silently stopped working would otherwise
    // look exactly like a healthy host.
    process.stderr.write(`live guard: the service probe could not run: ${error?.message}\n`);
    return null;
  } finally {
    await client.close();
  }
}

/** Minimal newline-delimited JSON-RPC client for driving the bridge over stdio. */
export class BridgeClient {
  constructor({ env = {} } = {}) {
    this.child = spawn(process.execPath, [bridgePath], {
      stdio: ["pipe", "pipe", "ignore"],
      env: { ...process.env, ...env },
    });
    this.nextId = 1;
    // One ordered queue of unclaimed messages. A waiter for a specific id takes
    // priority over a positional read, so a response is never handed to the
    // wrong caller, but positional reads still see id-bearing messages nobody
    // is waiting on by id.
    this.queue = [];
    this.waiters = [];
    this.idWaiters = new Map();
    this.buffer = "";
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      let index;
      while ((index = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (!line) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        this.#deliver(message);
      }
    });
  }

  #deliver(message) {
    if (message.id !== undefined) {
      const idWaiter = this.idWaiters.get(message.id);
      if (idWaiter) {
        this.idWaiters.delete(message.id);
        idWaiter(message);
        return;
      }
    }
    const waiter = this.waiters.shift();
    if (waiter) waiter(message);
    else this.queue.push(message);
  }

  write(object) {
    this.child.stdin.write(`${JSON.stringify(object)}\n`);
  }

  /** Write a raw line, for malformed-input cases a JSON object cannot express. */
  writeRaw(line) {
    this.child.stdin.write(`${line}\n`);
  }

  /** Next message, or null once timeoutMs elapses with nothing received. */
  next(timeoutMs = 30000) {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolvePromise) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((entry) => entry !== waiter);
        resolvePromise(null);
      }, timeoutMs);
      const waiter = (message) => {
        clearTimeout(timer);
        resolvePromise(message);
      };
      this.waiters.push(waiter);
    });
  }

  /** Await the response carrying this exact id, never another request's. */
  awaitId(id, timeoutMs = 30000) {
    const queuedAt = this.queue.findIndex((message) => message.id === id);
    if (queuedAt !== -1) return Promise.resolve(this.queue.splice(queuedAt, 1)[0]);
    return new Promise((resolvePromise) => {
      const timer = setTimeout(() => {
        this.idWaiters.delete(id);
        resolvePromise(null);
      }, timeoutMs);
      this.idWaiters.set(id, (message) => {
        clearTimeout(timer);
        resolvePromise(message);
      });
    });
  }

  request(method, params, timeoutMs) {
    const id = this.nextId++;
    this.write({ jsonrpc: "2.0", id, method, params });
    return this.awaitId(id, timeoutMs);
  }

  notify(method, params) {
    this.write({ jsonrpc: "2.0", method, params });
  }

  async initialize(clientName = "test-client") {
    const result = await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: clientName, version: "1" },
    });
    this.notify("notifications/initialized");
    return result;
  }

  callTool(name, args, timeoutMs) {
    return this.request("tools/call", { name, arguments: args }, timeoutMs);
  }

  /**
   * Stop the bridge and wait for it to go, escalating if it lingers. Live tests
   * share one Calculator, so a surviving bridge could still act during the next
   * test.
   */
  async close() {
    // Release anyone still waiting, so a pending read does not sit out its full
    // timeout after the bridge is gone.
    for (const waiter of this.waiters.splice(0)) waiter(null);
    for (const [, waiter] of this.idWaiters) waiter(null);
    this.idWaiters.clear();
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    this.child.stdin.end();
    this.child.kill();
    await new Promise((resolvePromise) => {
      const escalate = setTimeout(() => this.child.kill("SIGKILL"), 1000);
      const giveUp = setTimeout(resolvePromise, 4000);
      this.child.once("exit", () => {
        clearTimeout(escalate);
        clearTimeout(giveUp);
        resolvePromise();
      });
    });
  }
}

/** Concatenated text content of a tools/call result. */
export function toolText(message) {
  return (message?.result?.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
