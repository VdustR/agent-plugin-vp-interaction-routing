# Repository Maintenance

This repository ships the `vp-interaction-routing` plugin. Separate instructions
for maintaining the repository from skills delivered to plugin users.

## Skill scope and naming

| Audience | Canonical location | Required prefix | Current example |
| --- | --- | --- | --- |
| Repository maintainers | `.agents/skills/<name>/` | `vpir-` | `vpir-tool-comparison` |
| Plugin users | `skills/<name>/` | `vp-` | `vp-interaction-routing` |

`vpir` abbreviates VP Interaction Routing; `agent-plugin-` describes packaging
and is omitted. These prefixes are repository conventions, not harness syntax.
Do not rename consumer skills to `vpir-` or expose maintainer skills from the
plugin's `skills/` directory or manifest skill paths.

Use 1–64 ASCII lowercase letters, digits, and single separating hyphens; no
leading, trailing, or consecutive hyphens. Keep the directory basename and
frontmatter `name` identical. Provide a nonempty, scoped `description`. Update
invocation examples, links, and `agents/openai.yaml` prompts when renaming.
A harness-added namespace, such as Claude Code's `/plugin-name:skill-name`,
belongs to invocation syntax and must not be written into frontmatter `name`.

## Harness discovery and shared sources

Codex and current Antigravity discover repo skills in `.agents/skills/` directly.
For Claude Code, maintain one relative directory symlink per maintainer skill:

```text
.claude/skills/vpir-tool-comparison -> ../../.agents/skills/vpir-tool-comparison
CLAUDE.md -> AGENTS.md
```

Edit canonical targets, not aliases. Keep `.claude/skills/` as a real directory;
add a matching relative link when adding a maintainer skill. Do not copy skill
bodies or link maintainer skills into the plugin's `skills/` tree. Keep consumer
skills as real directories inside the plugin so distribution is self-contained.
Add aliases for another harness only after verifying its documented discovery
path and symlink behavior. Do not assume all harnesses use `.claude/skills/`.

A Windows checkout needs real symlink support (Developer Mode or suitable
privileges and Git `core.symlinks`). A link checked out as text is not a loaded
skill. Report unavailable discovery; do not silently copy or install globally.
Managed policies may restrict project discovery even with valid links.

## Maintenance workflow

Use `.agents/skills/vpir-tool-comparison/SKILL.md` when comparing interaction
tools or refreshing routing evidence. Keep PK reports, source findings and raw
sanitized observations under `docs/research/desktop-automation/`; keep repeatable
owned fixtures under `fixtures/desktop-pk/`. Consumer execution guidance belongs
in `skills/vp-interaction-routing/`, not in dated research reports.

Native priority data lives in
`skills/vp-interaction-routing/references/native-route-order.json`. After changing
it, run `npm run routing:generate`; never hand-edit the generated native graphs.
Run `npm run validate` before delivery. It checks both canonical skill roots,
consumer/maintainer separation, relative links and generated-diagram freshness.
Distinguish filesystem checks, actual harness discovery and agent behavior.
For routing-only changes in Codex, follow the existing live-bridge skip procedure
in `tests/README.md`; Codex must use its own first-party Computer Use.

Keep versions synchronized across `package.json`, `package-lock.json`,
`plugin.json`, `.claude-plugin/plugin.json`, and `.codex-plugin/plugin.json` when
consumer plugin contents change. Repository edits do not synchronize installed
plugin copies; report that boundary separately.

The source audit and its limits are recorded in
[the skill-layout research note](docs/research/skill-layout/2026-10-31.md).
