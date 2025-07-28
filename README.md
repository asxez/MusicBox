<br />
<p align="center">
  <img src="docs/images/logo.svg" alt="MusicBox Logo" width="156" height="156">
  <h1 align="center" style="font-weight: 600">🎵 MusicBox</h1>
  <p align="center">
    高颜值的本地音乐播放器
    <br />
    <!-- <a href="#-特性"><strong>✨ 查看特性</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp; -->
    <a href="#-安装"><strong>📦 下载安装</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#-开发"><strong>🛠️ 开发指南</strong></a>
    <a href="#-相关截图"><strong>📌 相关截图</strong></a>
    <br />
  </p>
</p>

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#-安装)
[![Electron](https://img.shields.io/badge/Electron-31.0.0-47848f.svg)](https://electronjs.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D20.0.0-green.svg)](https://nodejs.org/)

---

## 📖 项目简介

**MusicBox**
是一款专注于本地音乐播放的桌面应用程序，采用现代化的技术栈和精美的用户界面设计。项目灵感来源于 [YesPlayMusic](https://github.com/qier222/YesPlayMusic)
的设计美学，致力于为用户提供优雅、流畅的本地音乐播放体验。

### 🎯 设计理念

- **高颜值界面**：参考 YesPlayMusic 的ui设计，提供简洁优雅的用户界面
- **本地优先**：专注于本地音乐文件播放
- **高性能音频**：基于 Web Audio API 的音频引擎，提供高质量音频播放
- **跨平台支持**：基于 Electron 框架，支持 Windows、macOS 和 Linux

## 📦 安装

### 预编译版本下载

前往 [Releases](https://github.com/asxez/MusicBox/releases) 页面下载适合你操作系统的安装包：

### 从源码构建

从源码构建 MusicBox，请按照以下步骤操作：

#### 1. 克隆仓库

```bash
git clone https://github.com/asxez/MusicBox.git
cd MusicBox
```

#### 2. 安装依赖

```bash
# 安装主项目依赖
npm install

# 安装渲染进程依赖
cd src/renderer
npm install
cd ../..
```

#### 3. 开发模式运行

```bash
npm run dev
# 或者
npm run dev:main
```

#### 4. 构建应用

```bash
# 构建当前平台版本
npm run build

# 构建所有平台版本
npm run build:all
```

## 🛠️ 开发

### 项目结构

```
MusicBox/
├── src/
│   ├── main/                   # 主进程代码
│   │   ├── main.js             # 主进程入口
│   │   ├── preload.js          # 预加载脚本
│   │   └── library-cache-manager.js  # 音乐库缓存管理
│   └── renderer/               # 渲染进程代码
│       ├── public/             # 静态资源
│       │   ├── index.html      # 主页面
│       │   ├── styles/         # 编译后的样式
│       │   ├── js/             # 编译后的脚本
│       │   └── assets/         # 图标、图片等资源
│       ├── src/                # 源代码
│       │   ├── js/             # JavaScript 源码
│       │   │   ├── app.js      # 应用主类
│       │   │   ├── api.js      # API 接口层
│       │   │   ├── components.js  # UI 组件
│       │   │   ├── web-audio-engine.js  # 音频引擎
│       │   │   └── utils.js    # 工具方法
│       │   ├── styles/         # SCSS 样式源码
│       │   │   └── main.scss   # 主样式文件
│       │   └── assets/         # 源资源文件
│       └── scripts/            # 构建脚本
├── docs/                       # 文档和图片
├── dist/                       # 构建输出目录
├── package.json               # 项目配置
└── README.md                  # 项目说明
```

### 开发环境设置

#### 1. 环境要求

- Node.js >= 20.0.0

#### 2. 克隆项目

```bash
git clone https://github.com/asxez/MusicBox.git
cd MusicBox
```

#### 3. 安装依赖

```bash
# 安装主项目依赖
npm install

# 安装渲染进程依赖
cd src/renderer
npm install
cd ../..
```

#### 4. 开发模式
```bash
# 运行 electron
npm run dev:main

# 仅启动渲染进程服务器
npm run dev:renderer
```

## 🤝 贡献

我们欢迎所有形式的贡献！无论是报告 bug、提出功能建议，还是提交代码改进。

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

- [YesPlayMusic](https://github.com/qier222/YesPlayMusic) - 设计灵感来源
- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [music-metadata](https://github.com/borewit/music-metadata) - 音频元数据解析
- 所有为项目做出贡献的开发者们

## 📌 相关截图

![MusicBox 应用截图](docs/images/1.png)
![MusicBox 应用截图](docs/images/2.png)
![MusicBox 应用截图](docs/images/3.png)
![MusicBox 应用截图](docs/images/4.png)

---

<p align="center">
  <strong>如果你喜欢这个项目，请给它一个 ⭐️</strong>
</p>
