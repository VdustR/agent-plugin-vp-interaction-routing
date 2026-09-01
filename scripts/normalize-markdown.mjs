import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown } from "mdast-util-math";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";

const NORMALIZABLE_BLOCKS = new Set(["heading", "paragraph"]);
const FRONTMATTER_DELIMITER = /^(?:---|\.\.\.)[ \t]*$/;

const splitFrontmatter = (source) => {
  const lines = source.split("\n");
  if (!/^---[ \t]*$/.test(lines[0])) return { frontmatter: null, markdown: source };

  const closingIndex = lines.findIndex((line, index) =>
    index > 0 && FRONTMATTER_DELIMITER.test(line));
  if (closingIndex < 0) return { frontmatter: null, markdown: source };

  return {
    frontmatter: lines.slice(0, closingIndex + 1).join("\n"),
    markdown: lines.slice(closingIndex + 1).join("\n"),
  };
};

const normalizableBlocks = (tree) => {
  const blocks = [];
  const visit = (node) => {
    if (NORMALIZABLE_BLOCKS.has(node.type)) {
      blocks.push(node);
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return blocks;
};

const literalQuotePrefixes = (block) => {
  const prefixes = new Map();
  const visit = (node) => {
    if (node.type === "text") {
      for (const [index, line] of node.value.split("\n").entries()) {
        const prefix = line.match(/^(?:>[ \t]*)+/)?.[0];
        if (prefix) prefixes.set(node.position.start.line + index, prefix);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(block);
  return prefixes;
};

const normalizeParsedMarkdown = (source) => {
  if (source === "") return source;
  const tree = fromMarkdown(source, {
    extensions: [gfm(), math()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  });
  let normalized = source;

  // Work backwards so replacing a soft wrap does not invalidate the source
  // offsets of blocks that precede it. Container prefixes are part of the raw
  // source range but not the paragraph text, so remove them with the wrap.
  for (const node of normalizableBlocks(tree).reverse()) {
    const { start, end } = node.position;
    const literalPrefixes = literalQuotePrefixes(node);
    let line = start.line;
    const block = normalized.slice(start.offset, end.offset)
      .replace(/[ \t]*\n[ \t]*(?:>[ \t]*)*/g, () => {
        line += 1;
        return ` ${literalPrefixes.get(line) ?? ""}`;
      });
    normalized = normalized.slice(0, start.offset) + block + normalized.slice(end.offset);
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
