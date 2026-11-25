import { join } from "path-browserify";
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";

import { getLastImage } from "../utils";
import { normalizePath, FileSystemAdapter } from "obsidian";

import type imageAutoUploadPlugin from "../main";
import type { Image } from "../types";
import type { PluginSettings } from "../setting";
import type { Uploader } from "./types";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export default class PicGoCoreUploader implements Uploader {
  settings: PluginSettings;
  plugin: imageAutoUploadPlugin;

  constructor(plugin: imageAutoUploadPlugin) {
    this.settings = plugin.settings;
    this.plugin = plugin;
  }

  private async uploadFiles(fileList: Array<Image> | Array<string>) {
    const basePath = (
      this.plugin.app.vault.adapter as FileSystemAdapter
    ).getBasePath();

    const list = fileList.map(item => {
      if (typeof item === "string") {
        return item;
      } else {
        return normalizePath(join(basePath, item.path));
      }
    });

    const length = list.length;
    const res = await this.runUpload(list);
    const splitList = res.split("\n");
    const splitListLength = splitList.length;

    const data = splitList.splice(splitListLength - 1 - length, length);

    if (res.includes("PicGo ERROR")) {
      return {
        success: false,
        msg: "失败",
        result: [] as string[],
      };
    } else {
      return {
        success: true,
        result: data,
      };
    }
  }

  // PicGo-Core 上传处理
  private async uploadFileByClipboard() {
    const res = await this.runUpload([]);
    const splitList = res.split("\n");
    const lastImage = getLastImage(splitList);

    if (lastImage) {
      return {
        success: true,
        msg: "success",
        result: [lastImage],
      };
    } else {
      return {
        success: false,
        msg: `"Please check PicGo-Core config"\n${res}`,
        result: [],
      };
    }
  }

  private async runUpload(paths: string[]) {
    const cli =
      (this.settings.picgoCorePath || "").trim().replace(/^"(.*)"$/, "$1") ||
      "picgo";
    const args = ["upload", ...paths];
    const options = { encoding: "utf8" as const, windowsHide: true };
    const windowsShim =
      process.platform === "win32" &&
      (cli.toLowerCase() === "picgo" || /\.(?:cmd|bat)$/i.test(cli));

    // npm 在 Windows 上的命令包装器需要 cmd.exe，其余可执行文件直接传递参数。
    if (!windowsShim) {
      const { stdout } = await execFileAsync(cli, args, options);
      return stdout;
    }

    const parts = [cli, ...args];
    if (parts.some(part => /["%!\r\n\x00]/.test(part))) {
      throw new Error("PicGo-Core command wrapper cannot safely process this path");
    }
    const command = parts.map(part => `"${part}"`).join(" ");
    const { stdout } = await execAsync(command, options);
    return stdout;
  }

  async upload(fileList: Array<Image> | Array<string>) {
    return this.uploadFiles(fileList);
  }
  async uploadByClipboard() {
    return this.uploadFileByClipboard();
  }
}
