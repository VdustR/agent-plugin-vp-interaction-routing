import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMarkdownForInvariant } from "../scripts/normalize-markdown.mjs";

const CROSS_BLOCK_PATTERN = /connector.*GitHub/;

test("a wrapped continuation reads as one line", () => {
  const wrapped = "- Prefer the authenticated connector for the\n  GitHub operation.";

  assert.doesNotMatch(wrapped, /connector for the GitHub/);
  assert.match(normalizeMarkdownForInvariant(wrapped), /connector for the GitHub/);
});

const separateBlocks = {
  "blank-separated paragraphs":
    "Prefer the connector.\n\nGitHub is in a later paragraph.",
  "adjacent list items":
    "- Prefer the connector.\n- GitHub is in a later item.",
  "an ATX heading and prose":
    "# Policy for the connector\nGitHub is elsewhere.",
  "a Setext heading and prose":
    "Policy for the connector\n========================\nGitHub is elsewhere.",
  "a block quote and prose":
    "> Prefer the connector.\n\nGitHub is elsewhere.",
  "a table row and prose":
    "| connector | enabled |\n| --- | --- |\n\nGitHub is elsewhere.",
  "fenced code and prose":
    "```text\nconnector\n```\n\nGitHub is elsewhere.",
  "frontmatter and prose":
    "---\ndescription: connector\n---\nGitHub is elsewhere.",
};

for (const [shape, sample] of Object.entries(separateBlocks)) {
  test(`${shape} stay separate`, () => {
    assert.match(sample, /connector/, "sample must contain the first term");
    assert.match(sample, /GitHub/, "sample must contain the second term");
    assert.doesNotMatch(normalizeMarkdownForInvariant(sample), CROSS_BLOCK_PATTERN);
  });
}

test("paragraph and list-item continuation lines normalize", () => {
  const normalized = normalizeMarkdownForInvariant([
    "A connector can wrap",
    "onto another line.",
    "",
    "- A GitHub operation can also wrap",
    "  onto another line.",
  ].join("\n"));

  assert.equal(normalized, [
    "A connector can wrap onto another line.",
    "A GitHub operation can also wrap onto another line.",
  ].join("\n\0\n"));
});

test("hard breaks remain regex boundaries", () => {
  assert.doesNotMatch(
    normalizeMarkdownForInvariant("connector  \nGitHub"),
    CROSS_BLOCK_PATTERN,
  );
});

test("whitespace matchers cannot cross Markdown blocks", () => {
  assert.doesNotMatch(
    normalizeMarkdownForInvariant("connector\n\nGitHub"),
    /connector\s+GitHub/,
  );
});

test("inline Markdown contributes rendered prose without metadata", () => {
  assert.equal(
    normalizeMarkdownForInvariant(
      "Use the **connector** with [GitHub](https://example.com/connector).",
    ),
    "Use the connector with GitHub.",
  );
});

test("raw HTML remains opaque", () => {
  assert.doesNotMatch(
    normalizeMarkdownForInvariant("<div>connector\nGitHub</div>"),
    CROSS_BLOCK_PATTERN,
  );
});

test("inline HTML does not disable surrounding prose normalization", () => {
  assert.match(
    normalizeMarkdownForInvariant(
      "Prefer the connector <kbd>CLI</kbd> for the\nGitHub operation.",
    ),
    /connector CLI for the GitHub/,
  );
});

test("inline HTML breaks remain regex boundaries", () => {
  for (const tag of ["<br>", '<br class="note">']) {
    assert.doesNotMatch(
      normalizeMarkdownForInvariant(`connector ${tag}\nGitHub`),
      CROSS_BLOCK_PATTERN,
    );
  }
});

test("image alt text normalizes soft wraps", () => {
  assert.match(
    normalizeMarkdownForInvariant("![authenticated connector for\nGitHub](route.png)"),
    /connector for GitHub/,
  );
});

test("footnote definitions remain metadata", () => {
  assert.doesNotMatch(
    normalizeMarkdownForInvariant("[^route]: connector\n    GitHub"),
    CROSS_BLOCK_PATTERN,
  );
});
