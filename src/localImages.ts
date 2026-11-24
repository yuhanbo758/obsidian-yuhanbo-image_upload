import { parseLinktext } from "obsidian";
import type { App, TFile } from "obsidian";
import { isAssetTypeAnImage } from "./utils";

export interface LocalImageReference {
  file: TFile;
  name: string;
  source: string;
  start: number;
  end: number;
}

export function getLocalImageReferences(
  { metadataCache }: App,
  note: TFile,
  content: string,
  imageFiles?: ReadonlySet<TFile>
): LocalImageReference[] | null {
  const cache = metadataCache.getFileCache(note);
  if (!cache) return null;

  // 索引偏移包含磁盘上的 CRLF，编辑器统一使用 LF。用行列换算到当前文本。
  const lineStarts = [0];
  for (const newline of content.matchAll(/\n/g)) lineStarts.push(newline.index + 1);

  const references: LocalImageReference[] = [];
  for (const embed of cache.embeds ?? []) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(embed.link)) continue;

    // 以 Obsidian 的解析结果为准，避免把同名附件、代码块或网络链接当作目标。
    const { path } = parseLinktext(embed.link);
    const file = metadataCache.getFirstLinkpathDest(path, note.path);
    if (!file || (imageFiles && !imageFiles.has(file)) || !isAssetTypeAnImage(file.path)) continue;

    const { start: from, end: to } = embed.position;
    const start = lineStarts[from.line] + from.col;
    const end = lineStarts[to.line] + to.col;
    if (content.slice(start, end) !== embed.original) return null;

    const name = embed.original.startsWith("![[")
      ? file.basename + (embed.displayText && embed.displayText !== embed.link
          ? "|" + embed.displayText
          : "")
      : embed.displayText ?? "";
    references.push({ file, name, source: embed.original, start, end });
  }
  return references.sort((first, second) => first.start - second.start);
}

export function getRelatedNotePaths(
  { metadataCache }: App,
  originPath: string,
  imagePaths: ReadonlySet<string>
): string[] {
  // 用原生解析索引缩小读取范围。实际换链仍只处理解析到同一附件的图片嵌入。
  return Object.entries(metadataCache.resolvedLinks)
    .filter(([path, links]) =>
      path !== originPath && Object.keys(links).some(link => imagePaths.has(link))
    )
    .map(([path]) => path);
}

export function getUploadedUrl(result: unknown): string | undefined {
  if (!Array.isArray(result) || result.length !== 1 || typeof result[0] !== "string") {
    return;
  }
  const value = result[0].trim();
  try {
    const url = new URL(value);
    if (url.hostname && /^https?:\/\//i.test(value)) {
      // Markdown 目标里的括号和空格需要编码，签名参数等已有编码保持原样。
      return value.replace(/[()<>\s]/g, character => encodeURIComponent(character)
        .replace("(", "%28").replace(")", "%29"));
    }
  } catch {
    return;
  }
}

export function formatUploadedImage(
  reference: LocalImageReference,
  name: string,
  url: string
): string {
  const alt = name.replace(/\\?([\[\]])/g, "\\$1");
  const title = reference.source.startsWith("![[")
    ? ""
    : reference.source.match(/(\s+(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\((?:[^)\\]|\\.)*\)))\)$/)?.[1] ?? "";
  return "![" + alt + "](" + url + title + ")";
}
