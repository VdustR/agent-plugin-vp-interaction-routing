import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Both layouts ship the signed executable inside the desktop app bundle.
const BINARY_LAYOUTS = [
  "Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
  "Contents/Resources/codex",
];

export function codexBinaryCandidates({ applicationsDirectory = "/Applications",
  homeDirectory = homedir() } = {}) {
  const bundles = [
    join(applicationsDirectory, "ChatGPT.app"),
    join(homeDirectory, "Applications", "ChatGPT.app"),
  ];
  return bundles.flatMap((bundle) => BINARY_LAYOUTS.map((layout) => join(bundle, layout)));
}

export function resolveCodexBinary({ override = process.env.CODEX_CUA_BRIDGE_CODEX_BIN,
  candidates = codexBinaryCandidates() } = {}) {
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`CODEX_CUA_BRIDGE_CODEX_BIN does not exist: ${override}`);
    }
    return override;
  }
  const binary = candidates.find((candidate) => existsSync(candidate));
  if (binary) return binary;
  throw new Error(
    "Could not find the Codex binary inside ChatGPT.app. Install the ChatGPT " +
    "desktop app with the Computer Use component, or set " +
    "CODEX_CUA_BRIDGE_CODEX_BIN to its bundled Codex executable.",
  );
}

export function readAppVersion(codexBin) {
  if (!codexBin) return null;
  const suffix = BINARY_LAYOUTS.map((layout) => `/${layout}`)
    .find((layout) => codexBin.endsWith(layout));
  if (!suffix) return null;
  const plist = join(codexBin.slice(0, -suffix.length), "Contents", "Info.plist");
  if (!existsSync(plist)) return null;
  const match = readFileSync(plist, "utf8").match(
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]*)<\/string>/,
  );
  return match ? match[1] : null;
}
