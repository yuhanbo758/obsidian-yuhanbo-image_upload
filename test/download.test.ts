import { describe, expect, it, vi } from "vitest";
import { requestUrl } from "obsidian";
import { downloadAllImageFiles } from "../src/download";
import type ImageUploadPlugin from "../src/main";

vi.mock("obsidian", () => ({
  normalizePath: (path: string) => path,
  Notice: class {},
  requestUrl: vi.fn(),
}));

vi.mock("../src/lang/helpers", () => ({ t: (key: string) => key }));

describe("downloadAllImageFiles", () => {
  it.each([
    ["/", "下载附件/photo.png"],
    ["项目/子目录", "../../下载附件/photo.png"],
  ])("writes vault-relative links from %s", async (parent, expectedPath) => {
    const url = "https://example.com/photo.png";
    const original = `![photo](${url})`;
    const png = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jptcAAAAASUVORK5CYII=",
        "base64"
      )
    ).buffer;
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      arrayBuffer: png,
      headers: {},
      json: null,
      text: "",
    });
    const writeBinary = vi.fn().mockResolvedValue(undefined);
    const setValue = vi.fn();
    const plugin = {
      app: {
        workspace: {
          getActiveFile: () => ({ path: "笔记.md", parent: { path: parent } }),
        },
        fileManager: { getAvailablePathForAttachment: async () => "下载附件" },
        vault: {
          adapter: {
            exists: async (path: string) => path === "下载附件",
            writeBinary,
          },
        },
      },
      helper: {
        getAllFiles: () => [{ path: url, source: original }],
        getValue: () => original,
        setValue,
      },
      handleName: (name: string) => name,
    };

    await downloadAllImageFiles(plugin as unknown as ImageUploadPlugin);

    expect(writeBinary).toHaveBeenCalledWith("下载附件/photo.png", png);
    expect(setValue).toHaveBeenCalledWith(`![photo](${encodeURI(expectedPath)})`);
  });
});
