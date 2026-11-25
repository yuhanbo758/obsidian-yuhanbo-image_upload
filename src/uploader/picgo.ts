import { join, extname } from "path-browserify";
import { requestUrl, normalizePath, FileSystemAdapter } from "obsidian";

import { payloadGenerator } from "../payloadGenerator";

import type imageAutoUploadPlugin from "../main";
import type { Image, PicListImage } from "../types";
import type { Response, Uploader } from "./types";
import type { PluginSettings } from "../setting";

interface PicGoResponse {
  success?: boolean;
  message?: string;
  msg?: string;
  result: string[] | string;
  fullResult?: PicListImage[];
}

export default class PicGoUploader implements Uploader {
  settings: PluginSettings;
  plugin: imageAutoUploadPlugin;

  constructor(plugin: imageAutoUploadPlugin) {
    this.settings = plugin.settings;
    this.plugin = plugin;
  }

  private async uploadFiles(fileList: Array<Image | string>) {
    let response: Awaited<ReturnType<typeof requestUrl>>;

    if (this.settings.remoteServerMode) {
      const files: File[] = [];
      for (const image of fileList) {
        if (typeof image === "string" || !image.file) continue;
        const arrayBuffer = await this.plugin.app.vault.adapter.readBinary(
          image.file.path
        );
        files.push(
          new File([arrayBuffer], Date.now() + extname(image.file.path))
        );
      }
      response = await this.uploadFileByData(files);
    } else {
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

      response = await requestUrl({
        url: this.settings.uploadServer,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list: list }),
      });
    }

    return this.handleResponse(response);
  }

  private async uploadFileByData(fileList: FileList | File[]) {
    const payload_data: {
      [key: string]: (string | Blob | ArrayBuffer | File)[];
    } = {
      list: [],
    };

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      payload_data["list"].push(file);
    }

    const [request_body, boundary_string] = await payloadGenerator(
      payload_data
    );

    const options = {
      method: "POST",
      url: this.settings.uploadServer,
      contentType: `multipart/form-data; boundary=----${boundary_string}`,
      body: request_body,
    };
    const response = await requestUrl(options);

    return response;
  }

  async uploadDroppedFiles(files: File[]): Promise<Response> {
    // 远程上传直接使用拖入的文件对象，无需按外部路径重新读取。
    return this.handleResponse(await this.uploadFileByData(files));
  }

  private async uploadFileByClipboard(fileList?: FileList): Promise<Response> {
    let res: Awaited<ReturnType<typeof requestUrl>>;

    if (this.settings.remoteServerMode) {
      const files = [];
      for (let i = 0; i < fileList.length; i++) {
        const timestamp = new Date().getTime();

        const file = fileList[i];
        const arrayBuffer = await file.arrayBuffer();
        files.push(new File([arrayBuffer], timestamp + ".png"));
      }
      res = await this.uploadFileByData(files);
    } else {
      res = await requestUrl({
        url: this.settings.uploadServer,
        method: "POST",
      });
    }
    return this.handleResponse(res);
  }

  /**
   * 处理返回值
   */
  private async handleResponse(
    response: Awaited<ReturnType<typeof requestUrl>>
  ): Promise<Response> {
    const data = response.json as PicGoResponse;

    if (response.status !== 200) {
      return {
        success: false,
        msg: data.msg || data.message,
        result: [],
      };
    }
    if (data.success === false) {
      return {
        success: false,
        msg: data.msg || data.message,
        result: [],
      };
    }

    // piclist
    if (data.fullResult) {
      const uploadUrlFullResultList = data.fullResult || [];
      this.settings.uploadedImages = [
        ...(this.settings.uploadedImages || []),
        ...uploadUrlFullResultList,
      ];
      await this.plugin.saveSettings();
    }

    return {
      success: true,
      msg: "success",
      result: typeof data.result == "string" ? [data.result] : data.result,
    };
  }

  async upload(fileList: Array<Image> | Array<string>) {
    return this.uploadFiles(fileList);
  }
  async uploadByClipboard(fileList?: FileList) {
    return this.uploadFileByClipboard(fileList);
  }
}
