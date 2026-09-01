import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown } from "mdast-util-math";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";

const NORMALIZABLE_BLOCKS = new Set(["heading", "paragraph"]);
const FRONTMATTER_DELIMITER = /^(?:---|\.\.\.)[ \t]*$/;
const LINE_BREAKING_HTML = new Set([
  "address", "article", "aside", "base", "basefont", "blockquote", "body", "caption",
  "center", "col", "colgroup", "dd", "details", "dialog", "dir", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "frame", "frameset", "h1", "h2",
  "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "iframe",
  "legend", "li", "link", "main", "menu", "menuitem", "nav", "noframes", "ol",
  "optgroup", "option", "p", "param", "pre", "script", "search", "section", "style",
  "summary", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "title", "tr",
  "track", "ul",
]);

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

const literalQuotePrefixes = (block, source) => {
  const prefixes = new Map();
  const visit = (node) => {
    const literal = typeof node.value === "string" ? node.value : node.alt;
    if (typeof literal === "string") {
      const raw = source.slice(node.position.start.offset, node.position.end.offset);
      if (literal.split("\n").length !== raw.split("\n").length) return;
      for (const [index, line] of literal.split("\n").entries()) {
        const prefix = line.match(/^[ \t]*((?:>[ \t]*)+)/)?.[1];
        if (prefix && !prefixes.has(node.position.start.line + index)) {
          prefixes.set(node.position.start.line + index, {
            prefix,
            startLine: node.position.start.line,
            startOffset: node.position.start.offset,
          });
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(block);
  return prefixes;
};

const explicitBreakLines = (block, source) => {
  const lines = new Set();
  const htmlNodes = inlineNodes(block, "html");
  const visit = (node) => {
    if (node.type === "break") lines.add(node.position.end.line);
    if (node.type === "html") {
      const tag = node.value.match(/^<\/?([a-z][\w-]*)(?=[\s/>])/i)?.[1].toLowerCase();
      const newlineOffset = source.indexOf("\n", node.position.end.offset);
      if ((tag === "br" || LINE_BREAKING_HTML.has(tag)) && newlineOffset >= 0) {
        let intervening = source.slice(node.position.end.offset, newlineOffset);
        for (const html of htmlNodes) {
          if (html.position.start.offset < node.position.end.offset ||
              html.position.end.offset > newlineOffset) continue;
          const start = html.position.start.offset - node.position.end.offset;
          const end = html.position.end.offset - node.position.end.offset;
          intervening = intervening.slice(0, start) + " ".repeat(end - start) + intervening.slice(end);
        }
        if (/^[ \t]*$/.test(intervening)) lines.add(node.position.end.line + 1);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(block);
  return lines;
};

const inlineNodes = (block, type) => {
  const nodes = [];
  const visit = (node) => {
    if (node.type === type) nodes.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(block);
  return nodes;
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
    const literalPrefixes = literalQuotePrefixes(node, normalized);
    const preservedBreakLines = explicitBreakLines(node, normalized);
    const codeNodes = inlineNodes(node, "inlineCode");
    const mathNodes = inlineNodes(node, "inlineMath");
    const htmlNodes = inlineNodes(node, "html");
    const linkNodes = inlineNodes(node, "link");
    const imageNodes = inlineNodes(node, "image");
    const original = normalized.slice(start.offset, end.offset);
    const edits = codeNodes.map((code) => {
      const raw = normalized.slice(code.position.start.offset, code.position.end.offset);
      const delimiter = raw.match(/^`+/)?.[0] ?? "`";
      return {
        start: code.position.start.offset - start.offset,
        end: code.position.end.offset - start.offset,
        replacement: `${delimiter}${code.value.replace(/\n/g, " ")}${delimiter}`,
      };
    });
    let line = start.line;
    for (const match of original.matchAll(/[ \t]*\n[ \t]*(?:>[ \t]*)*/g)) {
      line += 1;
      const newlineOffset = start.offset + match.index + match[0].indexOf("\n");
      const isInside = (child) => newlineOffset >= child.position.start.offset &&
        newlineOffset < child.position.end.offset;
      const isLinkMetadata = linkNodes.some((link) => isInside(link) &&
        !link.children.some(isInside));
      const isImageMetadata = imageNodes.some((image) => {
        if (!isInside(image)) return false;
        const raw = normalized.slice(image.position.start.offset, image.position.end.offset);
        const metadataOffset = raw.lastIndexOf("](");
        return metadataOffset >= 0 &&
          newlineOffset >= image.position.start.offset + metadataOffset + 2;
      });
      if (codeNodes.some(isInside) || mathNodes.some(isInside) || htmlNodes.some(isInside) ||
          isLinkMetadata || isImageMetadata || preservedBreakLines.has(line)) {
        continue;
      }
      const consumedPrefix = match[0].match(/\n[ \t]*((?:>[ \t]*)+)$/)?.[1];
      const literal = literalPrefixes.get(line);
      const matchEnd = start.offset + match.index + match[0].length;
      const beginsAfterMatch = literal?.startLine === line && literal.startOffset >= matchEnd;
      edits.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement: ` ${consumedPrefix && !beginsAfterMatch ? (literal?.prefix ?? "") : ""}`,
      });
    }
    let block = original;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      block = block.slice(0, edit.start) + edit.replacement + block.slice(edit.end);
    }
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
