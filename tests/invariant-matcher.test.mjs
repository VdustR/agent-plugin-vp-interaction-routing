import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMarkdownForInvariant } from "../scripts/normalize-markdown.mjs";

const CROSS_BLOCK_PATTERN = /connector.*GitHub/;
const LEGACY_BLOCK_START = /^\s*(?:$|[-*+] |\d+[.)] |\||#{1,6} |>|```)/;
const LEGACY_BLOCK_END = /^\s*(?:#{1,6} |\||>|```)/;

const legacyCollapse = (text) => text.replace(/\s+/g, " ");

const legacyReflow = (text, respectBlockEnd = false) => {
  const lines = [];
  let inFence = false;
  for (const raw of text.split("\n")) {
    const isFence = /^\s*```/.test(raw);
    const previous = lines[lines.length - 1];
    const continues =
      !inFence && !isFence && previous !== undefined && previous !== "" &&
      !LEGACY_BLOCK_START.test(raw) &&
      (!respectBlockEnd || !LEGACY_BLOCK_END.test(previous));
    if (continues) lines[lines.length - 1] += ` ${raw.trim()}`;
    else lines.push(raw.trim());
    if (isFence) inFence = !inFence;
  }
  return lines.join("\n");
};

test("a wrapped continuation reads as one line", () => {
  const wrapped = "- Prefer the authenticated connector for the\n  GitHub operation.";

  assert.doesNotMatch(wrapped, /connector for the GitHub/,
    "raw text reproduces the wrapping false negative");
  assert.match(normalizeMarkdownForInvariant(wrapped), /connector for the GitHub/);
});

const separateBlocks = {
  "blank-separated list items":
    "- Prefer the authenticated connector.\n\n- A later bullet about GitHub.",
  "an ATX heading followed by prose":
    "# Policy for the connector\nGitHub is elsewhere.",
  "a Setext heading followed by prose":
    "Policy for the connector\n========================\nGitHub is elsewhere.",
  "a list item followed by another list item":
    "- Prefer the authenticated connector.\n- GitHub is elsewhere.",
  "a deeply nested list item":
    "- Prefer the authenticated connector.\n    - GitHub is elsewhere.",
  "a table row followed by prose":
    "| connector | yes |\nGitHub is elsewhere.",
  "a pipe-less table followed by prose":
    "connector | policy\n--------- | ------\nGitHub is elsewhere.",
  "a block quote followed by prose":
    "> Prefer the connector.\nGitHub is elsewhere.",
  "an ATX heading inside a block quote":
    "> Prefer the connector.\n> # GitHub is elsewhere.",
  "a list item inside a block quote":
    "> Prefer the connector.\n> - GitHub is elsewhere.",
  "backtick-fenced code followed by prose":
    "```text\nconnector\n```\nGitHub is elsewhere.",
  "tilde-fenced code followed by prose":
    "~~~text\nconnector\n~~~\nGitHub is elsewhere.",
  "frontmatter followed by prose":
    "---\ndescription: connector\n---\nGitHub is elsewhere.",
  "an indented code block followed by prose":
    "    connector\nGitHub is elsewhere.",
};

test("the blanket whitespace collapse reproduces the cross-list leak", () => {
  assert.match(legacyCollapse(separateBlocks["blank-separated list items"]),
    CROSS_BLOCK_PATTERN);
});

for (const shape of [
  "an ATX heading followed by prose",
  "a table row followed by prose",
  "a block quote followed by prose",
]) {
  test(`the current-line classifier reproduces the ${shape} leak`, () => {
    assert.match(legacyReflow(separateBlocks[shape]), CROSS_BLOCK_PATTERN);
  });
}

for (const shape of [
  "a Setext heading followed by prose",
  "frontmatter followed by prose",
]) {
  test(`the previous-line classifier reproduces the ${shape} leak`, () => {
    assert.match(legacyReflow(separateBlocks[shape], true), CROSS_BLOCK_PATTERN);
  });
}

for (const [shape, sample] of Object.entries(separateBlocks)) {
  test(`${shape} stay separate`, () => {
    assert.match(sample, /connector/, "sample must contain the first term");
    assert.match(sample, /GitHub/, "sample must contain the second term");
    assert.doesNotMatch(normalizeMarkdownForInvariant(sample), CROSS_BLOCK_PATTERN);
  });
}

test("paragraph and list-item continuation lines are normalized", () => {
  const markdown = [
    "A connector can wrap",
    "onto another line.",
    "",
    "- A GitHub operation can also wrap",
    "  onto another line.",
  ].join("\n");

  assert.equal(normalizeMarkdownForInvariant(markdown), [
    "A connector can wrap onto another line.",
    "",
    "- A GitHub operation can also wrap onto another line.",
  ].join("\n"));
});

test("block-quote continuations normalize without joining following prose", () => {
  const markdown = "> A connector wraps\n> onto GitHub.\nFollowing prose.";
  const normalized = normalizeMarkdownForInvariant(markdown);

  assert.match(normalized, /connector wraps.*GitHub/);
  assert.doesNotMatch(normalized, /GitHub.*Following/);
});

test("a fence with trailing content does not close the code block", () => {
  const markdown = "````text\n```` not a close\nconnector\nGitHub\n````";

  assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), CROSS_BLOCK_PATTERN);
});

test("an indented frontmatter scalar cannot close frontmatter", () => {
  const markdown = "---\nvalue: |\n  ---\nconnector: one\nGitHub: two\n---";

  assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), CROSS_BLOCK_PATTERN);
});

test("soft-wrapped Setext heading text is normalized within its block", () => {
  const markdown = "Policy connector\nfor the GitHub route\n---\nFollowing prose.";
  const normalized = normalizeMarkdownForInvariant(markdown);

  assert.match(normalized, /connector for the GitHub/);
  assert.doesNotMatch(normalized, /GitHub.*Following/);
});
