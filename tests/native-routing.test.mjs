import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRoutingCase, evaluateRoutingFallback } from "../scripts/routing-policy.mjs";

const candidate = (route, capabilities, overrides = {}) => ({
  route, capabilities, platforms: ["macos"], available: true, eligible: true,
  ...overrides,
});
const scenario = (requirements, nativeCandidates, overrides = {}) => ({
  surface: "native-ui", host: "codex", platform: "macos", requirements,
  nativeCandidates, ...overrides,
});

test("a CLI-only requirement selects the capable driver when first-party cannot satisfy it", () => {
  const input = scenario(["cli-workflow", "accessibility"], [
    candidate("agent-desktop", ["cli-workflow", "accessibility"]),
    candidate("host-first-party-computer-use", ["accessibility"]),
  ]);
  assert.equal(evaluateRoutingCase(input), "agent-desktop");
  assert.equal(evaluateRoutingFallback(input), "none");
});

test("absent agent-desktop does not trigger installation or displace an eligible tool", () => {
  const input = scenario(["accessibility"], [
    candidate("agent-desktop", ["accessibility"], { available: false }),
    candidate("host-first-party-computer-use", ["accessibility"]),
  ]);
  assert.equal(evaluateRoutingCase(input), "host-first-party-computer-use");
  assert.equal(evaluateRoutingFallback(input), "none");
});

test("fallbacks retain no-synthetic-input and explicit interface constraints", () => {
  const input = scenario(["no-synthetic-input"], [
    candidate("agent-desktop", ["no-synthetic-input"]),
    candidate("peekaboo", ["accessibility"]),
  ]);
  assert.equal(evaluateRoutingCase(input), "agent-desktop");
  assert.equal(evaluateRoutingFallback(input), "none");
  assert.equal(evaluateRoutingCase({ ...input, interfaceConstraint: "peekaboo" }),
    "report-constraint-conflict");
});

test("a missing first-party system capability retains capable Peekaboo", () => {
  const input = scenario(["macos-system"], [
    candidate("peekaboo", ["macos-system"]),
    candidate("host-first-party-computer-use", ["accessibility"]),
  ]);
  assert.equal(evaluateRoutingCase(input), "peekaboo");
});

test("platform and Codex bridge exclusions apply before ranking", () => {
  const input = scenario(["accessibility"], [
    candidate("peekaboo", ["accessibility"]),
    candidate("healthy-codex-cua-bridge", ["accessibility"], { platforms: ["linux"] }),
    candidate("agent-desktop", ["accessibility"], { platforms: ["linux"] }),
  ], { platform: "linux" });
  assert.equal(evaluateRoutingCase(input), "agent-desktop");
  assert.equal(evaluateRoutingFallback(input), "none");
});

test("integrated default wins a capability tie and unproven requirements fail closed", () => {
  const candidates = [
    candidate("agent-desktop", ["accessibility"]),
    candidate("host-first-party-computer-use", ["accessibility"]),
  ];
  assert.equal(evaluateRoutingCase(scenario(["accessibility"], candidates)),
    "host-first-party-computer-use");
  assert.equal(evaluateRoutingCase(scenario(["locked-use"], candidates)),
    "report-capability-unavailable");
});

test("inventory cannot manufacture non-macOS Peekaboo or bridge support", () => {
  const input = scenario(["accessibility"], [
    candidate("peekaboo", ["accessibility"], { platforms: ["windows"] }),
    candidate("healthy-codex-cua-bridge", ["accessibility"], { platforms: ["windows"] }),
  ], { host: "non-codex", platform: "windows" });
  assert.equal(evaluateRoutingCase(input), "report-capability-unavailable");
});

test("an unavailable constrained tool is not an interface conflict without an alternative", () => {
  const input = scenario(["locked-use"], [], { interfaceConstraint: "agent-desktop" });
  assert.equal(evaluateRoutingCase(input), "report-capability-unavailable");
});

test("Codex first-party preference survives CLI and system capability ties", () => {
  for (const requirement of ["cli-workflow", "macos-system"]) {
    const input = scenario([requirement], [
      candidate("agent-desktop", [requirement]),
      candidate("peekaboo", [requirement]),
      candidate("host-first-party-computer-use", [requirement]),
    ]);
    assert.equal(evaluateRoutingCase(input), "host-first-party-computer-use");
    assert.equal(evaluateRoutingFallback(input), "agent-desktop");
  }
});

test("capable agent-desktop precedes Peekaboo, while a missing capability retains Peekaboo", () => {
  const input = scenario(["macos-system"], [
    candidate("agent-desktop", ["macos-system"]),
    candidate("peekaboo", ["macos-system"]),
  ]);
  assert.equal(evaluateRoutingCase(input), "agent-desktop");
  assert.equal(evaluateRoutingFallback(input), "peekaboo");
  input.nativeCandidates[0].capabilities = ["accessibility"];
  assert.equal(evaluateRoutingCase(input), "peekaboo");
});

test("the same eligible inventory keeps first-party first in every harness", () => {
  const input = scenario(["accessibility"], [
    candidate("host-first-party-computer-use", ["accessibility"]),
    candidate("agent-desktop", ["accessibility"]),
    candidate("peekaboo", ["accessibility"]),
  ]);
  assert.equal(evaluateRoutingCase(input), "host-first-party-computer-use");
  assert.equal(evaluateRoutingCase({ ...input, host: "non-codex" }), "host-first-party-computer-use");
  assert.equal(evaluateRoutingFallback({ ...input, host: "non-codex" }),
    "agent-desktop");
});

test("other harnesses retain their first-party tool when agent-desktop is unavailable", () => {
  const input = scenario(["accessibility"], [
    candidate("agent-desktop", ["accessibility"], { available: false }),
    candidate("host-first-party-computer-use", ["accessibility"]),
    candidate("healthy-codex-cua-bridge", ["accessibility"]),
    candidate("peekaboo", ["accessibility"]),
  ], { host: "non-codex" });
  assert.equal(evaluateRoutingCase(input), "host-first-party-computer-use");
  assert.equal(evaluateRoutingFallback(input), "healthy-codex-cua-bridge");
});

test("an unidentified harness cannot select the non-Codex bridge", () => {
  const input = scenario(["accessibility"], [
    candidate("healthy-codex-cua-bridge", ["accessibility"]),
  ], { host: undefined });
  assert.equal(evaluateRoutingCase(input), "report-capability-unavailable");
});
