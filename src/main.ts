import {
  MarkdownView,
  Plugin,
  Editor,
  Menu,
  MenuItem,
  TFile,
  Notice,
  addIcon,
  MarkdownFileInfo,
} from "obsidian";

import { isAssetTypeAnImage } from "./utils";
import { formatUploadedImage, getLocalImageReferences, getUploadedUrl } from "./localImages";
import type { LocalImageReference } from "./localImages";
import { downloadAllImageFiles } from "./download";
import { UploaderManager } from "./uploader/index";
import { PicGoDeleter } from "./deleter";
import Helper from "./helper";
import { t } from "./lang/helpers";
import { SettingTab, PluginSettings, DEFAULT_SETTINGS } from "./setting";

import type { Image } from "./types";

export default class imageAutoUploadPlugin extends Plugin {
  settings: PluginSettings;
  helper: Helper;
  editor: Editor;
  picGoDeleter: PicGoDeleter;
  private readonly uploadsInProgress = new WeakSet<TFile>();

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {}

  async onload() {
    await this.loadSettings();

    this.helper = new Helper(this.app);
    this.picGoDeleter = new PicGoDeleter(this);

    addIcon(
      "upload",
      `<svg t="1636630783429" class="icon" viewBox="0 0 100 100" version="1.1" p-id="4649" xmlns="http://www.w3.org/2000/svg">
      <path d="M 71.638 35.336 L 79.408 35.336 C 83.7 35.336 87.178 38.662 87.178 42.765 L 87.178 84.864 C 87.178 88.969 83.7 92.295 79.408 92.295 L 17.249 92.295 C 12.957 92.295 9.479 88.969 9.479 84.864 L 9.479 42.765 C 9.479 38.662 12.957 35.336 17.249 35.336 L 25.019 35.336 L 25.019 42.765 L 17.249 42.765 L 17.249 84.864 L 79.408 84.864 L 79.408 42.765 L 71.638 42.765 L 71.638 35.336 Z M 49.014 10.179 L 67.326 27.688 L 61.835 32.942 L 52.849 24.352 L 52.849 59.731 L 45.078 59.731 L 45.078 24.455 L 36.194 32.947 L 30.702 27.692 L 49.012 10.181 Z" p-id="4650" fill="#8a8a8a"></path>
    </svg>`
    );

    this.addSettingTab(new SettingTab(this.app, this));

    this.addCommand({
      id: "Upload all images",
      name: "Upload all images",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file) {
          if (!checking) {
            void this.uploadNoteImages(view, view.file);
          }
          return true;
        }
        return false;
      },
    });
    this.addCommand({
      id: "Download all images",
      name: "Download all images",
      checkCallback: (checking: boolean) => {
        let leaf = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (leaf) {
          if (!checking) {
            downloadAllImageFiles(this);
          }
          return true;
        }
        return false;
      },
    });
    this.setupPasteHandler();
    this.registerFileMenu();
    this.registerSelection();
  }

  /**
   * 获取当前使用的上传器
   */
  getUploader() {
    const uploader = new UploaderManager(this.settings.uploader, this);

    return uploader;
  }

  /**
   * 上传图片
   */
  upload(images: Image[] | string[]) {
    let uploader = this.getUploader();
    return uploader.upload(images);
  }

  /**
   * 通过剪贴板上传图片
   */
  uploadByClipboard(fileList?: FileList) {
    let uploader = this.getUploader();
    return uploader.uploadByClipboard(fileList);
  }

  registerSelection() {
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
          if (this.app.workspace.getLeavesOfType("markdown").length === 0) {
            return;
          }
          if (info instanceof MarkdownView && info.file) {
            const content = editor.getValue();
            const offset = editor.posToOffset(editor.getCursor());
            const reference = getLocalImageReferences(this.app, info.file, content)
              ?.find(ref => ref.start <= offset && offset < ref.end);
            if (reference) this.addUploadMenu(menu, info, reference.file);
          }
          const selection = editor.getSelection();
          if (selection) {
            const markdownRegex = /!\[.*\]\((.*)\)/g;
            const markdownMatch = markdownRegex.exec(selection);
            if (markdownMatch && markdownMatch.length > 1) {
              const markdownUrl = markdownMatch[1];
              if (
                this.settings.uploadedImages?.find(
                  (item: { imgUrl: string }) => item.imgUrl === markdownUrl
                )
              ) {
                this.addRemoveMenu(menu, markdownUrl, editor);
              }
            }
          }
        }
      )
    );
  }

  addRemoveMenu = (menu: Menu, imgPath: string, editor: Editor) => {
    menu.addItem((item: MenuItem) =>
      item
        .setIcon("trash-2")
        .setTitle(t("Delete image using PicList"))
        .onClick(async () => {
          try {
            const selectedItem = this.settings.uploadedImages?.find(
              (item: { imgUrl: string }) => item.imgUrl === imgPath
            );
            if (selectedItem) {
              const res = await this.picGoDeleter.deleteImage([selectedItem]);
              if (res.success) {
                new Notice(t("Delete successfully"));
                const selection = editor.getSelection();
                if (selection) {
                  editor.replaceSelection("");
                }
                this.settings.uploadedImages =
                  this.settings.uploadedImages.filter(
                    (item: { imgUrl: string }) => item.imgUrl !== imgPath
                  );
                this.saveSettings();
              } else {
                new Notice(t("Delete failed"));
              }
            }
          } catch {
            new Notice(t("Error, could not delete"));
          }
        })
    );
  };

  registerFileMenu() {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
        if (
          source === "canvas-menu" ||
          !(file instanceof TFile) ||
          !isAssetTypeAnImage(file.path)
        ) return;

        const view = leaf?.view instanceof MarkdownView
          ? leaf.view
          : this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file) this.addUploadMenu(menu, view, file);
      })
    );
  }

  private addUploadMenu(menu: Menu, view: MarkdownView, file: TFile) {
    const note = view.file;
    if (!note) return;

    menu.addItem(item =>
      item
        .setTitle(t("upload"))
        .setIcon("upload")
        .onClick(() => this.uploadNoteImages(view, note, file))
    );
  }

  private async uploadNoteImages(view: MarkdownView, note: TFile, target?: TFile) {
    if (this.uploadsInProgress.has(note)) {
      new Notice(t("Image upload is already in progress"));
      return;
    }
    this.uploadsInProgress.add(note);

    try {
      const editor = this.getNoteEditorView(view, note)?.editor;
      const snapshot = editor?.getValue() ?? await this.app.vault.read(note);
      const references = getLocalImageReferences(this.app, note, snapshot);
      if (!references) {
        new Notice(t("Wait for Obsidian to index the note, then retry"));
        return;
      }

      const selected = target ? references.filter(ref => ref.file === target) : references;
      const groups = new Map<TFile, LocalImageReference[]>();
      for (const reference of selected) {
        const group = groups.get(reference.file);
        if (group) group.push(reference);
        else groups.set(reference.file, [reference]);
      }

      if (!groups.size) {
        new Notice(t("No local images found in this note"));
        return;
      }

      const uploader = this.getUploader();
      const uploaded = new Map<TFile, string>();
      for (const [file, refs] of groups) {
        try {
          // 每个附件单独请求，避免图床只返回部分 URL 时错配到其他附件。
          const response = await uploader.upload([{
            file,
            path: file.path,
            name: refs[0].name,
            source: refs[0].source,
          }]);
          const url = response.success ? getUploadedUrl(response.result) : undefined;
          if (url) uploaded.set(file, url);
        } catch {
          // 单张失败时保留原引用，其他附件继续上传。
        }
      }

      if (!uploaded.size) {
        new Notice(t("Image upload failed. Check the uploader settings"));
        return;
      }

      const changes = selected.flatMap(reference => {
        const url = uploaded.get(reference.file);
        if (!url) return [];
        const text = formatUploadedImage(reference, this.handleName(reference.name), url);
        return [{ ...reference, text }];
      });

      // 上传期间可能换笔记或编辑原文。只在应用改动前仍与快照一致时写回。
      const editorView = this.getNoteEditorView(view, note);
      const currentEditor = editorView?.editor;
      const trash = this.settings.deleteSource ? this.getUnreferencedSources(note, uploaded, groups) : [];
      let written = false;
      if (currentEditor) {
        if (currentEditor.getValue() === snapshot) {
          currentEditor.transaction({
            changes: changes.map(({ start, end, text }) => ({
              from: currentEditor.offsetToPos(start),
              to: currentEditor.offsetToPos(end),
              text,
            })),
          });
          written = true;
        }
      } else {
        await this.app.vault.process(note, content => {
          if (content !== snapshot) return content;
          written = true;
          return changes.reduceRight(
            (text, change) => text.slice(0, change.start) + change.text + text.slice(change.end),
            content
          );
        });
      }

      if (!written) {
        new Notice(t("The note changed during upload. Links were not replaced"));
        return;
      }

      new Notice(t("Image upload summary")
        .replace("{uploaded}", String(uploaded.size))
        .replace("{failed}", String(groups.size - uploaded.size)));

      if (trash.length) {
        // 先保存换链结果，再移除原图，避免磁盘上的笔记仍指向已移除的文件。
        if (editorView) await editorView.save();
        await this.trashSources(trash);
      }
    } catch {
      new Notice(t("Could not update image links in the note"));
    } finally {
      this.uploadsInProgress.delete(note);
    }
  }

  private getNoteEditorView(view: MarkdownView, note: TFile): MarkdownView | undefined {
    if (view.file === note && view.getMode() === "source") return view;
    return this.app.workspace.getLeavesOfType("markdown")
      .map(leaf => leaf.view)
      .find((candidate): candidate is MarkdownView =>
        candidate instanceof MarkdownView &&
        candidate.file === note &&
        candidate.getMode() === "source"
      );
  }

  private getUnreferencedSources(
    note: TFile,
    uploaded: ReadonlyMap<TFile, string>,
    groups: ReadonlyMap<TFile, LocalImageReference[]>
  ): TFile[] {
    const indexedNotes = Object.entries(this.app.metadataCache.resolvedLinks);
    // 写回前的索引包含旧嵌入。仅扣除本次将替换的引用，保留其他笔记仍在使用的附件。
    return Array.from(uploaded.keys()).filter(file =>
      indexedNotes.every(([path, links]) =>
        (links[file.path] ?? 0) <= (path === note.path ? groups.get(file).length : 0)
      )
    );
  }

  private async trashSources(files: TFile[]) {
    for (const file of files) {
      try {
        await this.app.fileManager.trashFile(file);
      } catch {
        new Notice(t("Could not trash the local image"));
      }
    }
  }

  /** 剪贴板网络图片仍走原有的独立设置。 */
  replaceImage(imageList: Image[], uploadUrlList: string[]) {
    let content = this.helper.getValue();

    imageList.forEach((item, index) => {
      const uploadImage = uploadUrlList[index];
      const name = this.handleName(item.name);
      content = content.replaceAll(item.source, () => "![" + name + "](" + uploadImage + ")");
    });

    this.helper.setValue(content);
  }

  setupPasteHandler() {
    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        (evt: ClipboardEvent, editor: Editor, markdownView: MarkdownView) => {
          const allowUpload = this.helper.getFrontmatterValue(
            "image-auto-upload",
            this.settings.uploadByClipSwitch
          );

          let files = evt.clipboardData.files;
          if (!allowUpload) {
            return;
          }

          // 剪贴板内容有md格式的图片时
          if (this.settings.workOnNetWork) {
            const clipboardValue = evt.clipboardData.getData("text/plain");
            const imageList = this.helper
              .getImageLink(clipboardValue)
              .filter(image => image.path.startsWith("http"))
              .filter(
                image =>
                  !this.helper.hasBlackDomain(
                    image.path,
                    this.settings.newWorkBlackDomains
                  )
              );

            if (imageList.length !== 0) {
              this.upload(imageList).then(res => {
                let uploadUrlList = res.result;
                this.replaceImage(imageList, uploadUrlList);
              });
            }
          }

          // 剪贴板中是图片时进行上传
          if (this.canUpload(evt.clipboardData)) {
            this.uploadFileAndEmbedImgurImage(
              editor,
              async (editor: Editor, pasteId: string) => {
                let res: any;
                res = await this.uploadByClipboard(evt.clipboardData.files);

                if (res.code !== 0) {
                  this.handleFailedUpload(editor, pasteId, res.msg);
                  return;
                }
                const url = res.data;

                return url;
              },
              evt.clipboardData
            ).catch();
            evt.preventDefault();
          }
        }
      )
    );
    this.registerEvent(
      this.app.workspace.on(
        "editor-drop",
        async (evt: DragEvent, editor: Editor, markdownView: MarkdownView) => {
          // when ctrl key is pressed, do not upload image, because it is used to set local file
          if (evt.ctrlKey) {
            return;
          }
          const allowUpload = this.helper.getFrontmatterValue(
            "image-auto-upload",
            this.settings.uploadByClipSwitch
          );

          if (!allowUpload) {
            return;
          }

          let files = evt.dataTransfer.files;
          if (files.length !== 0 && files[0].type.startsWith("image")) {
            let sendFiles: Array<string> = [];
            let files = evt.dataTransfer.files;
            Array.from(files).forEach((item, index) => {
              if (item.path) {
                sendFiles.push(item.path);
              } else {
                const { webUtils } = require("electron");
                const path = webUtils.getPathForFile(item);
                sendFiles.push(path);
              }
            });
            evt.preventDefault();

            const data = await this.upload(sendFiles);

            if (data.success) {
              data.result.map((value: string) => {
                let pasteId = (Math.random() + 1).toString(36).substr(2, 5);
                this.insertTemporaryText(editor, pasteId);
                this.embedMarkDownImage(editor, pasteId, value, files[0].name);
              });
            } else {
              new Notice("Upload error");
            }
          }
        }
      )
    );
  }

  canUpload(clipboardData: DataTransfer) {
    this.settings.applyImage;
    const files = clipboardData.files;
    const text = clipboardData.getData("text");

    const hasImageFile =
      files.length !== 0 && files[0].type.startsWith("image");
    if (hasImageFile) {
      if (!!text) {
        return this.settings.applyImage;
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  async uploadFileAndEmbedImgurImage(
    editor: Editor,
    callback: Function,
    clipboardData: DataTransfer
  ) {
    let pasteId = (Math.random() + 1).toString(36).substr(2, 5);
    this.insertTemporaryText(editor, pasteId);
    const name = clipboardData.files[0].name;

    try {
      const url = await callback(editor, pasteId);
      this.embedMarkDownImage(editor, pasteId, url, name);
    } catch (e) {
      this.handleFailedUpload(editor, pasteId, e);
    }
  }

  insertTemporaryText(editor: Editor, pasteId: string) {
    let progressText = imageAutoUploadPlugin.progressTextFor(pasteId);
    editor.replaceSelection(progressText + "\n");
  }

  private static progressTextFor(id: string) {
    return `![Uploading file...${id}]()`;
  }

  embedMarkDownImage(
    editor: Editor,
    pasteId: string,
    imageUrl: any,
    name: string = ""
  ) {
    let progressText = imageAutoUploadPlugin.progressTextFor(pasteId);
    name = this.handleName(name);

    let markDownImage = `![${name}](${imageUrl})`;

    imageAutoUploadPlugin.replaceFirstOccurrence(
      editor,
      progressText,
      markDownImage
    );
  }

  handleFailedUpload(editor: Editor, pasteId: string, reason: any) {
    new Notice(reason);
    console.error("Failed request: ", reason);
    let progressText = imageAutoUploadPlugin.progressTextFor(pasteId);
    imageAutoUploadPlugin.replaceFirstOccurrence(
      editor,
      progressText,
      "⚠️upload failed, check dev console"
    );
  }

  handleName(name: string) {
    const imageSizeSuffix = this.settings.imageSizeSuffix || "";

    if (this.settings.imageDesc === "origin") {
      return `${name}${imageSizeSuffix}`;
    } else if (this.settings.imageDesc === "none") {
      return "";
    } else if (this.settings.imageDesc === "removeDefault") {
      if (name === "image.png") {
        return "";
      } else {
        return `${name}${imageSizeSuffix}`;
      }
    } else {
      return `${name}${imageSizeSuffix}`;
    }
  }

  static replaceFirstOccurrence(
    editor: Editor,
    target: string,
    replacement: string
  ) {
    let lines = editor.getValue().split("\n");
    for (let i = 0; i < lines.length; i++) {
      let ch = lines[i].indexOf(target);
      if (ch != -1) {
        let from = { line: i, ch: ch };
        let to = { line: i, ch: ch + target.length };
        editor.replaceRange(replacement, from, to);
        break;
      }
    }
  }
}
