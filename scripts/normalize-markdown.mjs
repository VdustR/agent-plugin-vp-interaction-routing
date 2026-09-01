const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]+|$)/;
const BLOCK_QUOTE = /^ {0,3}>/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_ITEM = /^ {0,3}(?:[*+-]|\d{1,9}[.)])[ \t]+/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DELIMITER = /^ {0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/;

const isFrontmatterDelimiter = (line) => /^ {0,3}(?:---|\.\.\.)[ \t]*$/.test(line);

const fenceMarker = (line) => {
  const match = line.match(FENCE);
  return match && { character: match[1][0], length: match[1].length };
};

const closesFence = (line, fence) => {
  const marker = fenceMarker(line);
  return marker && marker.character === fence.character && marker.length >= fence.length;
};

const isStandaloneBlock = (line) =>
  line.trim() === "" ||
  ATX_HEADING.test(line) ||
  TABLE_ROW.test(line) ||
  THEMATIC_BREAK.test(line);

/**
 * Join Markdown soft-wrapped prose while retaining a newline between blocks.
 *
 * The invariant regexes intentionally use the absence of `s` as their block
 * boundary. This normalizer therefore joins only paragraph and list-item
 * continuation lines. Markdown constructs that establish their own block keep
 * a physical newline in the result.
 */
export const normalizeMarkdownForInvariant = (text) => {
  const source = text.replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  const normalized = [];
  let fence = null;
  let frontmatter = lines[0] === "---";
  let inTable = false;
  let quoteJoinable = false;
  let joinable = false;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const trimmed = raw.trim();

    if (frontmatter) {
      normalized.push(trimmed);
      joinable = false;
      if (index > 0 && isFrontmatterDelimiter(raw)) frontmatter = false;
      continue;
    }

    if (fence) {
      normalized.push(trimmed);
      joinable = false;
      if (closesFence(raw, fence)) fence = null;
      continue;
    }

    if (!BLOCK_QUOTE.test(raw)) quoteJoinable = false;

    if (inTable) {
      if (/(?:^|[^\\])\|/.test(raw)) {
        normalized.push(trimmed);
        joinable = false;
        continue;
      }
      inTable = false;
    }

    const openingFence = fenceMarker(raw);
    if (openingFence) {
      normalized.push(trimmed);
      fence = openingFence;
      joinable = false;
      continue;
    }

    if (BLOCK_QUOTE.test(raw)) {
      const hasContent = !/^ {0,3}>[ \t]*$/.test(raw);
      if (quoteJoinable && hasContent) normalized[normalized.length - 1] += ` ${trimmed}`;
      else normalized.push(trimmed);
      quoteJoinable = hasContent;
      joinable = false;
      continue;
    }

    const next = lines[index + 1];
    if (next !== undefined && TABLE_DELIMITER.test(next)) {
      normalized.push(trimmed);
      normalized.push(next.trim());
      index += 1;
      inTable = true;
      joinable = false;
      continue;
    }
    const startsSetextHeading = next !== undefined && SETEXT_UNDERLINE.test(next);
    if (startsSetextHeading) {
      normalized.push(trimmed);
      normalized.push(next.trim());
      index += 1;
      joinable = false;
      continue;
    }

    if (isStandaloneBlock(raw)) {
      normalized.push(trimmed);
      joinable = false;
      continue;
    }

    if (LIST_ITEM.test(raw)) {
      normalized.push(trimmed);
      joinable = true;
      continue;
    }

    if (joinable) normalized[normalized.length - 1] += ` ${trimmed}`;
    else normalized.push(trimmed);
    joinable = true;
  }

  return normalized.join("\n");
};
