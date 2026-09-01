import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown } from "mdast-util-math";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";

const NORMALIZABLE_BLOCKS = new Set(["heading", "paragraph"]);
const FRONTMATTER_DELIMITER = /^---[ \t]*$/;
const RENDERED_BLOCK_HTML = new Set([
  "address", "article", "aside", "blockquote", "center", "dd",
  "details", "dialog", "dir", "div", "dl", "dt", "fieldset", "figcaption", "figure",
  "footer", "form", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "header",
  "hgroup", "hr", "legend", "li", "main", "menu", "nav", "noframes", "ol",
  "p", "pre", "search", "section", "summary", "table", "ul",
]);

const labelRange = (node, source) => {
  const isImage = ["image", "imageReference"].includes(node.type);
  if (!isImage && !["link", "linkReference"].includes(node.type)) return null;
  const raw = source.slice(node.position.start.offset, node.position.end.offset);
  const labelStart = isImage ? 2 : 1;
  if (!raw.startsWith(isImage ? "![" : "[")) return null;
  let depth = 1;
  for (let index = labelStart; index < raw.length; index += 1) {
    if (raw[index] === "\\") {
      index += 1;
      continue;
    }
    if (raw[index] === "`") {
      const delimiter = raw.slice(index).match(/^`+/)[0];
      const closing = raw.indexOf(delimiter, index + delimiter.length);
      if (closing >= 0) index = closing + delimiter.length - 1;
      continue;
    }
    if (raw[index] === "$") {
      const delimiter = raw.slice(index).match(/^\$+/)[0];
      const closing = raw.indexOf(delimiter, index + delimiter.length);
      if (closing >= 0) index = closing + delimiter.length - 1;
      continue;
    }
    if (raw[index] === "<") {
      const html = raw.slice(index).match(
        /^(?:<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>)/,
      )?.[0];
      if (html) {
        index += html.length - 1;
        continue;
      }
    }
    if (raw[index] === "[") depth += 1;
    if (raw[index] !== "]" || --depth !== 0) continue;
    return {
      start: node.position.start.offset + labelStart,
      end: node.position.start.offset + index,
    };
  }
  return null;
};

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
      const label = labelRange(node, source);
      const raw = label ? source.slice(label.start, label.end) :
        source.slice(node.position.start.offset, node.position.end.offset);
      const newlineEvents = [...raw.matchAll(/\n|&#(?:0*10|[xX]0*[aA]);|&NewLine;/g)]
        .map((match) => match[0] === "\n");
      let event = 0;
      const physicalLiteral = literal.replace(/\n/g, () => newlineEvents[event++] ? "\n" : " ");
      if (event !== newlineEvents.length) return;
      for (const [index, line] of physicalLiteral.split("\n").entries()) {
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

const explicitBreaks = (block, source) => {
  const lines = new Set();
  const offsets = new Set();
  const visibleNodes = ["text", "inlineCode", "inlineMath", "image", "imageReference"]
    .flatMap((type) => inlineNodes(block, type));
  const visit = (node) => {
    if (node.type === "break") lines.add(node.position.end.line);
    if (node.type === "html") {
      const tag = node.value.match(/^<\/?([a-z][\w-]*)(?=[\s/>])/i)?.[1].toLowerCase();
      const newlineOffset = source.indexOf("\n", node.position.end.offset);
      if ((tag === "br" || RENDERED_BLOCK_HTML.has(tag)) && newlineOffset >= 0) {
        const hasVisibleContent = visibleNodes.some((visible) =>
          visible.position.start.offset < newlineOffset &&
          visible.position.end.offset > node.position.end.offset);
        if (hasVisibleContent) offsets.add(node.position.end.offset);
        else lines.add(node.position.end.line + 1);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(block);
  return { lines, offsets };
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

const hiddenHtmlRanges = (tree, source) => inlineNodes(tree, "html").flatMap((html) => {
  const tag = html.value.match(
    /^<(iframe|noembed|noframes|script|style|template|textarea|title|xmp)(?=[\t\n\f\r />])/i,
  )?.[1].toLowerCase();
  if (!tag) return [];

  const tail = source.slice(html.position.end.offset);
  if (tag !== "template") {
    const closing = new RegExp(`<\\/${tag}[\\t\\n\\f\\r ]*>`, "i").exec(tail);
    return closing ? [{
      start: html.position.start.offset,
      end: html.position.end.offset + closing.index + closing[0].length,
    }] : [];
  }

  const tokenPattern = /<!--[\s\S]*?-->|<\/?template(?=[\t\n\f\r />])[^>]*>/gi;
  let depth = 1;
  for (const token of tail.matchAll(tokenPattern)) {
    if (token[0].startsWith("<!--")) continue;
    if (/^<\/template/i.test(token[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      return [{
        start: html.position.start.offset,
        end: html.position.end.offset + token.index + token[0].length,
      }];
    }
  }
  return [];
});

const normalizeParsedMarkdown = (source) => {
  if (source === "") return source;
  const tree = fromMarkdown(source, {
    extensions: [gfm(), math()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  });
  let normalized = source;
  const protectedHtmlRanges = hiddenHtmlRanges(tree, source);

  // Work backwards so replacing a soft wrap does not invalidate the source
  // offsets of blocks that precede it. Container prefixes are part of the raw
  // source range but not the paragraph text, so remove them with the wrap.
  for (const node of normalizableBlocks(tree).reverse()) {
    const { start } = node.position;
    const end = node.type === "heading" ?
      (node.children.at(-1)?.position.end ?? node.position.end) : node.position.end;
    const literalPrefixes = literalQuotePrefixes(node, normalized);
    const { lines: preservedBreakLines, offsets: insertedBreakOffsets } =
      explicitBreaks(node, normalized);
    const codeNodes = inlineNodes(node, "inlineCode");
    const mathNodes = inlineNodes(node, "inlineMath");
    const htmlNodes = inlineNodes(node, "html");
    const linkNodes = [
      ...inlineNodes(node, "link"),
      ...inlineNodes(node, "linkReference"),
    ];
    const imageNodes = [
      ...inlineNodes(node, "image"),
      ...inlineNodes(node, "imageReference"),
    ];
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
    for (const offset of insertedBreakOffsets) {
      edits.push({ start: offset - start.offset, end: offset - start.offset, replacement: "\n" });
    }
    let line = start.line;
    for (const match of original.matchAll(/[ \t]*\n[ \t]*(?:>[ \t]*)*/g)) {
      line += 1;
      const newlineOffset = start.offset + match.index + match[0].indexOf("\n");
      const isInside = (child) => newlineOffset >= child.position.start.offset &&
        newlineOffset < child.position.end.offset;
      const isInsideRange = (range) => newlineOffset >= range.start && newlineOffset < range.end;
      const isLinkMetadata = linkNodes.some((link) => {
        if (!isInside(link)) return false;
        if (link.type === "linkReference" && link.identifier.startsWith("^")) return true;
        const label = labelRange(link, normalized);
        return label && newlineOffset >= label.end;
      });
      const isImageMetadata = imageNodes.some((image) => {
        if (!isInside(image)) return false;
        const label = labelRange(image, normalized);
        return label && newlineOffset >= label.end;
      });
      if (codeNodes.some(isInside) || mathNodes.some(isInside) || htmlNodes.some(isInside) ||
          protectedHtmlRanges.some(isInsideRange) ||
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
