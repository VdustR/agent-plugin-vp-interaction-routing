const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]+|$)/;
const BLOCK_QUOTE = /^ {0,3}>/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_ITEM = /^\s*(?:[*+-]|\d{1,9}[.)])[ \t]+/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DELIMITER = /^ {0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/;
const INDENTED_CODE = /^(?: {4}|\t)/;

const isFrontmatterDelimiter = (line) => /^(?:---|\.\.\.)[ \t]*$/.test(line);

const fenceMarker = (line) => {
  const match = line.match(FENCE);
  return match && { character: match[1][0], length: match[1].length };
};

const closesFence = (line, fence) => {
  const indent = line.match(/^ */)[0].length;
  const trimmed = line.trim();
  return indent <= 3 && trimmed.length >= fence.length &&
    [...trimmed].every((character) => character === fence.character);
};

const isStandaloneBlock = (line) =>
  line.trim() === "" ||
  ATX_HEADING.test(line) ||
  TABLE_ROW.test(line) ||
  INDENTED_CODE.test(line) ||
  THEMATIC_BREAK.test(line);

/**
 * Join Markdown soft-wrapped prose while retaining a newline between blocks.
 *
 * The invariant regexes intentionally use the absence of `s` as their block
 * boundary. This normalizer therefore joins only paragraph and list-item
 * continuation lines. Markdown constructs that establish their own block keep
 * a physical newline in the result.
 */
const normalizeMarkdown = (text, allowFrontmatter) => {
  const source = text.replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  const normalized = [];
  let fence = null;
  let frontmatter = allowFrontmatter && lines[0] === "---";
  let inTable = false;
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
      const quoted = [];
      let cursor = index;
      while (cursor < lines.length && BLOCK_QUOTE.test(lines[cursor])) {
        quoted.push(lines[cursor].replace(/^ {0,3}>[ \t]?/, ""));
        cursor += 1;
      }
      const inner = normalizeMarkdown(quoted.join("\n"), false);
      normalized.push(inner.split("\n").map((line) => `> ${line}`.trimEnd()).join("\n"));
      index = cursor - 1;
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
      if (joinable) normalized[normalized.length - 1] += ` ${trimmed}`;
      else normalized.push(trimmed);
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

export const normalizeMarkdownForInvariant = (text) => normalizeMarkdown(text, true);
