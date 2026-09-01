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
const VOID_HTML = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);

const HTML_COMMENT_SOURCE = String.raw`<!--(?!>|->)(?:(?!--)[\s\S])*?(?<!-)-->`;
const HTML_TAG_SOURCE = String.raw`<\/?[A-Za-z][A-Za-z0-9-]*(?:[\t\n\f\r ]+[A-Za-z_:][\w:.-]*(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"[^"]*"|'[^']*'|[^\t\n\f\r "'=<>\x60]+))?)*[\t\n\f\r ]*\/?>`;
const HTML_TOKEN_PATTERN = new RegExp(
  `${HTML_COMMENT_SOURCE}|<\\?[\\s\\S]*?\\?>|<![A-Z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|${HTML_TAG_SOURCE}`,
  "gi",
);

const matchingDelimiterEnd = (source, start, marker) => {
  const length = source.slice(start).match(new RegExp(`^\\${marker}+`))[0].length;
  for (let index = start + length; index < source.length;) {
    index = source.indexOf(marker, index);
    if (index < 0) return -1;
    const runLength = source.slice(index).match(new RegExp(`^\\${marker}+`))[0].length;
    if (runLength === length) return index + length;
    index += runLength;
  }
  return -1;
};

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
      const closing = matchingDelimiterEnd(raw, index, "`");
      if (closing >= 0) index = closing - 1;
      continue;
    }
    if (raw[index] === "$") {
      const closing = matchingDelimiterEnd(raw, index, "$");
      if (closing >= 0) index = closing - 1;
      continue;
    }
    if (raw[index] === "<") {
      const html = raw.slice(index).match(
        new RegExp(`^(?:${HTML_COMMENT_SOURCE}|<\\?[\\s\\S]*?\\?>|<![A-Z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|${HTML_TAG_SOURCE})`),
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
  const openBlockTags = new Map();
  const visibleNodes = ["text", "inlineCode", "inlineMath", "image", "imageReference"]
    .flatMap((type) => inlineNodes(block, type));
  const visit = (node) => {
    if (node.type === "break") lines.add(node.position.end.line);
    if (node.type === "html") {
      const tagMatch = node.value.match(/^<(\/)?([a-z][\w-]*)(?=[\s/>])/i);
      const tag = tagMatch?.[2].toLowerCase();
      const isClosing = Boolean(tagMatch?.[1]);
      const hasVisibleBefore = visibleNodes.some((visible) =>
        visible.position.end.offset <= node.position.start.offset);
      const isApplicableOpening = !(tag === "frameset" && hasVisibleBefore);
      const isActiveClosing = (!isClosing && isApplicableOpening) || tag === "p" ||
        (openBlockTags.get(tag) ?? 0) > 0;
      const newlineOffset = source.indexOf("\n", node.position.end.offset);
      if ((tag === "br" || (RENDERED_BLOCK_HTML.has(tag) && isActiveClosing)) && newlineOffset >= 0) {
        const hasVisibleContent = visibleNodes.some((visible) =>
          visible.position.start.offset < newlineOffset &&
          visible.position.end.offset > node.position.end.offset);
        if (hasVisibleContent) offsets.add(node.position.end.offset);
        else lines.add(node.position.end.line + 1);
      }
      if (RENDERED_BLOCK_HTML.has(tag) && tag !== "p") {
        const depth = openBlockTags.get(tag) ?? 0;
        if (isClosing) openBlockTags.set(tag, Math.max(0, depth - 1));
        else if (isApplicableOpening && !VOID_HTML.has(tag)) openBlockTags.set(tag, depth + 1);
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

const htmlTokens = (tree) => inlineNodes(tree, "html").flatMap((node) =>
  [...node.value.matchAll(HTML_TOKEN_PATTERN)].map((token) => ({
    value: token[0],
    start: node.position.start.offset + token.index,
    end: node.position.start.offset + token.index + token[0].length,
  })));

const parseHtmlTag = (token) => {
  const opening = token.match(/^<(\/)?([A-Za-z][A-Za-z0-9-]*)/);
  if (!opening) return null;
  const attributes = new Set();
  let index = opening[0].length;
  while (!opening[1] && index < token.length) {
    const whitespace = token.slice(index).match(/^[\t\n\f\r ]+/)?.[0].length ?? 0;
    index += whitespace;
    if (/^\/?>/.test(token.slice(index))) break;
    const name = token.slice(index).match(/^[A-Za-z_:][\w:.-]*/)?.[0];
    if (!name) break;
    attributes.add(name.toLowerCase());
    index += name.length;
    index += token.slice(index).match(/^[\t\n\f\r ]*/)[0].length;
    if (token[index] !== "=") continue;
    index += 1;
    index += token.slice(index).match(/^[\t\n\f\r ]*/)[0].length;
    const value = token.slice(index).match(/^(?:"[^"]*"|'[^']*'|[^\t\n\f\r "'=<>`]+)/)?.[0];
    if (value) index += value.length;
  }
  return { tag: opening[2].toLowerCase(), isClosing: Boolean(opening[1]), attributes };
};

const rawClosingEnd = (tag, tail) => {
  const closing = new RegExp(
    `<\\/${tag}(?=[\\t\\n\\f\\r />])(?:"[^"]*"|'[^']*'|[^>])*>`,
    "i",
  ).exec(tail);
  return closing ? closing.index + closing[0].length : -1;
};

const scriptClosingEnd = (tail) => {
  const tokens = /<!--|-->|<script(?=[\t\n\f\r />])|<\/script(?=[\t\n\f\r />])(?:"[^"]*"|'[^']*'|[^>])*>/gi;
  let state = "normal";
  for (const token of tail.matchAll(tokens)) {
    if (token[0] === "<!--" && state === "normal") state = "escaped";
    else if (token[0] === "-->" && state === "escaped") state = "normal";
    else if (/^<script/i.test(token[0]) && state === "escaped") state = "double";
    else if (/^<\/script/i.test(token[0])) {
      if (state === "double") state = "escaped";
      else return token.index + token[0].length;
    }
  }
  return -1;
};

const PROTECTED_HTML_TAGS = new Set([
  "iframe", "listing", "noembed", "noframes", "noscript", "plaintext", "pre", "script",
  "style", "template", "textarea", "title", "xmp",
]);
const BALANCED_HTML_TAGS = new Set(["details", "listing", "pre", "template"]);

const isProtectedOpening = (parsed) => !parsed.isClosing && (
  PROTECTED_HTML_TAGS.has(parsed.tag) || parsed.attributes.has("hidden") ||
  (["details", "dialog"].includes(parsed.tag) && !parsed.attributes.has("open"))
);

const protectedHtmlClosingEnd = (tag, tail, forceBalanced = false) => {
  if (tag === "plaintext") return tail.length;
  if (tag === "script") return scriptClosingEnd(tail);
  if (tag === "noscript" || (!forceBalanced && !BALANCED_HTML_TAGS.has(tag))) {
    return rawClosingEnd(tag, tail);
  }

  let depth = 1;
  let skipUntil = 0;
  for (const token of tail.matchAll(HTML_TOKEN_PATTERN)) {
    if (token.index < skipUntil) continue;
    const parsed = parseHtmlTag(token[0]);
    if (!parsed) continue;
    if (parsed.tag !== tag && isProtectedOpening(parsed)) {
      const childStart = token.index + token[0].length;
      const childEnd = protectedHtmlClosingEnd(
        parsed.tag,
        tail.slice(childStart),
        parsed.attributes.has("hidden") || ["details", "dialog"].includes(parsed.tag),
      );
      if (childEnd < 0) return -1;
      skipUntil = childStart + childEnd;
      continue;
    }
    if (parsed.tag !== tag) continue;
    if (parsed.isClosing) depth -= 1;
    else depth += 1;
    if (depth === 0) return token.index + token[0].length;
  }
  return -1;
};

const summaryParts = (body) => {
  const tokens = [...body.matchAll(HTML_TOKEN_PATTERN)];
  const opening = tokens.find((token) => {
    const parsed = parseHtmlTag(token[0]);
    return parsed?.tag === "summary" && !parsed.isClosing;
  });
  if (!opening) return null;
  const closing = tokens.find((token) => {
    const parsed = parseHtmlTag(token[0]);
    return token.index > opening.index && parsed?.tag === "summary" && parsed.isClosing;
  });
  if (!closing) return null;
  const contentStart = opening.index + opening[0].length;
  return {
    prefix: body.slice(0, opening.index),
    opening: opening[0],
    content: body.slice(contentStart, closing.index),
    closing: closing[0],
    suffix: body.slice(closing.index + closing[0].length),
    bodyStart: closing.index + closing[0].length,
  };
};

const closingTagStart = (tag, tail, closingEnd) => {
  const closing = [...tail.slice(0, closingEnd).matchAll(HTML_TOKEN_PATTERN)].reverse()
    .find((token) => {
      const parsed = parseHtmlTag(token[0]);
      return parsed?.tag === tag && parsed.isClosing;
    });
  return closing?.index ?? -1;
};

const normalizeConditionalContainers = (tree, source) => {
  const edits = [];
  let claimedEnd = -1;
  for (const html of htmlTokens(tree)) {
    if (html.start < claimedEnd) continue;
    const parsed = parseHtmlTag(html.value);
    if (!parsed || parsed.isClosing || !["details", "dialog"].includes(parsed.tag)) continue;
    const tail = source.slice(html.end);
    const closingEnd = protectedHtmlClosingEnd(parsed.tag, tail, true);
    if (closingEnd < 0) continue;
    const rangeEnd = html.end + closingEnd;
    const relativeClosingStart = closingTagStart(parsed.tag, tail, closingEnd);
    if (relativeClosingStart < 0) continue;
    const closingStart = html.end + relativeClosingStart;
    const body = source.slice(html.end, closingStart);
    let replacement = body;
    if (parsed.tag === "details") {
      const summary = summaryParts(body);
      if (summary) {
        replacement = normalizeParsedMarkdown(summary.prefix, true) + summary.opening +
          normalizeParsedMarkdown(summary.content, true) + summary.closing +
          (parsed.attributes.has("open") ? normalizeParsedMarkdown(summary.suffix, true) : summary.suffix);
      } else if (parsed.attributes.has("open")) replacement = normalizeParsedMarkdown(body, true);
    } else if (parsed.attributes.has("open")) replacement = normalizeParsedMarkdown(body, true);
    edits.push({
      start: html.end,
      end: closingStart,
      replacement,
    });
    claimedEnd = rangeEnd;
  }
  let normalized = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    normalized = normalized.slice(0, edit.start) + edit.replacement + normalized.slice(edit.end);
  }
  return normalized;
};

const hiddenHtmlRanges = (tree, source) => {
  const ranges = [];
  for (const html of htmlTokens(tree)) {
    if (ranges.some((range) => html.start < range.end)) continue;
    const parsed = parseHtmlTag(html.value);
    if (!parsed || !isProtectedOpening(parsed)) continue;

    const tail = source.slice(html.end);
    const closingEnd = protectedHtmlClosingEnd(
      parsed.tag,
      tail,
      parsed.attributes.has("hidden") || ["details", "dialog"].includes(parsed.tag),
    );
    let start = html.start;
    if (parsed.tag === "details") {
      const closingStart = closingEnd < 0 ? source.length : html.end + closingEnd;
      const summary = summaryParts(source.slice(html.end, closingStart));
      if (summary) start = html.end + summary.bodyStart;
    }
    ranges.push({
      start,
      end: closingEnd >= 0 ? html.end + closingEnd : source.length,
    });
  }
  return ranges;
};

const normalizeParsedMarkdown = (source, normalizeDetails = true) => {
  if (source === "") return source;
  const tree = fromMarkdown(source, {
    extensions: [gfm(), math()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  });
  if (normalizeDetails) {
    const detailsNormalized = normalizeConditionalContainers(tree, source);
    if (detailsNormalized !== source) return normalizeParsedMarkdown(detailsNormalized, false);
  }
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
        if (link.type === "linkReference" && link.referenceType === "shortcut" &&
            link.identifier.startsWith("^")) return true;
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
