import { describe, expect, it, vi } from "vitest";
import type { App, EmbedCache, TFile } from "obsidian";
import { formatUploadedImage, getLocalImageReferences, getRelatedNotePaths, getUploadedUrl } from "../src/localImages";

function embed(link: string, original: string, line: number, col = 0, displayText?: string): EmbedCache {
  return {
    link,
    original,
    displayText,
    position: {
      start: { line, col, offset: 0 },
      end: { line, col: col + original.length, offset: 0 },
    },
  };
}

function fixture(embeds: EmbedCache[]) {
  const note = { path: "Notes/example.md" } as TFile;
  const first = { path: "A/同名 图片.png", basename: "同名 图片" } as TFile;
  const second = { path: "B/同名 图片.png", basename: "同名 图片" } as TFile;
  const getFirstLinkpathDest = vi.fn((link: string) => {
    if (link === "../A/同名 图片.png") return first;
    if (link === "B/同名 图片.png") return second;
    return null;
  });
  const app = { metadataCache: {
    getFileCache: () => ({ embeds }),
    getFirstLinkpathDest,
  } } as unknown as App;

  return { app, note, first, second, getFirstLinkpathDest };
}

describe("getLocalImageReferences", () => {
  it("resolves the exact local attachment and ignores network links and code", () => {
    const remote = "![old](https://example.org/old.png)";
    const local = '![alt](<../A/同名 图片.png> "title")';
    const wiki = "![[B/同名 图片.png|80]]";
    const content = [remote + local, "    " + wiki, wiki].join("\r\n");
    const { app, note, first, second, getFirstLinkpathDest } = fixture([
      embed("https://example.org/old.png", remote, 0),
      embed("../A/同名 图片.png", local, 0, remote.length, "alt"),
      embed("B/同名 图片.png", wiki, 2, 0, "80"),
    ]);

    const refs = getLocalImageReferences(app, note, content);
    expect(refs.map(ref => ref.file)).toEqual([first, second]);
    expect(refs.map(ref => content.slice(ref.start, ref.end))).toEqual([local, wiki]);
    expect(refs[1].start).toBe(content.lastIndexOf(wiki));
    expect(getFirstLinkpathDest).toHaveBeenCalledTimes(2);
    expect(getFirstLinkpathDest).toHaveBeenCalledWith("../A/同名 图片.png", note.path);
    expect(formatUploadedImage(refs[0], refs[0].name, "https://example.org/image.png"))
      .toBe('![alt](https://example.org/image.png "title")');
    expect(formatUploadedImage(refs[1], refs[1].name, "https://example.org/wiki.png"))
      .toBe("![同名 图片|80](https://example.org/wiki.png)");
  });

  it("does not apply stale link positions", () => {
    const original = "![[B/同名 图片.png]]";
    const { app, note } = fixture([embed("B/同名 图片.png", original, 0)]);
    expect(getLocalImageReferences(app, note, "new line\n" + original)).toBeNull();
  });

  it("ignores missing attachments and leaves network-only notes alone", () => {
    const remote = "![old](https://example.org/old.png)";
    const missing = "![[missing.png]]";
    const { app, note } = fixture([
      embed("https://example.org/old.png", remote, 0),
      embed("missing.png", missing, 1),
    ]);
    expect(getLocalImageReferences(app, note, remote + "\n" + missing)).toEqual([]);
  });
});

describe("getUploadedUrl", () => {
  it("accepts exactly one HTTP image URL and escapes Markdown delimiters", () => {
    expect(getUploadedUrl(["https://host.test/file (1).png?q=%2F"]))
      .toBe("https://host.test/file%20%281%29.png?q=%2F");
    for (const invalid of [undefined, [], ["file:///a.png"], ["https:foo"], ["bad"], ["https://host.test/a.png", "https://host.test/b.png"]]) {
      expect(getUploadedUrl(invalid)).toBeUndefined();
    }
  });
});

describe("cross-note references", () => {
  it("selects indexed notes by exact attachment path and excludes the origin", () => {
    const app = { metadataCache: { resolvedLinks: {
      "A.md": { "first/a.png": 1, "B.md": 1 },
      "B.md": { "first/a.png": 2 },
      "C.md": { "first/b.png": 1 },
      "D.md": { "second/a.png": 1 },
      "E.md": { "https://example.org/a.png": 1 },
    } } } as unknown as App;

    expect(getRelatedNotePaths(app, "A.md", new Set(["first/a.png", "first/b.png"])))
      .toEqual(["B.md", "C.md"]);
  });

  it("updates only the selected local attachment even if another image index is stale", () => {
    const target = "![[B/同名 图片.png|80]]";
    const unrelated = "![[../A/同名 图片.png]]";
    const { app, note, second } = fixture([
      embed("B/同名 图片.png", target, 0, 0, "80"),
      embed("../A/同名 图片.png", unrelated, 1),
    ]);
    const content = target + "\nAn unrelated edit.\n" + unrelated;

    const refs = getLocalImageReferences(app, note, content, new Set([second]));
    expect(refs?.map(ref => ref.file)).toEqual([second]);
    expect(refs?.map(ref => ref.source)).toEqual([target]);
  });
});
