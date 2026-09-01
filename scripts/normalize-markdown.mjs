import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown } from "mdast-util-math";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";

const NORMALIZABLE_BLOCKS = new Set(["heading", "paragraph"]);
const FRONTMATTER_DELIMITER = /^(?:---|\.\.\.)[ \t]*$/;

const splitFrontmatter = (source) => {
  const lines = source.split("\n");
  const opening = lines[0].replace(/^\uFEFF/, "");
  if (!/^---[ \t]*$/.test(opening)) return { frontmatter: null, markdown: source };

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
    const literal = typeof node.value === "string" ? node.value : node.alt;
    if (typeof literal === "string") {
      for (const [index, line] of literal.split("\n").entries()) {
        const prefix = line.match(/^[ \t]*((?:>[ \t]*)+)/)?.[1];
        if (prefix) prefixes.set(node.position.start.line + index, prefix);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(block);
  return prefixes;
};

const explicitBreakLines = (block, source) => {
  const lines = new Set();
  const visit = (node) => {
    if (node.type === "break") lines.add(node.position.end.line);
    if (node.type === "html" && /^<br\s*\/?>$/i.test(node.value) &&
        /^[ \t]*\n/.test(source.slice(node.position.end.offset))) {
      lines.add(node.position.end.line + 1);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(block);
  return lines;
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
    const { start } = node.position;
    const end = node.type === "heading" ?
      (node.children.at(-1)?.position.end ?? node.position.end) : node.position.end;
    const literalPrefixes = literalQuotePrefixes(node);
    const preservedBreakLines = explicitBreakLines(node, normalized);
    let line = start.line;
    const block = normalized.slice(start.offset, end.offset)
      .replace(/[ \t]*\n[ \t]*(?:>[ \t]*)*/g, (match) => {
        line += 1;
        if (preservedBreakLines.has(line)) return match;
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
