// Executable policy for the representative routing fixtures. Runtime inventory
// checks still happen at the decision-tree gates; fixtures assume named routes
// are available unless a requirement explicitly says otherwise.

const hasAny = (requirements, names) => names.some((name) => requirements.has(name));

export function evaluateRoutingCase(routeCase) {
  const requirements = new Set(routeCase.requirements);

  if (routeCase.surface === "service") return "connector-api-cli";

  if (routeCase.surface === "unknown-ui") {
    return requirements.has("no-coordinate-capable-interface")
      ? "report-capability-unavailable"
      : "screenshot-coordinates";
  }

  if (routeCase.surface === "native-ui") {
    if (requirements.has("window-menu-space-or-dialog")) return "peekaboo";
    if (routeCase.host === "codex" && requirements.has("ordinary-accessibility")) {
      return "host-first-party-computer-use";
    }
    if (routeCase.host === "non-codex" &&
        requirements.has("no-first-party-computer-use")) {
      return "healthy-codex-cua-bridge";
    }
    return "report-capability-unavailable";
  }

  if (routeCase.surface !== "web-dom") return "report-capability-unavailable";

  const needsSharedState = routeCase.interfaceConstraint === "shared-state-dom" ||
    hasAny(requirements, ["current-browser-state", "current-login"]);
  const needsDedicatedRoute = hasAny(requirements, [
    "isolation", "concurrency", "repeatability", "headless", "managed-identity",
  ]);
  if (needsSharedState && needsDedicatedRoute) return "report-requirement-conflict";
  if (needsSharedState) return "verified-shared-state-dom";

  const needsTierC = hasAny(requirements, ["animation", "video", "canvas", "real-lifecycle"]);
  const startupOnly = requirements.has("startup-only-focus-check");
  const canInjectBeforeNavigation = requirements.has("pre-navigation-injection") &&
    requirements.has("safe-navigation-restart");

  if (needsDedicatedRoute) {
    return needsTierC ? "playwright-or-background-chromium" : "managed-agent-browser";
  }
  if (startupOnly && !canInjectBeforeNavigation) {
    return routeCase.interfaceConstraint === "in-app-browser"
      ? "report-constraint-conflict"
      : "playwright-or-background-chromium";
  }
  if (needsTierC) return "playwright-or-background-chromium";
  if (startupOnly) return "in-app-pre-navigation-shim";
  if (requirements.has("focus-event-handler")) return "in-app-tier-b-shim";
  if (requirements.has("frame-driven-predicate") && requirements.has("stalled-raf")) {
    return "in-app-tier-a-render-pump";
  }
  return "in-app-dom-browser";
}
