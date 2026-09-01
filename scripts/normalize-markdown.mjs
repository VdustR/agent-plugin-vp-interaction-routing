import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

const NORMALIZABLE_BLOCKS = new Set(["heading", "paragraph"]);
const OPAQUE_BLOCKS = new Set(["code", "html", "table"]);
const FRONTMATTER_DELIMITER = /^---[ \t]*$/;
const BLOCK_SEPARATOR = "\n\0\n";

const splitFrontmatter = (source) => {
  const lines = source.split("\n");
  if (!FRONTMATTER_DELIMITER.test(lines[0]?.replace(/^\uFEFF/, ""))) {
    return { frontmatter: null, markdown: source };
  }

  const closingIndex = lines.findIndex((line, index) =>
    index > 0 && FRONTMATTER_DELIMITER.test(line));
  if (closingIndex < 0) return { frontmatter: null, markdown: source };

  return {
    frontmatter: lines.slice(0, closingIndex + 1).join("\n"),
    markdown: lines.slice(closingIndex + 1).join("\n"),
  };
};

const renderedText = (node) => {
  switch (node.type) {
    case "text":
      return node.value.replace(/\n/g, " ");
    case "inlineCode":
      return `\`${node.value.replace(/\n/g, " ")}\``;
    case "break":
      return "\n";
    case "html":
      return /^<br(?:\s[^>]*)?\s*\/?>$/i.test(node.value.trim()) ? "\n" : "";
    case "image":
    case "imageReference":
      return (node.alt ?? "").replace(/\n/g, " ");
    default:
      return (node.children ?? []).map(renderedText).join("");
  }
};

const collectBlocks = (node, blocks = []) => {
  if (node.type === "footnoteDefinition") return blocks;
  if (NORMALIZABLE_BLOCKS.has(node.type) || OPAQUE_BLOCKS.has(node.type)) {
    blocks.push(node);
    return blocks;
  }
  for (const child of node.children ?? []) collectBlocks(child, blocks);
  return blocks;
};

/**
 * Convert each Markdown prose block to one searchable line while retaining a
 * newline between blocks. Raw HTML remains opaque: invariant matching is about
 * Markdown prose, not browser rendering or HTML visibility rules.
 */
export const normalizeMarkdownForInvariant = (text) => {
  const source = text.replace(/\r\n?/g, "\n");
  const { frontmatter, markdown } = splitFrontmatter(source);
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const blocks = collectBlocks(tree).map((block) => {
    if (OPAQUE_BLOCKS.has(block.type)) {
      return markdown.slice(block.position.start.offset, block.position.end.offset);
    }
    return renderedText(block).trim();
  });

  return [frontmatter, ...blocks].filter((block) => block !== null).join(BLOCK_SEPARATOR);
};
