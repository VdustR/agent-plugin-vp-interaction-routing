import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown } from "mdast-util-math";
import { decodeNamedCharacterReference } from "decode-named-character-reference";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";

const NORMALIZABLE_BLOCKS = new Set(["heading", "paragraph"]);
const FRONTMATTER_DELIMITER = /^---[ \t]*$/;
const RENDERED_BLOCK_HTML = new Set([
  "address", "article", "aside", "blockquote", "center", "dd",
  "details", "dialog", "dir", "div", "dl", "dt", "fieldset", "figcaption", "figure",
  "footer", "form", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "header",
  "hgroup", "hr", "legend", "li", "main", "menu", "nav", "noframes", "ol",
  "listing", "p", "pre", "search", "section", "summary", "table", "ul", "xmp",
]);
const VOID_HTML = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);
const IMPLICIT_SAME_TAG_CLOSE = new Set([
  "dd", "dt", "li", "optgroup", "option", "p", "rp", "rt", "tbody", "td",
  "tfoot", "th", "thead", "tr",
]);
const IMPLICIT_CROSS_TAG_CLOSE = new Map([
  ["dd", new Set(["dd", "dt"])],
  ["dt", new Set(["dd", "dt"])],
  ["optgroup", new Set(["optgroup"])],
  ["option", new Set(["optgroup", "option"])],
  ["tbody", new Set(["tbody", "tfoot"])],
  ["td", new Set(["td", "th"])],
  ["th", new Set(["td", "th"])],
  ["thead", new Set(["tbody", "tfoot"])],
  ["tr", new Set(["tr"])],
]);
const P_CLOSING_START_TAGS = new Set([
  "address", "article", "aside", "blockquote", "details", "dialog", "div", "dl",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4",
  "h5", "h6", "header", "hgroup", "hr", "main", "menu", "nav", "ol", "p", "pre",
  "search", "section", "summary", "table", "ul",
]);
const TABLE_CONTEXT_TAGS = new Set([
  "caption", "colgroup", "table", "tbody", "td", "tfoot", "th", "thead", "tr",
]);
const TABLE_IN_BODY_CONTEXT_TAGS = new Set(["caption", "td", "th"]);
const C1_NUMERIC_REPLACEMENTS = new Map([
  [0x80, 0x20AC], [0x82, 0x201A], [0x83, 0x0192], [0x84, 0x201E],
  [0x85, 0x2026], [0x86, 0x2020], [0x87, 0x2021], [0x88, 0x02C6],
  [0x89, 0x2030], [0x8A, 0x0160], [0x8B, 0x2039], [0x8C, 0x0152],
  [0x8E, 0x017D], [0x91, 0x2018], [0x92, 0x2019], [0x93, 0x201C],
  [0x94, 0x201D], [0x95, 0x2022], [0x96, 0x2013], [0x97, 0x2014],
  [0x98, 0x02DC], [0x99, 0x2122], [0x9A, 0x0161], [0x9B, 0x203A],
  [0x9C, 0x0153], [0x9E, 0x017E], [0x9F, 0x0178],
]);
const ANCESTOR_END_CLOSES = new Map([
  ["dd", new Set(["dl"])],
  ["dt", new Set(["dl"])],
  ["li", new Set(["menu", "ol", "ul"])],
  ["option", new Set(["datalist", "select"])],
  ["optgroup", new Set(["select"])],
  ["td", new Set(["table", "tbody", "tfoot", "thead", "tr"])],
  ["th", new Set(["table", "tbody", "tfoot", "thead", "tr"])],
  ["tr", new Set(["table", "tbody", "tfoot", "thead"])],
  ["tbody", new Set(["table"])],
  ["tfoot", new Set(["table"])],
  ["thead", new Set(["table"])],
]);

const HTML_COMMENT_SOURCE = String.raw`<!--(?!>|->)(?:(?!--)[\s\S])*?(?:(?<!-)--!?>|$)`;
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
  const definitions = new Map();
  const referencedFootnotes = new Set();
  const collectReferences = (node, includeDefinitions = false) => {
    if (node.type === "footnoteDefinition" && !includeDefinitions) return;
    if (node.type === "footnoteReference") referencedFootnotes.add(node.identifier);
    for (const child of node.children ?? []) collectReferences(child, includeDefinitions);
  };
  const collectDefinitions = (node) => {
    if (node.type === "footnoteDefinition") definitions.set(node.identifier, node);
    for (const child of node.children ?? []) collectDefinitions(child);
  };
  collectDefinitions(tree);
  collectReferences(tree);
  for (const identifier of referencedFootnotes) {
    const definition = definitions.get(identifier);
    if (definition) collectReferences(definition, true);
  }
  const visit = (node) => {
    if (node.type === "footnoteDefinition" && !referencedFootnotes.has(node.identifier)) return;
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
  const hiddenElements = [];
  const visibleNodes = ["text", "inlineCode", "inlineMath", "image", "imageReference"]
    .flatMap((type) => inlineNodes(block, type));
  const visit = (node) => {
    if (node.type === "break") lines.add(node.position.end.line);
    if (node.type === "html") {
      const parsed = parseHtmlTag(node.value);
      const tag = parsed?.tag;
      const isClosing = Boolean(parsed?.isClosing);
      if (!isClosing && hiddenElements.length > 0) {
        const hiddenTag = hiddenElements.at(-1);
        if ((hiddenTag === "p" && P_CLOSING_START_TAGS.has(tag)) ||
            IMPLICIT_CROSS_TAG_CLOSE.get(hiddenTag)?.has(tag) ||
            (hiddenTag === tag && IMPLICIT_SAME_TAG_CLOSE.has(tag))) {
          hiddenElements.pop();
        }
      }
      if (isClosing && hiddenElements.length > 0 &&
          ANCESTOR_END_CLOSES.get(hiddenElements.at(-1))?.has(tag)) {
        hiddenElements.pop();
      }
      const hiddenMatch = isClosing ? hiddenElements.findLastIndex((item) => item === tag) : -1;
      const opensHidden = !isClosing && (parsed?.attributes.has("hidden") ||
        (tag === "dialog" && !parsed?.attributes.has("open")));
      const isHidden = hiddenElements.length > 0 || opensHidden || hiddenMatch >= 0;
      const hasVisibleBefore = visibleNodes.some((visible) =>
        visible.position.end.offset <= node.position.start.offset);
      const isApplicableOpening = !(tag === "frameset" && hasVisibleBefore);
      const isActiveClosing = (!isClosing && isApplicableOpening) || tag === "p" ||
        (openBlockTags.get(tag) ?? 0) > 0;
      const newlineOffset = source.indexOf("\n", node.position.end.offset);
      if (!isHidden && (tag === "br" || (RENDERED_BLOCK_HTML.has(tag) && isActiveClosing))) {
        const visibleLimit = newlineOffset >= 0 ? newlineOffset : block.position.end.offset + 1;
        const hasVisibleContent = visibleNodes.some((visible) =>
          visible.position.start.offset < visibleLimit &&
          visible.position.end.offset > node.position.end.offset);
        if (hasVisibleContent) offsets.add(node.position.end.offset);
        else if (newlineOffset >= 0) lines.add(node.position.end.line + 1);
      }
      if (RENDERED_BLOCK_HTML.has(tag) && tag !== "p") {
        const depth = openBlockTags.get(tag) ?? 0;
        if (isClosing) openBlockTags.set(tag, Math.max(0, depth - 1));
        else if (isApplicableOpening && !VOID_HTML.has(tag)) openBlockTags.set(tag, depth + 1);
      }
      if (hiddenMatch >= 0) hiddenElements.splice(hiddenMatch, 1);
      else if (opensHidden && !VOID_HTML.has(tag)) hiddenElements.push(tag);
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
    block: node.value.includes("\n"),
    nodeEnd: node.position.end.offset,
    nodeStart: node.position.start.offset,
    value: token[0],
    start: node.position.start.offset + token.index,
    end: node.position.start.offset + token.index + token[0].length,
  })));

const parseHtmlTag = (token) => {
  const opening = token.match(/^<(\/)?([A-Za-z][A-Za-z0-9-]*)/);
  if (!opening) return null;
  const attributes = new Map();
  let index = opening[0].length;
  while ((!opening[1] || opening[2].toLowerCase() === "br") && index < token.length) {
    const whitespace = token.slice(index).match(/^[\t\n\f\r ]+/)?.[0].length ?? 0;
    index += whitespace;
    if (/^\/?>/.test(token.slice(index))) break;
    const name = token.slice(index).match(/^[A-Za-z_:][\w:.-]*/)?.[0];
    if (!name) break;
    const normalizedName = name.toLowerCase();
    index += name.length;
    index += token.slice(index).match(/^[\t\n\f\r ]*/)[0].length;
    if (token[index] !== "=") {
      if (!attributes.has(normalizedName)) attributes.set(normalizedName, "");
      continue;
    }
    index += 1;
    index += token.slice(index).match(/^[\t\n\f\r ]*/)[0].length;
    const value = token.slice(index).match(/^(?:"[^"]*"|'[^']*'|[^\t\n\f\r "'=<>`]+)/)?.[0];
    if (value) {
      index += value.length;
      const rawValue = /^['"]/.test(value) ? value.slice(1, -1) : value;
      if (!attributes.has(normalizedName)) attributes.set(normalizedName, rawValue.replace(
        /&(#(?:[xX][0-9A-Fa-f]+|[0-9]+);?|[A-Za-z][A-Za-z0-9]+(?:;|(?=[^A-Za-z0-9=]|$)))/g,
        (reference, name) => {
          if (name.startsWith("#")) {
            const numericName = name.endsWith(";") ? name.slice(0, -1) : name;
            const value = /^#x/i.test(numericName) ? Number.parseInt(numericName.slice(2), 16) :
              Number.parseInt(numericName.slice(1), 10);
            const codePoint = !Number.isFinite(value) || value === 0 || value > 0x10FFFF ||
              (value >= 0xD800 && value <= 0xDFFF) ? 0xFFFD : value;
            return String.fromCodePoint(C1_NUMERIC_REPLACEMENTS.get(codePoint) ?? codePoint);
          }
          const namedName = name.endsWith(";") ? name.slice(0, -1) : name;
          return decodeNamedCharacterReference(namedName) || reference;
        },
      ));
    } else if (!attributes.has(normalizedName)) attributes.set(normalizedName, "");
  }
  const tag = opening[2].toLowerCase();
  return { tag, isClosing: Boolean(opening[1]) && tag !== "br", attributes };
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
    else if (token[0] === "-->" && state === "double") state = "escaped";
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
  "canvas", "datalist", "iframe", "listing", "noembed", "noframes", "noscript", "plaintext", "pre", "script",
  "style", "template", "textarea", "title", "xmp",
]);
const BALANCED_HTML_TAGS = new Set(["details", "listing", "pre", "template"]);

const isProtectedOpening = (parsed) => !parsed.isClosing && (
  PROTECTED_HTML_TAGS.has(parsed.tag) ||
  (parsed.attributes.has("hidden") && !VOID_HTML.has(parsed.tag)) ||
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
      const consumedToken = [...tail.slice(0, skipUntil).matchAll(HTML_TOKEN_PATTERN)].at(-1);
      const consumedParsed = consumedToken && parseHtmlTag(consumedToken[0]);
      if (consumedParsed?.isClosing && consumedParsed.tag === tag) return skipUntil;
      continue;
    }
    if (forceBalanced && tag === "p" && !parsed.isClosing &&
        P_CLOSING_START_TAGS.has(parsed.tag)) return token.index;
    if (forceBalanced && !parsed.isClosing &&
        IMPLICIT_CROSS_TAG_CLOSE.get(tag)?.has(parsed.tag)) return token.index;
    if (forceBalanced && parsed.isClosing &&
        ANCESTOR_END_CLOSES.get(tag)?.has(parsed.tag)) return token.index + token[0].length;
    if (parsed.tag !== tag) continue;
    if (parsed.isClosing) depth -= 1;
    else if (forceBalanced && IMPLICIT_SAME_TAG_CLOSE.has(tag)) return token.index;
    else depth += 1;
    if (depth === 0) return token.index + token[0].length;
  }
  return -1;
};

const summaryParts = (body) => {
  const tokens = [...body.matchAll(HTML_TOKEN_PATTERN)];
  const stack = [];
  let opening = null;
  for (const token of tokens) {
    const parsed = parseHtmlTag(token[0]);
    if (!parsed) continue;
    if (!parsed.isClosing && stack.at(-1) === "p" &&
        P_CLOSING_START_TAGS.has(parsed.tag)) stack.pop();
    const isDirectSummary = stack.length === 0 ||
      (stack.every((tag) => TABLE_CONTEXT_TAGS.has(tag)) &&
        !stack.some((tag) => TABLE_IN_BODY_CONTEXT_TAGS.has(tag)));
    if (parsed.tag === "summary" && !parsed.isClosing && isDirectSummary) {
      opening = token;
      break;
    }
    if (parsed.isClosing) {
      const match = stack.lastIndexOf(parsed.tag);
      if (match >= 0) stack.splice(match);
    } else if (!VOID_HTML.has(parsed.tag)) stack.push(parsed.tag);
  }
  if (!opening) return null;
  let closing = null;
  let summaryDepth = 1;
  let skipUntil = 0;
  for (const token of tokens) {
    if (token.index <= opening.index || token.index < skipUntil) continue;
    const parsed = parseHtmlTag(token[0]);
    if (!parsed) continue;
    if (isProtectedOpening(parsed)) {
      const childStart = token.index + token[0].length;
      const childEnd = protectedHtmlClosingEnd(
        parsed.tag,
        body.slice(childStart),
        parsed.attributes.has("hidden") || ["details", "dialog"].includes(parsed.tag),
      );
      skipUntil = childEnd < 0 ? body.length : childStart + childEnd;
      continue;
    }
    if (parsed.tag === "summary") {
      summaryDepth += parsed.isClosing ? -1 : 1;
      if (summaryDepth === 0) {
        closing = token;
        break;
      }
    }
  }
  if (!closing) return null;
  const contentStart = opening.index + opening[0].length;
  return {
    prefix: body.slice(0, opening.index),
    opening: opening[0],
    content: body.slice(contentStart, closing.index),
    isHidden: parseHtmlTag(opening[0]).attributes.has("hidden"),
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
  const openDetailsGroups = new Set();
  const parentProtectedRanges = hiddenHtmlRanges(tree, source);
  for (const html of htmlTokens(tree)) {
    if (html.start < claimedEnd) continue;
    const parsed = parseHtmlTag(html.value);
    if (!parsed || parsed.isClosing || parentProtectedRanges.some((range) =>
      html.start > range.start && html.start < range.end)) continue;
    const isConditional = ["details", "dialog"].includes(parsed.tag);
    const isVisibleBlockContainer = html.block && !VOID_HTML.has(parsed.tag) &&
      !PROTECTED_HTML_TAGS.has(parsed.tag) && !parsed.attributes.has("hidden");
    if (!isConditional && !isVisibleBlockContainer) continue;
    const tail = source.slice(html.end);
    const closingEnd = protectedHtmlClosingEnd(parsed.tag, tail, true);
    if (closingEnd < 0 && !isVisibleBlockContainer) continue;
    let rangeEnd = closingEnd < 0 ? source.length : html.end + closingEnd;
    const relativeClosingStart = closingEnd < 0 ? tail.length :
      closingTagStart(parsed.tag, tail, closingEnd);
    if (relativeClosingStart < 0) continue;
    let closingStart = html.end + relativeClosingStart;
    if (isVisibleBlockContainer && html.nodeEnd < closingStart) {
      closingStart = html.nodeEnd;
      rangeEnd = html.nodeEnd;
    }
    const body = source.slice(html.end, closingStart);
    const detailsName = parsed.tag === "details" ? parsed.attributes.get("name") : null;
    const isGroupedOpen = parsed.attributes.has("open") && detailsName &&
      !openDetailsGroups.has(detailsName);
    if (parsed.tag === "details" && parsed.attributes.has("open") && detailsName) {
      openDetailsGroups.add(detailsName);
    }
    const isEffectivelyOpen = parsed.attributes.has("open") &&
      (!detailsName || isGroupedOpen);
    let replacement = body;
    if (parsed.attributes.has("hidden")) replacement = body;
    else if (parsed.tag === "details") {
      const summary = summaryParts(body);
      if (summary) {
        replacement = (isEffectivelyOpen ?
          normalizeVisibleRegion(summary.prefix) : summary.prefix) + summary.opening +
          (summary.isHidden ? summary.content : normalizeRawHtmlText(summary.content)) +
          summary.closing + (isEffectivelyOpen && summary.suffix ? "\n" : "") +
          (isEffectivelyOpen ? normalizeVisibleRegion(summary.suffix) : summary.suffix);
      } else if (isEffectivelyOpen) replacement = normalizeVisibleRegion(body);
    } else if (parsed.tag === "dialog") {
      if (isEffectivelyOpen) replacement = normalizeVisibleRegion(body);
    } else replacement = normalizeRawHtmlText(body, parsed.tag);
    edits.push({
      start: html.end,
      end: closingStart,
      replacement,
    });
    if (isVisibleBlockContainer && !isConditional && html.nodeEnd > rangeEnd) {
      edits.push({
        start: rangeEnd,
        end: html.nodeEnd,
        replacement: normalizeRawHtmlText(source.slice(rangeEnd, html.nodeEnd)),
      });
      claimedEnd = html.nodeEnd;
    } else claimedEnd = rangeEnd;
  }
  let normalized = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    normalized = normalized.slice(0, edit.start) + edit.replacement + normalized.slice(edit.end);
  }
  return normalized;
};

const hiddenHtmlRanges = (tree, source) => {
  const ranges = [];
  const openDetailsGroups = new Set();
  for (const html of htmlTokens(tree)) {
    const parsed = parseHtmlTag(html.value);
    if (!parsed) continue;
    if (ranges.some((range) => html.start >= range.start && html.start < range.end)) continue;
    const detailsName = parsed.tag === "details" ? parsed.attributes.get("name") : null;
    const isLaterGroupedOpen = !parsed.isClosing && parsed.attributes.has("open") &&
      detailsName && openDetailsGroups.has(detailsName);
    if (!parsed.isClosing && parsed.attributes.has("open") && detailsName) {
      openDetailsGroups.add(detailsName);
    }
    if (!isProtectedOpening(parsed) && !isLaterGroupedOpen) continue;

    const tail = source.slice(html.end);
    const closingEnd = protectedHtmlClosingEnd(
      parsed.tag,
      tail,
      parsed.attributes.has("hidden") || ["details", "dialog"].includes(parsed.tag),
    );
    let start = html.start;
    if (parsed.tag === "details" && !parsed.attributes.has("hidden")) {
      const closingStart = closingEnd < 0 ? source.length : html.end + closingEnd;
      const summary = summaryParts(source.slice(html.end, closingStart));
      if (summary) {
        if (summary.prefix) ranges.push({ start: html.start, end: html.end + summary.prefix.length });
        start = html.end + summary.bodyStart;
      }
    }
    ranges.push({
      start,
      end: closingEnd >= 0 ? html.end + closingEnd : source.length,
    });
  }
  return ranges;
};

const normalizeVisibleRegion = (source) => {
  if (!source) return source;
  const tree = fromMarkdown(source, {
    extensions: [gfm(), math()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  });
  const ranges = hiddenHtmlRanges(tree, source)
    .sort((a, b) => a.start - b.start)
    .filter((range, index, all) => index === 0 || range.start >= all[index - 1].end);
  if (ranges.length === 0) return normalizeParsedMarkdown(source, true);
  let normalized = "";
  let cursor = 0;
  for (const range of ranges) {
    normalized += normalizeParsedMarkdown(source.slice(cursor, range.start), true);
    normalized += source.slice(range.start, range.end);
    cursor = range.end;
  }
  return normalized + normalizeParsedMarkdown(source.slice(cursor), true);
};

const normalizeRawHtmlText = (source, containerTag = null) => {
  if (!source) return source;
  const tree = fromMarkdown(source, {
    extensions: [gfm(), math()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  });
  const protectedRanges = hiddenHtmlRanges(tree, source);
  const tokens = htmlTokens(tree);
  const visibleCdataTokens = new Set();
  let foreignDepth = ["math", "svg"].includes(containerTag) ? 1 : 0;
  for (const token of tokens) {
    const parsed = parseHtmlTag(token.value);
    if (parsed && ["math", "svg"].includes(parsed.tag)) {
      if (parsed.isClosing) foreignDepth = Math.max(0, foreignDepth - 1);
      else foreignDepth += 1;
    } else if (foreignDepth > 0 && /^<!\[CDATA\[/i.test(token.value)) {
      visibleCdataTokens.add(token.start);
    }
  }
  const isProtected = (offset) => protectedRanges.some((range) =>
    offset >= range.start && offset < range.end);
  const isMarkup = (offset) => tokens.some((token) =>
    !visibleCdataTokens.has(token.start) && offset >= token.start && offset < token.end);
  const edits = [...source.matchAll(/[ \t]*\n[ \t]*/g)]
    .filter((match) => {
      const newline = match.index + match[0].indexOf("\n");
      return !isProtected(newline) && !isMarkup(newline);
    })
    .map((match) => ({ start: match.index, end: match.index + match[0].length, value: " " }));
  const openBlockTags = new Map();
  let tableDepth = containerTag === "table" ? 1 : 0;
  for (const token of tokens) {
    const parsed = parseHtmlTag(token.value);
    if (!parsed || isProtected(token.start) || parsed.attributes.has("hidden")) continue;
    const depth = openBlockTags.get(parsed.tag) ?? 0;
    const isActiveClosing = !parsed.isClosing || parsed.tag === "p" || depth > 0;
    const isActiveTableBoundary = tableDepth > 0 && ["td", "th", "tr"].includes(parsed.tag);
    if (parsed.tag === "br" || isActiveTableBoundary ||
        (RENDERED_BLOCK_HTML.has(parsed.tag) && isActiveClosing)) {
      edits.push({ start: token.start, end: token.start, value: "\n" });
      edits.push({ start: token.end, end: token.end, value: "\n" });
    }
    if (RENDERED_BLOCK_HTML.has(parsed.tag) && parsed.tag !== "p") {
      if (parsed.isClosing) openBlockTags.set(parsed.tag, Math.max(0, depth - 1));
      else if (!VOID_HTML.has(parsed.tag)) openBlockTags.set(parsed.tag, depth + 1);
    }
    if (parsed.tag === "table") tableDepth += parsed.isClosing ? -1 : 1;
    tableDepth = Math.max(0, tableDepth);
  }
  let normalized = source;
  for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) {
    normalized = normalized.slice(0, edit.start) + edit.value + normalized.slice(edit.end);
  }
  return normalized;
};

const normalizeForeignCdata = (source) => source.replace(
  /<(svg|math)(?=[\t\n\f\r />])(?:"[^"]*"|'[^']*'|[^>])*?>[\s\S]*?<\/\1\s*>/gi,
  (foreign) => foreign.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, (section, content) =>
    section.replace(content, content.replace(/[ \t]*\n[ \t]*/g, " "))),
);

const normalizeParsedMarkdown = (source, normalizeDetails = true) => {
  if (source === "") return source;
  const foreignNormalized = normalizeForeignCdata(source);
  if (foreignNormalized !== source) return normalizeParsedMarkdown(foreignNormalized, normalizeDetails);
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
