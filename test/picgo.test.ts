import { expect, it, vi } from "vitest";
import { requestUrl } from "obsidian";
import PicGoUploader from "../src/uploader/picgo";
import type ImageUploadPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/setting";

vi.mock("obsidian", () => ({
  requestUrl: vi.fn(),
  getBlobArrayBuffer: (blob: Blob) => blob.arrayBuffer(),
  PluginSettingTab: class {},
}));
vi.mock("../src/lang/helpers", () => ({ t: (key: string) => key }));

it("uploads dropped image bytes through the remote endpoint", async () => {
  const uploader = new PicGoUploader({
    settings: { ...DEFAULT_SETTINGS, remoteServerMode: true },
  } as unknown as ImageUploadPlugin);
  const url = "https://example.com/photo.png";
  vi.mocked(requestUrl).mockResolvedValue({
    status: 200,
    json: { success: true, result: [url] },
    arrayBuffer: new ArrayBuffer(0),
    headers: {},
    text: "",
  });

  const response = await uploader.uploadDroppedFiles([
    new File(["image fixture"], "photo.png", { type: "image/png" }),
  ]);

  const request = vi.mocked(requestUrl).mock.calls[0][0];
  if (typeof request === "string" || !(request.body instanceof ArrayBuffer)) {
    throw new Error("Expected a multipart upload request");
  }
  expect(request.contentType).toMatch(/^multipart\/form-data; boundary=/);
  const body = new TextDecoder().decode(request.body);
  expect(body).toContain('name="list"; filename="photo.png"');
  expect(body).toContain("image fixture");
  expect(response).toMatchObject({ success: true, result: [url] });
});
