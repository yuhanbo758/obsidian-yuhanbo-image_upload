[中文文档](readme-zh.md)

# yuhanbo-image-upload

A desktop fork of [renmu123’s Image auto upload](https://github.com/renmu123/obsidian-image-auto-upload-plugin), distributed under the original MIT license. It uses PicGo, PicList, or PicGo-Core to upload images.

For manual installation, copy the built `main.js` and `manifest.json` to `.obsidian/plugins/yuhanbo-image-upload/` in your vault, then enable `yuhanbo-image-upload` in Community plugins.

## Privacy and external services

- Local PicGo or PicList receives the selected attachment paths over HTTP. In remote server mode, the configured PicList endpoint receives the image bytes. PicGo-Core uses the locally installed command to access attachments and the system clipboard. Drag-and-drop can read the files explicitly dropped from outside the vault.
- The configured uploader sends images to the image host you select. Hosting accounts, costs, and image visibility depend on that service. When you request a network-image download, the plugin fetches the image from its original host and saves it to the vault.
- Uploader settings, including any credentials embedded in an endpoint URL, stay in the local plugin configuration. The plugin does not store image host passwords separately or collect telemetry. Keep the plugin's data file and custom endpoint URLs private.


# Start

1. Install the PicGo tool and configure it, refer to the [official website](https://github.com/Molunerfinn/PicGo)
2. Enable PicGo's Server service and remember the port number
3. Install the plugin
4. Open the plugin settings and set it to `http://127.0.0.1:{{port set in PicGo}}/upload` (e.g., `http://127.0.0.1:36677/upload`)
5. Try to see if the upload is successful

## Set picbed and configName

If you are using PicList (version >= 2.5.3), you can set the picbed and configName through URL parameters.
Example: `http://127.0.0.1:36677/upload?picbed=smms&configName=piclist`
This will upload the image to the `smms` picbed and use the piclist configName.
Using this feature, you can upload images to different picbeds in different Obsidian vaults.

# Features

## Upload when paste image

When you paste an image to Obsidian, this plugin will automatically upload your image.

You can set `image-auto-upload: false` in `frontmatter` to control one file.

Supports ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".svg", ".tiff", ".webp", ".avif"

Due to the [bug](https://github.com/renmu123/obsidian-image-auto-upload-plugin/issues/2) in PicGo 2.3.0-beta7, you cannot use this feature. Please install another version of PicGo.

```yaml
---
image-auto-upload: true
---
```

## Upload all local images file by command

Open a note and run **Upload all images** from the command palette (`Ctrl+P`). The command uploads local Markdown images and wiki embeds, then replaces each successful reference with its hosted URL. Existing network images are preserved. Repeated references upload once, and failed attachments keep their original links.

Enable **Replace images in other notes** in the plugin settings to reuse the uploaded links in other notes that embed the same attachments. The switch is off by default.

## download all internet to local

press `ctrl+P` and input `download all images`，enter, then will auto download all internet images to loacl, only test in win10

## Upload image by contextMenu

Right-click a local image in Live Preview and select **Upload image**. This updates the current note. The plugin uses the attachment's full vault path, so other attachments with the same filename are unaffected.

## Support drag-and-drop

Only work for picgo or picList app.

## server mode

You can deploy [PicList](https://github.com/Kuingsmile/PicList/releases) or [PicList-Core](https://github.com/Kuingsmile/PicList-Core) in your server and upload to it.

Support [PicList](https://github.com/Kuingsmile/PicList/releases) 2.6.3 later or [PicList-Core](https://github.com/Kuingsmile/PicList-Core)1.3.0 later

You can not upload network in this mode.
If you upload fail when you paste img, you can alse try to enable the mode.

## Support picgo-core

You can install picgo-core with npm. Reference to [doc](https://picgo.github.io/PicGo-Core-Doc/)

# TODO

- [x] upload all local images file by command
- [x] support yaml to config if upload image
- [x] support picgo-core
- [x] support upload image from system copy selected image
- [x] support network image

# Thanks

[obsidian-imgur-plugin](https://github.com/gavvvr/obsidian-imgur-plugin)

## 👨‍💻 作者信息

**余汉波** - 编程爱好者-量化交易和效率工具开发

- **GitHub**: [@yuhanbo758](https://github.com/yuhanbo758)

- **Email**: yuhanbo@sanrenjz.com

- **Website**: [三人聚智](https://www.sanrenjz.com)

## 🌐 相关链接

- 🏠 [项目主页](https://www.sanrenjz.com)

- 📚 [在线文档](https://docs.sanrenjz.com)（财经、代码和库文档等）

- 🛒 [插件商店](https://shop.sanrenjz.com)（所有程序，包括开源和不开源）


## 联系我们

[联系我们 - 三人聚智-余汉波](https://www.sanrenjz.com/contact_us/)

证券开户（+V：yuhanbo758）：[证券开户免5万0.854，无门槛开量化QMT，送框架策略，支持VIP快速通道，也可开Ptrade | 余汉波 文档](https://docs.sanrenjz.com/article/%E8%AF%81%E5%88%B8%E5%BC%80%E6%88%B7%E5%85%8D5%20%E4%B8%870.854%EF%BC%8C%E6%97%A0%E9%97%A8%E6%A7%9B%E5%BC%80%E9%87%8F%E5%8C%96QMT%EF%BC%8C%E9%80%81%E6%A1%86%E6%9E%B6%E7%AD%96%E7%95%A5%EF%BC%8C%E6%94%AF%E6%8C%81VIP%E5%BF%AB%E9%80%9F%E9%80%9A%E9%81%93%EF%BC%8C%E4%B9%9F%E5%8F%AF%E5%BC%80Ptrade)

三人聚智下载：[sanrenjz - 三人聚智](https://www.sanrenjz.com/sanrenjz/)

codebot 下载：[sanrenjz-codebot - 三人聚智-余汉波](https://www.sanrenjz.com/sanrenjz-codebot/)

![三码合一](https://gdsx.sanrenjz.com/image/sanrenjz_yuhanbolh_yuhanbo758.png?imageSlim&t=1ab9b82c-e220-8022-beff-e265a194292a)

![余汉波打赏码](https://gdsx.sanrenjz.com/image/%E6%89%93%E8%B5%8F%E7%A0%81%E5%90%88%E4%B8%80.png?imageSlim)

## 🙏 致谢

感谢所有为本项目贡献代码和想法的开发者们！

---
**⭐ 如果这个项目对您有帮助，请给它一个 Star！**
