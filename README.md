<br />
<p align="center">
  <img src="docs/images/logo.svg" alt="MusicBox Logo" width="156" height="156">
  <h1 align="center" style="font-weight: 600">🎵 MusicBox</h1>
  <p align="center">
    高颜值的本地音乐播放器
    <br />
    <br />
    <!-- <a href="#-特性"><strong>✨ 查看特性</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp; -->
    <a href="#-安装"><strong>📦下载安装</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#-开发"><strong>🛠️开发指南</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#-插件开发"><strong>🔧为MusicBox安装（开发）插件</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#-相关截图"><strong>📌相关截图</strong></a>
    <br />
  </p>
</p>

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/asxez/MusicBox)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#-安装)
[![Electron](https://img.shields.io/badge/Electron-37.3.1-47848f.svg)](https://electronjs.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D22.18.0-green.svg)](https://nodejs.org/)

---

## 📖 项目简介

- **MusicBox**是一款专注于本地音乐播放的桌面应用程序，采用现代化的技术栈和精美的用户界面设计。
- 项目灵感来源于 [YesPlayMusic](https://github.com/qier222/YesPlayMusic) 的设计美学。

## ✨ 特性

- 💻️ 支持 Windows / macOS / Linux
- ✅ 支持flac, mp3, wav, ogg, m4a, aac, wma等多种音乐格式
- 🔧 强大的插件系统（允许在插件中实现任何功能，高权限）
- 📔 支持在线获取歌曲封面和歌词
- ⌨️ 支持自定义局内/全局快捷键
- 🎈 浅色/深色主题切换
- 🎼 支持均衡器
- 📃 支持桌面显示歌词
- 📔 支持识别内嵌封面和内嵌歌词
- 👁️ 支持自由的页面显示开关
- 💾 支持挂载 SMB/WebDAV 等网络磁盘
- 🖋️ 支持编辑歌曲元数据
- ▶️ 支持无间隙播放，为连续的专辑歌曲提供更好的播放体验
- 🛠️ 更多特性开发中

## 📔 TODOS

✅已完成，❌未完成，🔄部分完成，❓待定

- ✅ 硬件加速
- ❌ 歌词逐字
- ❌ 修复播放列表存在的问题
- ❌ 歌词样式调整
- 🔄 更多其他特性


## 📦 安装

### 预编译版本下载

前往 [Releases](https://github.com/asxez/MusicBox/releases) 页面下载适合你系统的安装包。

### 从源码构建

#### 环境要求

- Node.js >= 22.18.0
- python >= 3.8

从源码构建 MusicBox，请按照以下步骤操作：

#### 1. 克隆仓库

```bash
git clone https://github.com/asxez/MusicBox.git
cd MusicBox
```

#### 2. 安装依赖

```bash
# 安装主进程依赖
npm install

# 安装渲染进程依赖并构建
cd src/renderer
npm install
npm run build
cd ../..
```

#### 3. 开发模式运行

```bash
npm run dev:main
```

#### 4. 构建应用

```bash
# 构建当前平台版本
npm run build
```

## 🛠️ 开发

### 项目结构

```
MusicBox/
├── src/
│   ├── main/                                   # 主进程代码
│   │   ├── ipc/                                # IPC
│   │   ├── security/                           # 安全相关模块
│   │   ├── utils/                              # 通用工具
│   │   ├── drive-registry.js                   # 全局驱动器注册表
│   │   ├── library-cache-manager.js            # 音乐库缓存管理
│   │   ├── main.js                             # 主进程入口
│   │   ├── metadata-handler.js                 # 音频元数据处理器
│   │   ├── metadata_editor.py                  # 音频元数据编辑器
│   │   ├── network-drive-manager.js            # 网络磁盘管理
│   │   ├── network-file-adapter.js             # 网络文件系统适配器
│   │   └── preload.js                          # 预加载脚本
│   └── renderer/                               # 渲染进程代码
│       ├── src/                                # 源代码
│       │   ├── js/                             # JavaScript 源码
│       │   │   ├── components/                 # UI 组件
│       │   │   │   └── ...                     
│       │   │   ├── api.js                      # API 接口层
│       │   │   ├── app.js                      # 应用主类
│       │   │   ├── cache-manager.js            # localStorage缓存管理
│       │   │   ├── cover-update-manager.js     # 封面更新管理
│       │   │   ├── desktop-lyrics.js           # 桌面歌词管理
│       │   │   ├── embedded-cover-manager.js   # 内嵌封面管理
│       │   │   ├── embedded-lyrics-manager.js  # 内嵌歌词管理
│       │   │   ├── local-cover-manager.js      # 本地封面文件管理
│       │   │   ├── local-lyrics-manager.js     # 本地歌词文件管理
│       │   │   ├── md5.js                      # md5
│       │   │   ├── shortcut-config.js          # 快捷键配置
│       │   │   ├── shortcut-recorder.js        # 快捷键录制器
│       │   │   ├── url-validator.js            # URL有效性检查
│       │   │   ├── utils.js                    # 工具方法
│       │   │   └── web-audio-engine.js         # 音频引擎
│       │   ├── styles/                         # SCSS 样式源码
│       │   │   └── main.scss                   # 主样式文件
│       │   └── assets/                         # 源资源文件
│       └── scripts/                            # 构建脚本
├── build/                                      # 构建的logo
├── docs/                                       # 文档和图片
├── dist/                                       # 构建输出目录
├── electron-builder.yml                        # 构建配置
├── package.json                                # 项目配置
└── README.md                                   # 项目说明
```


## 🔧 插件开发

可在 **issue** 中提交你开发的插件，我会在此链接你的仓库😋

[MusicBox 插件开发文档](src/renderer/src/js/plugin-system/docs)


### 可用插件列表

Q: 如何使用插件？

A：设置中打开插件管理，导入插件即可，目前只支持单个的 JS 文件。

**注意：插件间可能存在不兼容问题**
- [主题切换器-示例插件](src/renderer/src/js/plugin-system/examples/ThemeSwitcherPlugin.js) 描述：提供多种预设主题，支持实时切换
- [MusicBox实时状态接口](src/renderer/src/js/plugin-system/examples/RealtimeStatusAPIPlugin.js) 描述：提供 HTTP 接口获取 MusicBox 实时状态信息
- [背景图修改器](src/renderer/src/js/plugin-system/examples/BackgroundModifyPlugin.js) 描述：可修改应用的背景图片，支持单张图片和文件夹

## 🤝 贡献

我们欢迎所有形式的贡献！无论是报告 bug、提出功能建议、提交代码改进，或者说提交你开发的插件！

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

- [YesPlayMusic](https://github.com/qier222/YesPlayMusic) - 设计灵感来源
- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [LrcApi](https://github.com/HisAtri/LrcApi) - 提供相关接口
- [music-metadata](https://github.com/borewit/music-metadata) - 音频元数据解析
- 所有为项目做出贡献的开发者们

## 📌 相关截图

![MusicBox 应用截图](docs/images/1.png)
![MusicBox 应用截图](docs/images/2.png)
![MusicBox 应用截图](docs/images/3.png)
![MusicBox 应用截图](docs/images/4.png)
![MusicBox 应用截图](docs/images/5.png)
![MusicBox 应用截图](docs/images/6.png)

---

<p align="center">
  <strong>如果你喜欢这个项目，请给它一个 ⭐️</strong>
</p>
