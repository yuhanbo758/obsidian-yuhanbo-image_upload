import { Platform, Notice } from "obsidian";
import { webUtils } from "electron";

import PicGoUploader from "./picgo";
import PicGoCoreUploader from "./picgoCore";

import type ImageAutoUploadPlugin from "../main";
import type { Image } from "../types";

export function getUploader(uploader: string) {
  switch (uploader) {
    case "PicGo":
      return PicGoUploader;
    case "PicGo-Core":
      return PicGoCoreUploader;
    default:
      throw new Error("Invalid uploader");
  }
}

export class UploaderManager {
  uploader: PicGoUploader | PicGoCoreUploader;
  plugin: ImageAutoUploadPlugin;

  constructor(uploader: string, plugin: ImageAutoUploadPlugin) {
    this.plugin = plugin;
    const Uploader = getUploader(uploader);
    this.uploader = new Uploader(this.plugin);
  }

  async upload(fileList: Array<string> | Array<Image>) {
    if (Platform.isMobileApp && !this.plugin.settings.remoteServerMode) {
      new Notice("Mobile App must use remote server mode.");
      throw new Error("Mobile App must use remote server mode.");
    }

    const res = await this.uploader.upload(fileList);
    if (!res.success) {
      new Notice(res.msg || "Upload Failed");
      throw new Error(res.msg || "Upload Failed");
    }

    return res;
  }

  async uploadDroppedFiles(files: File[]) {
    if (
      this.plugin.settings.remoteServerMode &&
      this.uploader instanceof PicGoUploader
    ) {
      return this.uploader.uploadDroppedFiles(files);
    }

    const paths = files.map(file => file.path || webUtils?.getPathForFile(file));
    if (paths.some(path => !path)) {
      throw new Error("Could not resolve a dropped image path");
    }
    return this.upload(paths);
  }
  async uploadByClipboard(fileList?: FileList) {
    if (Platform.isMobileApp && !this.plugin.settings.remoteServerMode) {
      new Notice("Mobile App must use remote server mode.");
      throw new Error("Mobile App must use remote server mode.");
    }

    const res = await this.uploader.uploadByClipboard(fileList);
    if (!res.success) {
      new Notice(res.msg || "Upload Failed");
      throw new Error(res.msg || "Upload Failed");
    }

    return res;
  }
}

export type Uploader = PicGoUploader | PicGoCoreUploader;
export { PicGoUploader, PicGoCoreUploader };
