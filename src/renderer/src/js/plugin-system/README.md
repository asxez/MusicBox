# MusicBox 插件系统

## 简介

MusicBox 插件系统是一个强大、可扩展的插件框架，参考了 VSCode 的扩展系统架构设计。它允许开发者通过编写扩展来增强 MusicBox 的功能，而无需修改应用核心代码。

## 特性

- ✅ **现代化架构**：采用依赖注入、事件驱动、生命周期管理等设计模式
- ✅ **延迟加载**：按需激活扩展，最小化性能影响
- ✅ **标准化 API**：提供丰富的 API 接口，涵盖播放器、音乐库、UI 等功能
- ✅ **资源管理**：自动管理资源生命周期，防止内存泄漏
- ✅ **事件系统**：强大的事件系统，支持事件过滤、映射、防抖等
- ✅ **扩展点**：灵活的贡献点系统，支持命令、菜单、视图等扩展
- ✅ **向后兼容**：与旧插件系统兼容，平滑迁移

## 快速开始

### 1. 创建扩展

创建一个新的扩展目录，包含以下文件：

```
my-extension/
├── manifest.json    # 扩展清单
└── extension.js     # 主入口文件
```

### 2. 编写清单文件

`manifest.json`:

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "我的第一个扩展",
  "author": "Your Name",
  "main": "path/to/extension.js",
  "activationEvents": [
    "onStartUp"
  ],
  "contributes": {
    "commands": [
      {
        "command": "myExtension.hello",
        "title": "Say Hello"
      }
    ]
  }
}
```

### 3. 编写扩展代码

`extension.js`:

```javascript
async function activate(context) {
    console.log('扩展已激活');

    // 获取 API
    const api = createExtensionAPI(context);

    // 注册命令
    const disposable = api.commands.registerCommand('myExtension.hello', () => {
        api.ui.showNotification('Hello from my extension!', 'success');
    });

    // 添加到订阅列表
    context.subscriptions.add(disposable);

    // 监听事件
    const eventDisposable = api.events.on('trackChanged', (track) => {
        console.log('当前播放:', track?.title);
    });

    context.subscriptions.add(eventDisposable);
}

async function deactivate() {
    console.log('扩展已停用');
}

// 导出
if (typeof window !== 'undefined') {
    window.myExtension = {
        activate,
        deactivate
    };
}
```

### 4. 安装扩展

```javascript
// 在控制台中执行
await window.extensionService.installExtension(manifest);
```

## 目录结构

```
plugin-system/
├── core/                    # 核心基础设施
│   ├── Lifecycle.js        # 生命周期管理
│   ├── Event.js            # 事件系统
│   ├── Instantiation.js    # 依赖注入
│   ├── ExtensionsRegistry.js  # 扩展注册表
│   ├── ExtensionActivator.js  # 扩展激活器
│   ├── ExtensionService.js    # 扩展服务
│   └── index.js            # 核心模块入口
├── api/                     # 扩展 API
│   └── ExtensionAPI.js     # API 实现
├── examples/                # 示例扩展
│   └── hello-world-extension/
│       ├── manifest.json
│       └── extension.js
├── docs/                    # 文档
│   ├── Architecture.md     # 架构设计
│   ├── NewPluginSystemGuide.md  # 开发指南
│   └── APIReference.md     # API 参考
└── README.md               # 本文件
```

## 核心概念

### 扩展 (Extension)

扩展是插件系统的基本单元，每个扩展包含：
- 唯一标识符 (ID)
- 清单文件 (manifest.json)
- 主入口文件
- 激活和停用函数

### 激活事件 (Activation Events)

定义扩展何时被激活：
- `onStartUp`：应用启动时
- `onCommand:commandId`：执行命令时
- `onView:viewId`：打开视图时
- `*`：总是激活

### 贡献点 (Contribution Points)

扩展可以贡献的功能：
- `commands`：命令
- `menus`：菜单项
- `views`：视图
- `configuration`：配置项
- `themes`：主题
- `keybindings`：快捷键

### 扩展 API

标准化的 API 接口：
- `player`：播放器控制
- `library`：音乐库管理
- `ui`：用户界面
- `storage`：数据存储
- `settings`：设置管理
- `navigation`：导航控制
- `network`：网络请求
- `system`：系统信息
- `events`：事件监听
- `commands`：命令系统
- `views`：视图管理

## API 示例

### 播放器控制

```javascript
const api = createExtensionAPI(context);

// 播放歌曲
await api.player.play(track);

// 暂停
await api.player.pause();

// 设置音量
await api.player.setVolume(0.5);
```

### 显示通知

```javascript
api.ui.showNotification('操作成功', 'success');
```

### 数据存储

```javascript
// 保存数据
await api.storage.update('myKey', 'value');

// 读取数据
const value = api.storage.get('myKey', 'default');
```

### 监听事件

```javascript
const disposable = api.events.on('trackChanged', (track) => {
    console.log('歌曲变化:', track);
});

context.subscriptions.add(disposable);
```

### 注册命令

```javascript
const disposable = api.commands.registerCommand('myExtension.command', () => {
    console.log('命令执行');
});

context.subscriptions.add(disposable);
```

## 文档

- [架构设计](./docs/Architecture.md) - 详细的架构设计文档
- [开发指南](./docs/PluginSystemGuide.md) - 完整的开发指南
- [API 参考](./docs/APIReference.md) - API 详细参考（待完善）
- [示例扩展](./examples/) - 示例扩展代码

## 示例扩展

查看 `examples/hello-world-extension` 目录获取完整的示例扩展。

## 最佳实践

1. **延迟激活**：使用合适的激活事件，避免在启动时激活所有扩展
2. **资源管理**：使用 `context.subscriptions` 管理所有资源
3. **错误处理**：妥善处理错误，不要让扩展崩溃影响应用
4. **异步操作**：使用 async/await 处理异步操作
5. **性能优化**：避免耗时操作，使用懒加载

## 与旧插件系统的区别

### 旧系统

```javascript
class MyPlugin extends PluginBase {
    constructor(context) {
        super(context);
    }

    async activate() {
        // 激活逻辑
    }

    async deactivate() {
        // 停用逻辑
    }
}
```

### 新系统

```javascript
async function activate(context) {
    // 激活逻辑
}

async function deactivate() {
    // 停用逻辑
}

window.myExtension = { activate, deactivate };
```

## 迁移指南

从旧插件系统迁移到新系统：

1. 将类改为导出 `activate` 和 `deactivate` 函数
2. 使用 `context.subscriptions` 替代 `this.disposables`
3. 使用新的 API 替代直接访问 `window.app`
4. 创建 `manifest.json` 文件
5. 更新激活事件和贡献点

## 常见问题

### Q: 如何调试扩展？

A: 打开开发者工具，查看控制台日志。

### Q: 扩展何时被激活？

A: 根据 `activationEvents` 定义的事件触发时激活。

### Q: 如何访问应用功能？

A: 通过 `createExtensionAPI(context)` 获取 API，不要直接访问 `window.app`。

### Q: 如何持久化数据？

A: 使用 `context.globalState` 或 `context.workspaceState`。

### Q: 如何清理资源？

A: 将所有需要清理的资源添加到 `context.subscriptions`。

## 贡献

欢迎贡献代码、报告问题、提出建议！

## 许可证

与 MusicBox 主项目相同。

## 参考

- [VSCode Extension API](https://code.visualstudio.com/api)
- [VSCode Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)

## 更新日志

### v2.0.0 (2024)

- ✨ 全新的插件系统架构
- ✨ 参考 VSCode 扩展系统设计
- ✨ 依赖注入、事件驱动、生命周期管理
- ✨ 标准化的扩展 API
- ✨ 扩展点和贡献点系统
- ✨ 向后兼容旧插件系统

### v1.0.0

- 初始版本（旧插件系统）

