# 渲染进程架构

本文聚焦 `src/renderer/`。渲染进程已经从早期 `src/js` 和全局 `app.js` 组织方式迁移到 Vite + TypeScript + feature 分层结构。旧的 `core/`、`services/` 目录仍存在，但只作为兼容转发层。

## 入口与构建

- Vite 配置：`src/renderer/vite.config.js`
- Vite root：`src/renderer/src`
- 构建输出：`src/renderer/public`
- 主窗口入口：`src/renderer/src/index.html`
- 桌面歌词入口：`src/renderer/src/DesktopLyrics.html`
- 主 renderer 入口：`src/renderer/src/app/bootstrap/main.ts`

`app/bootstrap/main.ts` 会先加载工具、应用 API、插件框架、页面、组件和弹窗，再导入 `./app` 创建应用实例。

## Canonical 目录

```text
src/renderer/src/app/
  bootstrap/               应用入口与 createMusicBoxApp
  composition/             组合根和 host ports
  lifecycle/               初始化、清理、首屏生命周期
  runtime/                 路由、快捷键、事件绑定、插件启动、UI facade
  shell/                   顶层 shell 视图控制

src/renderer/src/features/
  appShell/                应用外壳、窗口、托盘、通知、更新
  audioDriver/             音频驱动 UI/设置协调
  desktopLyrics/           桌面歌词窗口与同步
  equalizer/               图形/参量均衡器
  events/                  应用事件服务
  extensions/              插件管理功能
  library/                 音乐库、扫描、元数据编辑
  media/                   文件选择、音频读取、媒体文件系统
  mediaAssets/             歌词、封面、本地/在线/内嵌资源
  networkDrive/            SMB / WebDAV 网络磁盘
  playback/                播放队列、状态、音频引擎、UI 绑定
  playlists/               歌单数据、播放、封面、导入
  settings/                设置页 controller/service/renderer
  userData/                心情、日记等用户数据

src/renderer/src/ui/
  base/                    基础 Component
  pages/                   页面级组件
  widgets/                 播放器、导航、列表、歌词等常驻组件
  dialogs/                 轻量对话框
  modals/                  模态窗口

src/renderer/src/infrastructure/electron/
  ElectronBridge.ts        window.electronAPI 访问基础
  *Gateway.ts              按领域封装 preload API

src/renderer/src/shared/
  cache/                   renderer 本地缓存
  lyrics/                  歌词时间线和逐字渲染共享逻辑
  network/                 网络请求 client
  types/                   app contracts
```

## 依赖方向

推荐依赖方向：

```text
ui -> features -> infrastructure/electron -> preload -> main
app composition -> features/ui/shared
features -> shared
extensions -> public Extension API
```

避免的方向：

- `features` 直接依赖具体 UI DOM 细节，除非在 `ui-bindings` 中作为显式绑定层。
- `ui` 直接调用 `window.electronAPI`。
- 新代码从 `@/core`、`@/services` 或 `@js` 导入。
- 插件 host/framework 硬编码某个具体插件 ID、命令前缀或插件私有行为。

## 组合根

`app/composition/AppCompositionRoot.ts` 是渲染进程重构后的关键文件。它负责：

- 创建 `ComponentRegistry`、`DOMEventBinder`、`APIEventBinder`、`ViewRouter`。
- 创建播放、音乐库、歌单、快捷键、插件、网络磁盘等 app controller。
- 将 feature service 与 `MusicBoxApp` facade、UI facade、legacy plugin app bridge 显式连接。
- 配置跨功能依赖，例如 `desktopLyricsService` 获取播放快照，`equalizerService` 获取当前音频引擎。

当新功能需要跨模块协作时，应优先在组合根注入一个明确端口，而不是在模块内部读取全局对象。

## 运行时 facade

`app/runtime/MusicBoxApp.ts` 仍然暴露很多应用级方法，例如 `scanMusicFolder()`、`handleViewChange()`、`playTrackFromPlaylist()`。这些方法主要用于兼容旧 UI 绑定和插件调用，真实实现已经下沉到 `features/*`。

新增代码不要继续扩大 `MusicBoxApp` 的职责，除非它是应用级 facade 必须暴露的兼容入口。

## Feature 模块约定

一个 feature 通常由以下部分组成：

```text
features/<domain>/
  index.ts                 对外导出
  <Domain>Controller.ts    可选，状态编排或 UI 入口
  service/                 领域服务、gateway adapter、纯业务逻辑
  ui-bindings/             可选，连接 UI component 与 feature 的适配层
  domain/                  可选，纯领域模型
```

放置建议：

- 与 Electron IPC 交互的代码放在 service，并通过 `infrastructure/electron` gateway 访问。
- 只处理页面/组件事件绑定的代码放到 `ui-bindings`。
- 可测试、与 DOM 无关的规则放到 `domain` 或 `service`。
- 多个 feature 共享的纯工具放到 `shared/`。

## Electron Gateway

`infrastructure/electron/ElectronBridge.ts` 提供两个基础能力：

- `getElectronAPI()`：读取 preload 暴露的 `window.electronAPI`，缺失时抛出明确错误。
- `ElectronNamespaceAdapter`：包装某个命名空间的 `call()` 和 `on()`。

新增 IPC 应按以下路径接入：

1. 主进程 controller 增加 IPC handler。
2. preload 增加对应 namespace 方法。
3. `infrastructure/electron` 增加或扩展 gateway。
4. feature service 调用 gateway。
5. controller/UI 只依赖 feature service。

## 兼容层与架构检查

`core/` 和 `services/` 目录是迁移期兼容层。每个文件必须：

- 包含 `@deprecated` 注释。
- 只包含注释和 import/export 转发。
- 不包含新的业务逻辑。

`src/renderer/scripts/check-architecture-boundaries.mjs` 会检查：

- 禁止新代码从旧 `@/core`、`@/services`、`@js` 路径导入。
- 禁止在主 renderer 中使用 `eval` 或注入 script 标签加载插件代码。
- 禁止把 `createExtensionAPI` 暴露到主 renderer window。
- 禁止 plugin host/framework 硬编码内置插件 ID 或命令前缀。

运行：

```bash
cd src/renderer
npm run check:architecture
npm run lint
```

## 播放模块

播放相关代码集中在 `features/playback/`：

- `PlaybackController.ts`：应用层播放 controller。
- `PlaybackStore.ts`：播放状态 store。
- `domain/PlaybackQueue.ts`：播放队列和播放模式逻辑。
- `service/PlaybackService.ts`：播放服务 facade。
- `service/AudioEngineAdapter.ts`：Web Audio / WASAPI 切换适配。
- `service/audioEngine/webAudio/`：Web Audio 实现。
- `service/audioEngine/wasapi/WasapiEngine.ts`：WASAPI renderer adapter。
- `ui-bindings/`：播放器、列表等 UI 事件绑定。

播放状态变化通过事件和 store 同步到播放器 UI、歌词、桌面歌词和插件 API。

## 样式结构

样式入口：

- `styles/main.scss`：主窗口样式入口。
- `styles/DesktopLyrics.scss`：桌面歌词窗口样式入口。

样式目录按用途拆分：

- `base/`：reset、loading。
- `layout/`：app、content、navbar、sidebar。
- `components/`：按钮、表单、播放器、列表等。
- `pages/`：页面级样式。
- `features/`：均衡器、迷你模式、插件、网络磁盘、快捷键等功能样式。
- `dialogs/`：对话框样式。
- `theme/`：设计 token。

## 新增 renderer 代码检查清单

- 是否放在 canonical 目录，而不是 deprecated `core/` / `services/`。
- 是否通过 gateway 访问 preload API。
- 是否把跨模块依赖显式注入到组合根或端口对象。
- 是否清理 DOM listener、API listener、timer、plugin disposable。
- 是否运行 `npm run typecheck:renderer`。
- 是否运行 `cd src/renderer && npm run lint`。
