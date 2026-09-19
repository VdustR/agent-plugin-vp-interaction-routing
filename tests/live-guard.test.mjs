// Coverage for the live suite's own skip guard. The guard decides whether the
// macOS suite runs, so a mistake in it either hides real breakage or fails a
// developer's machine for no reason. The classification is pure, so it runs
// anywhere Node runs, including CI on Linux.

import assert from "node:assert/strict";
import test from "node:test";

import {
  fakeAppServerPath,
  liveUnavailable,
  probeServiceState,
  serviceRefusal,
} from "./helpers/mcp-client.mjs";

// Verbatim upstream text, so a reworded service message is noticed here rather
// than silently ceasing to match.
const PIPE_STARTUP = "error: Sky Computer Use native pipe startup failed";
const PIPE_CLOSED = "error: Sky Computer Use native pipe closed before response";
const STOPPED_SESSION =
  "error: This application session has been explicitly stopped by the user for this turn. " +
  "Stop your work and send a final message noting they stopped the session and you're ready " +
  "to continue if they want you to. Computer Use can be used again in the next assistant turn.";

test("a service-state refusal is recognized, and carries how to recover", () => {
  const refusal = serviceRefusal(STOPPED_SESSION);
  assert.equal(refusal.text, "This application session has been explicitly stopped by the user");
  // The state does not time out and survives a fresh bridge, so a skip without
  // the recovery step leaves the reader stuck.
  assert.match(refusal.recovery, /SkyComputerUseService/);
});

test("a single failed call is not a service outage", () => {
  // Both were seen under heavy concurrent load, and PIPE_CLOSED was seen
  // recovering on the very next call. Neither is established as serving
  // nothing, so neither may skip the suite.
  assert.equal(serviceRefusal(PIPE_STARTUP), null);
  assert.equal(serviceRefusal(PIPE_CLOSED), null);
});

test("everything else is left to fail the suite", () => {
  // The refusals the live tests assert on. Skipping for any of these would
  // discard the coverage they exist to provide.
  for (const text of [
    'app: /System/Applications/Calculator.app\nWindow: "Calculator", App: Calculator.',
    "error: Computer Use server error -10005: windowNotFoundAtPosition((9147.0, 9529.0))",
    "error: Computer Use is not active for '/System/Applications/Calculator.app'.",
    "error: not allowed to use the app 'com.openai.codex' for safety reasons",
    "ok",
    "",
  ]) {
    assert.equal(serviceRefusal(text), null, `must not skip on: ${text.slice(0, 60)}`);
  }
});

test("a non-string response is not mistaken for a refusal", () => {
  for (const value of [undefined, null, 0, {}, []]) {
    assert.equal(serviceRefusal(value), null);
  }
});

test("the installation check still answers without touching the service", () => {
  const reason = liveUnavailable();
  if (process.platform === "darwin") {
    // Either it is installed (null) or the reason names what is missing. The
    // point is that it answered without a live call.
    assert.ok(reason === null || typeof reason === "string");
  } else {
    assert.equal(reason, `requires macOS, running on ${process.platform}`);
  }
});

// End to end through a real bridge process, against the fake upstream, so the
// wiring is covered and not just the classification. Uses the fake binary
// directly rather than the installation check, so it runs on CI too.
const probeAgainst = (text) =>
  probeServiceState({ env: { CODEX_CUA_BRIDGE_CODEX_BIN: fakeAppServerPath, FAKE_TEXT: text } });

test("the probe reports a refusing service as a skip reason", async () => {
  const reason = await probeAgainst(STOPPED_SESSION);
  assert.match(reason, /not serving: This application session/);
  assert.match(reason, /To recover, run `pkill -f SkyComputerUseService`/);
});

test("the probe lets a serving upstream run the suite", async () => {
  assert.equal(await probeAgainst('Window: "Calculator", App: Calculator.'), null);
  // A wrong answer is still a run, not a skip: it is the tests' job to fail on
  // it. Skipping here would delete the coverage rather than report it.
  assert.equal(await probeAgainst("error: Computer Use server error -10005"), null);
  assert.equal(await probeAgainst(PIPE_STARTUP), null, "one failed call is not an outage");
});

test("the guard fails open when it cannot get an answer", async () => {
  // An upstream that never answers must run the suite, not skip it: skipping
  // deletes coverage silently, while running reports the real problem.
  const hung = await probeServiceState({
    env: { CODEX_CUA_BRIDGE_CODEX_BIN: fakeAppServerPath, FAKE_HANG: "1" },
    timeoutMs: 1500,
  });
  assert.equal(hung, null);

  // Same for an upstream that cannot start at all. The bridge degrades rather
  // than dying, and a degraded answer is not a service outage.
  const missing = await probeServiceState({
    env: { CODEX_CUA_BRIDGE_CODEX_BIN: "/nonexistent/codex" },
    timeoutMs: 5000,
  });
  assert.equal(missing, null);
});

test("a missing binary override skips rather than running and failing", () => {
  const previous = process.env.CODEX_CUA_BRIDGE_CODEX_BIN;
  process.env.CODEX_CUA_BRIDGE_CODEX_BIN = "/nonexistent/codex";
  try {
    const reason = liveUnavailable();
    // On a non-macOS host the platform check answers first, which is correct:
    // the suite skips either way, and the reason names the real blocker.
    assert.match(
      reason,
      process.platform === "darwin"
        ? /CODEX_CUA_BRIDGE_CODEX_BIN does not exist/
        : /requires macOS/,
    );
  } finally {
    if (previous === undefined) delete process.env.CODEX_CUA_BRIDGE_CODEX_BIN;
    else process.env.CODEX_CUA_BRIDGE_CODEX_BIN = previous;
  }
});
