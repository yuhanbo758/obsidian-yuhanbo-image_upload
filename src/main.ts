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
import {
  formatUploadedImage,
  getLocalImageReferences,
  getRelatedNotePaths,
  getUploadedUrl,
} from "./localImages";
import type { LocalImageReference } from "./localImages";
import { downloadAllImageFiles } from "./download";
import { UploaderManager } from "./uploader/index";
import { PicGoDeleter } from "./deleter";
import Helper from "./helper";
import { t } from "./lang/helpers";
import { SettingTab, PluginSettings, DEFAULT_SETTINGS } from "./setting";

import type { Image } from "./types";

interface ImageLinkChange {
  start: number;
  end: number;
  text: string;
}

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
            void downloadAllImageFiles(this).catch((error: unknown) => {
              new Notice(error instanceof Error ? error.message : "Download failed");
            });
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
                  item => item.imgUrl === markdownUrl
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
              item => item.imgUrl === imgPath
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
                    item => item.imgUrl !== imgPath
                  );
                await this.saveSettings();
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
      const editor = this.getNoteEditorView(note, view)?.editor;
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

      const changes = this.getUploadedImageChanges(selected, uploaded);
      const trash = this.settings.deleteSource ? this.getUnreferencedSources(note, uploaded, groups) : [];
      if (!await this.writeImageChanges(note, snapshot, changes, view)) {
        new Notice(t("The note changed during upload. Links were not replaced"));
        return;
      }

      new Notice(t("Image upload summary")
        .replace("{uploaded}", String(uploaded.size))
        .replace("{failed}", String(groups.size - uploaded.size)));

      if (!target && this.settings.replaceInOtherNotes) {
        await this.replaceImagesInOtherNotes(note, uploaded);
      }

      if (trash.length) {
        // 先保存换链结果，再移除原图，避免磁盘上的笔记仍指向已移除的文件。
        await this.getNoteEditorView(note, view)?.save();
        await this.trashSources(trash);
      }
    } catch {
      new Notice(t("Could not update image links in the note"));
    } finally {
      this.uploadsInProgress.delete(note);
    }
  }

  private getUploadedImageChanges(
    references: LocalImageReference[],
    uploaded: ReadonlyMap<TFile, string>
  ): ImageLinkChange[] {
    return references.flatMap(reference => {
      const url = uploaded.get(reference.file);
      if (!url) return [];
      const { start, end } = reference;
      const text = formatUploadedImage(reference, this.handleName(reference.name), url);
      return [{ start, end, text }];
    });
  }

  private async writeImageChanges(
    note: TFile,
    snapshot: string,
    changes: ImageLinkChange[],
    view?: MarkdownView
  ): Promise<boolean> {
    // 网络请求或读盘期间可能换笔记或编辑原文。只对仍与快照一致的文本应用改动。
    const editor = this.getNoteEditorView(note, view)?.editor;
    if (editor) {
      if (editor.getValue() !== snapshot) return false;
      editor.transaction({
        changes: changes.map(({ start, end, text }) => ({
          from: editor.offsetToPos(start),
          to: editor.offsetToPos(end),
          text,
        })),
      });
      return true;
    }

    let written = false;
    await this.app.vault.process(note, content => {
      if (content !== snapshot || this.getNoteEditorView(note)) return content;
      written = true;
      return changes.reduceRight(
        (text, change) => text.slice(0, change.start) + change.text + text.slice(change.end),
        content
      );
    });
    return written;
  }

  private async replaceImagesInOtherNotes(
    note: TFile,
    uploaded: ReadonlyMap<TFile, string>
  ) {
    const imageFiles = new Set(uploaded.keys());
    const imagePaths = new Set([...imageFiles].map(file => file.path));
    const relatedPaths = getRelatedNotePaths(this.app, note.path, imagePaths);
    let updated = 0;
    let skipped = 0;

    for (const path of relatedPaths) {
      const otherNote = this.app.vault.getFileByPath(path);
      if (!otherNote || otherNote.extension !== "md") continue;
      if (this.uploadsInProgress.has(otherNote)) {
        skipped++;
        continue;
      }

      // 锁住同一篇笔记，避免它与另一项上传同时回写。
      this.uploadsInProgress.add(otherNote);
      try {
        const editor = this.getNoteEditorView(otherNote)?.editor;
        const snapshot = editor?.getValue() ?? await this.app.vault.read(otherNote);
        const references = getLocalImageReferences(this.app, otherNote, snapshot, imageFiles);
        if (!references) {
          skipped++;
          continue;
        }
        if (!references.length) continue;

        const changes = this.getUploadedImageChanges(references, uploaded);
        if (await this.writeImageChanges(otherNote, snapshot, changes)) updated++;
        else skipped++;
      } catch {
        skipped++;
      } finally {
        this.uploadsInProgress.delete(otherNote);
      }
    }

    if (updated || skipped) {
      new Notice(t("Other note replacement summary")
        .replace("{updated}", String(updated))
        .replace("{skipped}", String(skipped)));
    }
  }

  private getNoteEditorView(note: TFile, view?: MarkdownView): MarkdownView | undefined {
    if (view?.file === note && view.getMode() === "source") return view;
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
        (evt: ClipboardEvent, editor: Editor) => {
          if (evt.defaultPrevented || !evt.clipboardData) return;
          const allowUpload = this.helper.getFrontmatterValue(
            "image-auto-upload",
            this.settings.uploadByClipSwitch
          );

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
              void this.upload(imageList)
                .then(({ result }) => this.replaceImage(imageList, result))
                .catch(() => {
                  new Notice(t("Image upload failed. Check the uploader settings"));
                });
            }
          }

          // 剪贴板中是图片时进行上传
          if (this.canUpload(evt.clipboardData)) {
            void this.uploadFileAndEmbedImgurImage(
              editor,
              async () => {
                const { result } = await this.uploadByClipboard(
                  evt.clipboardData.files
                );
                const url = result?.[0];
                if (!url) {
                  throw new Error(
                    t("Image upload failed. Check the uploader settings")
                  );
                }
                return url;
              },
              evt.clipboardData
            );
            evt.preventDefault();
          }
        }
      )
    );
    this.registerEvent(
      this.app.workspace.on(
        "editor-drop",
        async (evt: DragEvent, editor: Editor) => {
          // when ctrl key is pressed, do not upload image, because it is used to set local file
          if (evt.defaultPrevented || evt.ctrlKey || !evt.dataTransfer) {
            return;
          }
          const allowUpload = this.helper.getFrontmatterValue(
            "image-auto-upload",
            this.settings.uploadByClipSwitch
          );

          if (!allowUpload) {
            return;
          }

          const files = Array.from(evt.dataTransfer.files).filter(
            file => file.type.startsWith("image/") || isAssetTypeAnImage(file.name)
          );
          if (files.length === 0) return;
          evt.preventDefault();

          try {
            const data = await this.getUploader().uploadDroppedFiles(files);
            if (!data.success) {
              new Notice(t("Image upload failed. Check the uploader settings"));
              return;
            }
            data.result.forEach((value, index) => {
              const pasteId = (Math.random() + 1).toString(36).slice(2, 7);
              this.insertTemporaryText(editor, pasteId);
              this.embedMarkDownImage(editor, pasteId, value, files[index]?.name);
            });
          } catch {
            new Notice(t("Image upload failed. Check the uploader settings"));
          }
        }
      )
    );
  }

  canUpload(clipboardData: DataTransfer) {
    const files = clipboardData.files;
    const text = clipboardData.getData("text");

    const hasImageFile =
      files.length !== 0 && files[0].type.startsWith("image");
    return hasImageFile && (!text || this.settings.applyImage);
  }

  async uploadFileAndEmbedImgurImage(
    editor: Editor,
    callback: () => Promise<string>,
    clipboardData: DataTransfer
  ) {
    const pasteId = (Math.random() + 1).toString(36).slice(2, 7);
    this.insertTemporaryText(editor, pasteId);
    const name = clipboardData.files[0].name;

    try {
      const url = await callback();
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
    imageUrl: string,
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

  handleFailedUpload(editor: Editor, pasteId: string, reason: unknown) {
    new Notice(
      reason instanceof Error
        ? reason.message
        : t("Image upload failed. Check the uploader settings")
    );
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
