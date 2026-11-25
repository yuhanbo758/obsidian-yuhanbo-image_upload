import { requestUrl } from "obsidian";
import imageAutoUploadPlugin from "./main";
import type { PicListImage } from "./types";

export class PicGoDeleter {
  plugin: imageAutoUploadPlugin;

  constructor(plugin: imageAutoUploadPlugin) {
    this.plugin = plugin;
  }

  async deleteImage(configMap: PicListImage[]): Promise<{ success?: boolean }> {
    const response = await requestUrl({
      url: this.plugin.settings.deleteServer,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        list: configMap,
      }),
    });
    return response.json as { success?: boolean };
  }
}
