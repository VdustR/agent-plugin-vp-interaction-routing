import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

const NORMALIZABLE_BLOCKS = new Set(["heading", "paragraph"]);
const FRONTMATTER_DELIMITER = /^(?:---|\.\.\.)[ \t]*$/;

const splitFrontmatter = (source) => {
  const lines = source.split("\n");
  if (lines[0] !== "---") return { frontmatter: null, markdown: source };

  const closingIndex = lines.findIndex((line, index) =>
    index > 0 && FRONTMATTER_DELIMITER.test(line));
  if (closingIndex < 0) return { frontmatter: source, markdown: "" };

  return {
    frontmatter: lines.slice(0, closingIndex + 1).join("\n"),
    markdown: lines.slice(closingIndex + 1).join("\n"),
  };
};

const normalizableRanges = (tree) => {
  const ranges = [];
  const visit = (node) => {
    if (NORMALIZABLE_BLOCKS.has(node.type)) {
      ranges.push([node.position.start.offset, node.position.end.offset]);
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return ranges;
};

const normalizeParsedMarkdown = (source) => {
  if (source === "") return source;
  const tree = fromMarkdown(source, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  let normalized = source;

  // Work backwards so replacing a soft wrap does not invalidate the source
  // offsets of blocks that precede it. Container prefixes are part of the raw
  // source range but not the paragraph text, so remove them with the wrap.
  for (const [start, end] of normalizableRanges(tree).reverse()) {
    const block = normalized.slice(start, end)
      .replace(/\n(?: {0,3}>[ \t]?)*[ \t]*/g, " ");
    normalized = normalized.slice(0, start) + block + normalized.slice(end);
  }
  return normalized;
};

/**
 * Join soft-wrapped prose only inside CommonMark/GFM paragraph and heading
 * nodes. Newlines between parser-recognized blocks remain regex boundaries.
 * YAML frontmatter is kept opaque because GitHub recognizes it outside GFM.
 */
export const normalizeMarkdownForInvariant = (text) => {
  const source = text.replace(/\r\n?/g, "\n");
  const { frontmatter, markdown } = splitFrontmatter(source);
  const normalized = normalizeParsedMarkdown(markdown);
  return frontmatter === null || normalized === "" ?
    (frontmatter ?? normalized) : `${frontmatter}\n${normalized}`;
};
