# agent-plugin-vp-interaction-routing

An agent plugin that helps an agent choose the lowest-cost reliable interface for
interacting with an application or service, and ships a bridge that exposes macOS
Codex Computer Use as MCP tools.

Plugin name: `vp-interaction-routing`.

## What is in it

| Component | Purpose |
|-----------|---------|
| `skills/vp-interaction-routing/` | Routing guidance: connectors and CLIs first, then browser surfaces, then native UI, then coordinates as a last resort |
| `skills/vp-interaction-routing/scripts/codex-cua-bridge.mjs` | An MCP stdio server exposing macOS Codex Computer Use, so a non-Codex harness can call it as ordinary tools |
| `tests/` | 39 checks; the ones needing macOS with Computer Use skip themselves elsewhere |
| `.claude-plugin/marketplace.json` | Makes the repository installable by `claude plugin install`; Claude Code requires a marketplace manifest, not just a plugin manifest |

The bridge needs macOS with the ChatGPT desktop app and its Computer Use
component. Those dependencies are why this lives in its own plugin rather than a
general-purpose skill collection.

## Why two manifests

The plugin targets two formats that do not read each other, and their file names
do not collide, so both ship from one tree:

| Client | Manifest | MCP config | Root variable |
|---|---|---|---|
| [Agent Plugins](https://agent-plugins.org/) | `plugin.json` | `mcp.json` | `${PLUGIN_ROOT}` |
| [Claude Code](https://code.claude.com/docs/en/plugins-reference) | `.claude-plugin/plugin.json` | `.mcp.json` | `${CLAUDE_PLUGIN_ROOT}` |
| Codex | `.codex-plugin/plugin.json` | none, by design | — |
| Antigravity | `plugin.json`, shared with Agent Plugins | `mcp_config.json` | `${PLUGIN_ROOT}` |

Every client reads `skills/<name>/SKILL.md`, so that directory is shared rather
than duplicated. Codex deliberately gets no MCP server: this skill's own rule is
that Codex reaches Computer Use through its bundled `node_repl` and `@oai/sky`
surface, so shipping the bridge there would contradict the guidance the plugin
carries.

Anthropic is not among the Agent Plugins maintainers and Claude Code keeps its
own format, so no single manifest reaches every client. `npm run validate`
asserts they stay consistent: the manifests agree on name, version and
description, and all three MCP configs describe the same server, differing only
by the root variable.

Skills use the [Agent Skills](https://agentskills.io/) format, which both
specifications share, so that directory is not duplicated.

## Install

### Claude Code

```bash
claude plugin marketplace add VdustR/agent-plugin-vp-interaction-routing
claude plugin install vp-interaction-routing@vp-agent-plugins -s user
```

The marketplace qualifier is required because the plugin is installed from the
marketplace this repository declares in `.claude-plugin/marketplace.json`.

Installing registers the `codex-cua` MCP server automatically. Its tools appear
as `plugin:vp-interaction-routing:codex-cua`, so no manual `claude mcp add` is
needed. If a manual `codex-cua` entry already exists from before, remove it to
avoid running two copies:

```bash
claude mcp remove -s user codex-cua
```

### Codex

```bash
codex plugin marketplace add VdustR/agent-plugin-vp-interaction-routing
codex plugin add vp-interaction-routing@vp-agent-plugins
```

This installs the skill only, for the reason above.

### Antigravity

```bash
agy plugin install vp-interaction-routing
```

Antigravity reads the same root `plugin.json` as the Agent Plugins standard and
takes its MCP servers from `mcp_config.json`. Confirm with
`agy plugin validate <path>`, which reports the components it found.

### An Agent Plugins client

Install from this repository with the client's own plugin command. The
`plugin.json` and `mcp.json` at the repository root are the vendor-neutral
manifests. No client implementing that specification was available to test
against, so this path is written to the specification rather than verified.

### Verify

Call the `health` tool, or run the bridge directly:

```bash
node skills/vp-interaction-routing/scripts/codex-cua-bridge.mjs --health
```

A healthy verdict begins with `healthy`. See
[the bridge reference](skills/vp-interaction-routing/references/codex-cua-bridge.md)
for the tool surface, usage rules, known upstream limits, and a comparison
against Peekaboo.

## Develop

```bash
npm run validate   # manifest consistency checks, then every test suite serially
```

Suites run serially on purpose: the live suite drives one shared macOS UI, and
parallel files saturate the machine enough to trip request timeouts. See
[tests/README.md](tests/README.md) for what each suite covers and the traps
found while writing them.

## License

[MIT](LICENSE)
