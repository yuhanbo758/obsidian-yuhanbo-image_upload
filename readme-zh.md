# yuhanbo-image-upload

这是基于 [renmu123 的 Image auto upload](https://github.com/renmu123/obsidian-image-auto-upload-plugin) 开发的桌面版，保留原项目的 MIT 许可。支持通过 PicGo、PicList 和 PicGo-Core 上传图片。

手动安装时，将构建出的 `main.js` 和 `manifest.json` 放入笔记库下的 `.obsidian/plugins/yuhanbo-image-upload/`，再到 Obsidian 的「第三方插件」中启用 `yuhanbo-image-upload`。

## 隐私与外部服务

- 本机 PicGo 或 PicList 通过 HTTP 接收选中的附件路径。远程服务器模式会把图片文件内容发送到你配置的 PicList 地址。PicGo-Core 通过本机命令访问附件和系统剪贴板。拖拽上传可读取你从库外主动拖入的文件。
- 图片由你配置的上传器转交给所选图床，账号、费用及图片可见性由图床决定。使用批量下载命令时，插件会访问原图片地址并将下载文件保存到笔记库。
- 上传器设置保存在本地，若自定义服务地址含令牌，也会随地址保存。插件不单独保存图床密码，也不收集遥测数据。请妥善保管插件的数据文件和自定义服务地址。


# 开始

1. 安装 PicGo 工具，并进行配置，配置参考[官网](https://github.com/Molunerfinn/PicGo)
2. 开启 PicGo 的 Server 服务，并记住端口号
3. 安装插件
4. 打开插件配置项，设置为`http://127.0.0.1:{{PicGo设置的端口号}}/upload`（例如：`http://127.0.0.1:36677/upload`）
5. 接下来试试看能否上传成功

## 设置图床和配置名

如果你使用的是 PicList(version >= 2.5.3)，你可以通过 url 参数设置图床和配置名。
例如：`http://127.0.0.1:36677/upload?picbed=smms&configName=piclist`
这将会上传图片到 `smms` 图床，并且使用配置名为`piclist`的图床设置。
使用这个功能，你可以在不同的 Obsidian vault 中上传到不同的图床。

# 特性

## 剪切板上传

支持黏贴剪切板的图片的时候直接上传，目前支持复制系统内图像直接上传。

支持 ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".svg", ".tiff", ".webp", ".avif"

该功能在 PicGo 2.3.0-beta7 版本中无法使用，请更换其他版本

支持通过设置 `frontmatter` 来控制单个文件的上传，默认值为 `true`，控制关闭请将该值设置为 `false`，**实时预览模式下需修改值为复选框**

```yaml
---
image-auto-upload: true
---
```

## 批量上传一个文件中的所有图像文件

打开笔记，通过 `Ctrl+P` 运行 **Upload all images**。命令上传笔记中的本地 Markdown 图片和 Wiki 图片嵌入，并逐一用图床返回的 URL 替换原引用。网络图片保持原样，同一个附件只上传一次，上传失败的图片保留原引用。

## 批量下载网络图片到本地

输入 `ctrl+P` 呼出面板，输入 `download all images`，点击回车，就会自动开始下载。只在 win 进行过测试

## 支持右键菜单上传图片

在实时预览中右键点击笔记里的本地图片，选择 **上传**。插件按附件路径定位目标，同名的其他附件保持原样。

## 支持拖拽上传

仅在使用 picGo 或 picList 客户端时生效

## 支持 Picgo-Core

目前已经全功能支持

~~目前只支持粘贴时上传图片~~

## 支持 server 远程模式

你可以将 [PicList](https://github.com/Kuingsmile/PicList/releases) 或 [PicList-Core](https://github.com/Kuingsmile/PicList-Core) 部署在服务器上并启用 server 模式来实现图片上传

[PicList](https://github.com/Kuingsmile/PicList/releases) 2.6.3 及以上 或 [PicList-Core](https://github.com/Kuingsmile/PicList-Core)1.3.0 以上版本支持

在该模式下不支持上传网络图片选项
如果粘贴时上传图片失败，你也可以尝试启用该模式

### 安装

[官方文档：全局安装](https://picgo.github.io/PicGo-Core-Doc/zh/guide/getting-started.html#%E5%85%A8%E5%B1%80%E5%AE%89%E8%A3%85)

### PicGo-Core 配置

[官方文档：配置](https://picgo.github.io/PicGo-Core-Doc/zh/guide/config.html#%E9%BB%98%E8%AE%A4%E9%85%8D%E7%BD%AE%E6%96%87%E4%BB%B6)

### 插件配置

`Default uploader` 选择 `PicGo-Core`
设置路径，默认为空，使用环境变量
也可以设置自定义路径

## 常见问题

### MacOs 下无法长传

参考 [#160](https://github.com/renmu123/obsidian-image-auto-upload-plugin/issues/160), [#20](https://github.com/renmu123/obsidian-image-auto-upload-plugin/issues/20)

# TODO

- [x] 支持批量上传
- [x] 支持 yaml 设置是否开启已达到单个文档的控制
- [x] 支持 picgo-core
- [x] 支持复制系统图片文件
- [x] 网络图片支持
- [ ] 支持手机端
- [ ] 支持更多适配器

# 赞赏

如果本项目对你有帮助，请我喝瓶快乐水吧，有助于项目更好维护。  
爱发电：[https://afdian.com/a/renmu123](https://afdian.com/a/renmu123)  
你也可以给我的 B 站帐号 [充电](https://space.bilibili.com/10995238)

# 开发

## 安装

`pnpm install`

## 运行

`pnpm run dev`

## 编译

`pnpm run build`
