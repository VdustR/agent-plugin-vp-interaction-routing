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
    "| connector | yes |\n| --------- | --- |\nGitHub is elsewhere.",
  "a pipe-less table followed by prose":
    "connector | policy\n--------- | ------\nGitHub is elsewhere.",
  "a block quote followed by prose":
    "> Prefer the connector.\n>\nGitHub is elsewhere.",
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
  "an HTML block followed by prose":
    "<!-- connector -->\nGitHub is elsewhere.",
  "a link-reference definition followed by prose":
    "[connector]: /target\nGitHub is elsewhere.",
  "a display-math block followed by prose":
    "$$\nconnector\n$$\nGitHub is elsewhere.",
};

test("the blanket whitespace collapse reproduces the cross-list leak", () => {
  assert.match(legacyCollapse(separateBlocks["blank-separated list items"]),
    CROSS_BLOCK_PATTERN);
});

const legacyStartLeaks = {
  "an ATX heading followed by prose": separateBlocks["an ATX heading followed by prose"],
  "a table-looking row followed by prose": "| connector | yes |\nGitHub is elsewhere.",
  "a quote marker followed by unmarked prose": "> Prefer the connector.\nGitHub is elsewhere.",
};

for (const [shape, sample] of Object.entries(legacyStartLeaks)) {
  test(`the current-line classifier reproduces the ${shape} leak`, () => {
    assert.match(legacyReflow(sample), CROSS_BLOCK_PATTERN);
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
  const markdown = "> A connector wraps\n> onto GitHub.\n>\nFollowing prose.";
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
  assert.doesNotMatch(normalized, /GitHub ---/);
  assert.doesNotMatch(normalized, /GitHub.*Following/);
});

test("list-relative indentation remains a paragraph continuation", () => {
  const markdown = "- Prefer the connector for\n    GitHub operations.";

  assert.match(normalizeMarkdownForInvariant(markdown), /connector for GitHub/);
});

test("a lazy block-quote continuation remains in its paragraph", () => {
  const markdown = "> Prefer the connector for\nGitHub operations.";

  assert.match(normalizeMarkdownForInvariant(markdown), /connector for GitHub/);
});

test("pipe syntax without a delimiter remains paragraph prose", () => {
  const markdown = "| Prefer the connector for |\nGitHub operations.";

  assert.match(normalizeMarkdownForInvariant(markdown), /connector for \| GitHub/);
});

test("an unmatched frontmatter opener falls back to Markdown", () => {
  const markdown = "---\n\nPrefer the connector for\nGitHub operations.";

  assert.match(normalizeMarkdownForInvariant(markdown), /connector for GitHub/);
});

test("a nested block quote strips list-relative continuation prefixes", () => {
  const markdown = "-   > Prefer the connector for\n    > GitHub operations.";

  assert.match(normalizeMarkdownForInvariant(markdown), /connector for GitHub/);
});

test("frontmatter openers accept trailing horizontal whitespace", () => {
  const markdown = "--- \ndescription: connector\n  GitHub\n---\nBody without guidance.";

  assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), CROSS_BLOCK_PATTERN);
});

test("GitHub frontmatter requires a triple-dash closer", () => {
  const markdown = "---\nPrefer the connector for\nGitHub operations.\n...";

  assert.match(normalizeMarkdownForInvariant(markdown), /connector for GitHub/);
});

test("soft-wrap folding removes trailing horizontal whitespace", () => {
  const markdown = "Prefer the connector for \nGitHub operations.";

  assert.match(normalizeMarkdownForInvariant(markdown), /connector for GitHub/);
});

test("a literal greater-than sign in a lazy continuation is preserved", () => {
  const markdown = "> Prefer the connector for\n    > GitHub operations.";
  const normalized = normalizeMarkdownForInvariant(markdown);

  assert.match(normalized, /connector for > GitHub/);
  assert.doesNotMatch(normalized, /connector for GitHub/);
});

test("a literal greater-than sign inside inline code is preserved", () => {
  const markdown = "`connector for\n    > GitHub`";
  const normalized = normalizeMarkdownForInvariant(markdown);

  assert.equal(normalized, "`connector for     > GitHub`");
  assert.doesNotMatch(normalized, /connector for GitHub/);
});

test("BOM-prefixed frontmatter remains opaque", () => {
  const markdown = "\uFEFF---\ndescription: connector for\n  GitHub\n---\nBody without guidance.";

  assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), CROSS_BLOCK_PATTERN);
});

test("explicit Markdown hard breaks remain line boundaries", () => {
  for (const markdown of ["connector for  \nGitHub", "connector for\\\nGitHub"]) {
    assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /connector for GitHub/);
  }
});

test("explicit HTML breaks at line endings remain line boundaries", () => {
  for (const markdown of [
    "connector<br>\nGitHub",
    "connector<BR />  \nGitHub",
    'connector<br class="print-only">\nGitHub',
  ]) {
    assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /connector.*GitHub/);
  }
});

test("a literal greater-than sign in image alt text is preserved", () => {
  const markdown = "![connector for\n    > GitHub](x)";
  const normalized = normalizeMarkdownForInvariant(markdown);

  assert.match(normalized, /connector for > GitHub/);
  assert.doesNotMatch(normalized, /connector for GitHub/);
});

test("decoded greater-than signs are not inserted into normalized source", () => {
  assert.equal(
    normalizeMarkdownForInvariant("connector for\n\\> GitHub"),
    "connector for \\> GitHub",
  );
  assert.equal(
    normalizeMarkdownForInvariant("connector for\n&gt; GitHub"),
    "connector for &gt; GitHub",
  );
});

test("only a mixed quote prefix's literal suffix is restored", () => {
  const markdown = "> Prefer the connector for\n>     > GitHub";

  assert.match(normalizeMarkdownForInvariant(markdown), /connector for > GitHub/);
});

test("a literal quote prefix after inline markup is not inserted early", () => {
  const markdown = "> connector for\n> *> GitHub*";

  assert.equal(normalizeMarkdownForInvariant(markdown), "> connector for *> GitHub*");
});

test("the earliest literal quote prefix on a line is retained", () => {
  const markdown = "> connector for\n>     > GitHub `> later`";
  const normalized = normalizeMarkdownForInvariant(markdown);

  assert.match(normalized, /connector for > GitHub/);
  assert.doesNotMatch(normalized, /connector for GitHub/);
});

test("line-breaking inline HTML elements preserve following newlines", () => {
  for (const markdown of [
    "connector<div>\nGitHub",
    "connector</p>\nGitHub",
    "connector<hr>\nGitHub",
    "connector<script>\nGitHub</script>",
    "connector<style>\nGitHub</style>",
    "connector<textarea>\nGitHub</textarea>",
    "connector<br><!-- note -->\nGitHub",
    "connector<hgroup>\nGitHub",
  ]) {
    assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /connector.*GitHub/);
  }
});

test("HTML breaks remain at the tag while later prose wraps", () => {
  const normalized = normalizeMarkdownForInvariant("connector<br>aside\nGitHub");

  assert.doesNotMatch(normalized, /connector.*GitHub/);
  assert.match(normalized, /aside GitHub/);
});

test("visible prose after an HTML break still folds its soft wrap", () => {
  assert.match(
    normalizeMarkdownForInvariant("intro<br>connector for\nGitHub"),
    /connector for GitHub/,
  );
  for (const tag of ["body", "html"]) {
    assert.match(
      normalizeMarkdownForInvariant(`connector<${tag}>\nGitHub`),
      /connector.*GitHub/,
    );
  }
  for (const tag of ["caption", "tbody", "td", "tfoot", "th", "thead", "tr"]) {
    assert.match(
      normalizeMarkdownForInvariant(`connector<${tag}>\nGitHub`),
      /connector.*GitHub/,
    );
  }
});

test("Markdown closing syntax after an HTML break does not hide the boundary", () => {
  assert.doesNotMatch(
    normalizeMarkdownForInvariant("connector *<br>*\nGitHub"),
    /connector.*GitHub/,
  );
});

test("multiline inline HTML contents are not folded as prose", () => {
  const markdown = "Visible <!-- connector\nGitHub -->";

  assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /connector GitHub/);
});

test("link destination and title metadata remain line-bounded", () => {
  assert.doesNotMatch(
    normalizeMarkdownForInvariant('[visible](connector\n"GitHub")'),
    /connector.*GitHub/,
  );
});

test("visible link-label wraps between inline children are folded", () => {
  assert.match(
    normalizeMarkdownForInvariant("[connector *for*\nGitHub](x)"),
    /connector \*for\* GitHub/,
  );
});

test("inline math brackets do not shift link metadata boundaries", () => {
  assert.doesNotMatch(
    normalizeMarkdownForInvariant('[visible $[$](connector\n"GitHub")'),
    /connector.*GitHub/,
  );
});

test("opaque inline HTML brackets do not shift link metadata boundaries", () => {
  for (const html of ["<?meta [?>", "<!NOTICE [>", "<![CDATA[[]]]>"]) {
    assert.doesNotMatch(
      normalizeMarkdownForInvariant(`[visible ${html}](connector\n"GitHub")`),
      /connector.*GitHub/,
    );
  }
});

test("image destination and title metadata remain line-bounded", () => {
  for (const markdown of [
    '![alt](connector\n"GitHub")',
    '![alt](connector\n"title ]( GitHub")',
    '![alt `[`](connector\n"GitHub")',
  ]) {
    assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /connector.*GitHub/);
  }
});

test("reference identifiers remain line-bounded", () => {
  for (const markdown of [
    "[visible][connector\nGitHub]\n\n[CONNECTOR GITHUB]: /url",
    "![visible][connector\nGitHub]\n\n[CONNECTOR GITHUB]: /url",
  ]) {
    assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /connector.*GitHub/);
  }
});

test("resolved footnote reference identifiers remain line-bounded", () => {
  const markdown = "visible[^connector\nGitHub]\n\n[^connector github]: note";

  assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /connector.*GitHub/);
});

test("image alt prefixes ignore destination metadata newlines", () => {
  const markdown = '![connector for\n    > GitHub](x\n"title")';
  const normalized = normalizeMarkdownForInvariant(markdown);

  assert.match(normalized, /connector for > GitHub/);
  assert.doesNotMatch(normalized, /connector for GitHub/);
});

test("invalid HTML-like image label text still participates in bracket matching", () => {
  assert.match(
    normalizeMarkdownForInvariant("![connector <x[> note]\nGitHub](x)"),
    /note\] GitHub/,
  );
});

test("decoded entity newlines do not shift quote-prefix metadata", () => {
  const markdown = "> connector for &#10;> note\n> GitHub";

  assert.match(normalizeMarkdownForInvariant(markdown), /note GitHub/);
  assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /note > GitHub/);
});

test("invalid named newline casing does not shift quote-prefix metadata", () => {
  const markdown = "> &newline;\n> connector for\n>     > GitHub";

  assert.match(normalizeMarkdownForInvariant(markdown), /connector for > GitHub/);
  assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /connector for GitHub/);
});

test("physical quote prefixes survive earlier decoded entity newlines", () => {
  const markdown = "> connector for &#10; note\n>     > GitHub";
  const normalized = normalizeMarkdownForInvariant(markdown);

  assert.match(normalized, /note > GitHub/);
  assert.doesNotMatch(normalized, /note GitHub/);
});

test("raw-text HTML element bodies remain line-bounded", () => {
  for (const tag of ["script", "style", "title", "textarea"]) {
    const markdown = `Visible<${tag}>\nconnector\nGitHub\n</${tag}>`;
    assert.doesNotMatch(normalizeMarkdownForInvariant(markdown), /connector GitHub/);
  }
  assert.doesNotMatch(
    normalizeMarkdownForInvariant("Visible<script>\nconnector\nGitHub\n</script\n>"),
    /connector GitHub/,
  );
  assert.doesNotMatch(
    normalizeMarkdownForInvariant("Visible<script/>\nconnector\nGitHub\n</script>"),
    /connector GitHub/,
  );
  assert.doesNotMatch(
    normalizeMarkdownForInvariant("Visible<template>\nconnector\nGitHub\n</template>"),
    /connector GitHub/,
  );
  for (const tag of ["iframe", "noembed", "noframes", "xmp"]) {
    assert.doesNotMatch(
      normalizeMarkdownForInvariant(`Visible<${tag}>\nconnector\nGitHub\n</${tag}>`),
      /connector GitHub/,
    );
  }
  assert.doesNotMatch(
    normalizeMarkdownForInvariant(
      "Visible<template>\n<template>\nx\n</template>\nconnector\nGitHub\n</template>",
    ),
    /connector GitHub/,
  );
  assert.doesNotMatch(
    normalizeMarkdownForInvariant(
      "Visible<script>\nx\n</script\u00a0>\nconnector\nGitHub\n</script>",
    ),
    /connector GitHub/,
  );
  assert.doesNotMatch(
    normalizeMarkdownForInvariant("Visible<script>\nfoo\n\nconnector\nGitHub\n</script>"),
    /connector GitHub/,
  );
});

test("non-rendering HTML tags do not preserve soft wraps", () => {
  assert.match(
    normalizeMarkdownForInvariant('connector<link rel="stylesheet" href="x">\nGitHub'),
    /connector.*GitHub/,
  );
});

test("inline-code newlines retain their adjacent whitespace", () => {
  assert.equal(
    normalizeMarkdownForInvariant("`connector  \nGitHub`"),
    "`connector   GitHub`",
  );
});

test("inline-code normalization removes Markdown container prefixes", () => {
  for (const markdown of [
    "> `connector for\n> GitHub`",
    "- `connector for\n  GitHub`",
  ]) {
    assert.match(normalizeMarkdownForInvariant(markdown), /connector for GitHub/);
  }
});

test("inline-math newlines remain line boundaries", () => {
  assert.doesNotMatch(normalizeMarkdownForInvariant("$connector\nGitHub$"), /connector GitHub/);
});
