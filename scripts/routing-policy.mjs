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

  if (routeCase.interfaceConstraint === "in-app-browser" && needsTierC) {
    return "report-constraint-conflict";
  }
  if (routeCase.interfaceConstraint === "in-app-browser" && needsDedicatedRoute) {
    return "report-constraint-conflict";
  }

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
  if (requirements.has("in-app-unavailable")) return "managed-agent-browser";
  return "in-app-dom-browser";
}

export function evaluateRoutingFallback(routeCase) {
  const requirements = new Set(routeCase.requirements);
  const primary = evaluateRoutingCase(routeCase);

  if (primary.startsWith("report-")) return "none";
  if (primary === "connector-api-cli") return "verified-shared-state-dom";
  if (primary === "verified-shared-state-dom") return "user-authentication-handoff";
  if (primary === "screenshot-coordinates") return "none";
  if (primary === "host-first-party-computer-use") return "peekaboo";
  if (primary === "healthy-codex-cua-bridge") return "peekaboo";
  if (primary === "peekaboo") return "screenshot-coordinates";
  if (primary === "in-app-dom-browser") {
    return routeCase.interfaceConstraint === "in-app-browser"
      ? "report-constraint-conflict"
      : "managed-agent-browser";
  }
  if (primary === "managed-agent-browser") {
    return requirements.has("required-session-absent")
      ? "user-authentication-handoff-or-report-capability-unavailable"
      : requirements.has("in-app-unavailable")
        ? "playwright-or-background-chromium"
        : "dedicated-playwright-profile";
  }
  if (primary === "in-app-pre-navigation-shim" ||
      primary === "in-app-tier-a-render-pump" ||
      primary === "in-app-tier-b-shim") {
    return "playwright-or-background-chromium";
  }
  if (primary === "playwright-or-background-chromium") {
    return requirements.has("in-app-unavailable") || requirements.has("startup-only-focus-check")
      ? "managed-agent-browser"
      : "managed-headed-chromium";
  }
  return "none";
}

export function evaluateRoutingVerification(routeCase) {
  const requirements = new Set(routeCase.requirements);
  const primary = evaluateRoutingCase(routeCase);

  if (primary === "connector-api-cli") return "semantic-readback";
  if (primary === "verified-shared-state-dom" || primary === "in-app-dom-browser") {
    return "dom-predicate";
  }
  if (primary === "managed-agent-browser") {
    return requirements.has("required-session-absent")
      ? "managed-profile-session-predicate-before-action"
      : "dom-predicate";
  }
  if (primary === "in-app-pre-navigation-shim") {
    return "page-readiness-predicate-after-navigation";
  }
  if (primary === "in-app-tier-a-render-pump" ||
      primary === "in-app-tier-b-shim" ||
      primary === "playwright-or-background-chromium") {
    return "page-readiness-predicate";
  }
  if (primary === "host-first-party-computer-use" ||
      primary === "healthy-codex-cua-bridge") {
    return "accessibility-predicate";
  }
  if (primary === "peekaboo") return "accessibility-or-window-predicate";
  if (primary === "screenshot-coordinates") return "visible-predicate-after-every-action";
  if (primary === "report-requirement-conflict") return "requirements-conflict-readback";
  if (primary === "report-constraint-conflict") return "capability-conflict-readback";
  return "capability-inventory-readback";
}
