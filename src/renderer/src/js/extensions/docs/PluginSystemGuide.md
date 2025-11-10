# MusicBox 新插件系统开发指南

## 概述

MusicBox 的新插件系统参考了 VSCode 的扩展系统架构，提供了强大、可扩展的插件开发能力。新系统采用了依赖注入、事件驱动、生命周期管理等现代化设计模式。

## 核心概念

### 1. 扩展 (Extension)

扩展是插件系统的基本单元，每个扩展都有：

- **唯一标识符 (ID)**：用于识别扩展
- **清单文件 (manifest.json)**：描述扩展的元数据
- **主入口文件**：包含 `activate` 和 `deactivate` 函数
- **激活事件**：定义何时激活扩展
- **贡献点**：扩展可以贡献的功能

### 2. 激活事件 (Activation Events)

激活事件决定扩展何时被加载和激活：

- `onStartUp`：应用启动时激活
- `onCommand:commandId`：执行特定命令时激活
- `onView:viewId`：打开特定视图时激活
- `*`：总是激活（不推荐，影响性能）

### 3. 贡献点 (Contribution Points)

贡献点是扩展可以扩展应用功能的位置：

- `commands`：注册命令
- `menus`：添加菜单项
- `views`：注册自定义视图
- `configuration`：添加配置项
- `themes`：贡献主题
- `keybindings`：注册快捷键

### 4. 扩展 API

扩展通过标准化的 API 访问应用功能：

- `player`：播放器控制
- `library`：音乐库管理
- `ui`：用户界面操作
- `storage`：数据存储
- `settings`：设置管理
- `navigation`：导航控制
- `network`：网络请求
- `system`：系统信息
- `events`：事件监听
- `commands`：命令注册和执行
- `views`：视图管理
- `keybindings`：快捷键注册和管理
- `diagnostics`：诊断信息管理
- `tasks`：任务管理
- `window`：窗口操作

## 扩展结构

### 清单文件 (manifest.json)

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "扩展描述",
  "author": "作者名",
  "main": "path/to/extension.js",
  "activationEvents": [
    "onStartUp"
  ],
  "contributes": {
    "commands": [
      {
        "command": "myExtension.doSomething",
        "title": "Do Something"
      }
    ],
    "keybindings": [
      {
        "command": "myExtension.doSomething",
        "key": "Ctrl+Shift+D",
        "mac": "Cmd+Shift+D",
        "when": "always",
        "scope": "local"
      }
    ]
  },
  "engines": {
    "musicbox": "^1.0.0"
  },
  "categories": [
    "Other"
  ],
  "keywords": [
    "music",
    "player"
  ],
  "isBuiltin": false
}
```

### 主入口文件 (extension.js)

```javascript
/**
 * 激活函数 - 扩展被激活时调用
 * @param {Object} context 扩展上下文
 */
async function activate(context) {
    console.log('扩展已激活');

    // 获取 API
    const api = createExtensionAPI(context);

    // 注册命令
    const disposable = api.commands.registerCommand('myExtension.doSomething', () => {
        api.ui.showNotification('Hello from my extension!', 'info');
    });

    // 添加到订阅列表，确保清理
    context.subscriptions.add(disposable);

    // 监听事件
    const eventDisposable = api.events.on('trackChanged', (track) => {
        console.log('当前播放:', track?.title);
    });

    context.subscriptions.add(eventDisposable);

    // 返回公共 API（可选）
    return {
        doSomething() {
            return 'Hello!';
        }
    };
}

/**
 * 停用函数 - 扩展被停用时调用
 */
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

## 扩展上下文 (Extension Context)

扩展上下文提供了扩展运行所需的环境和工具：


## API 使用示例

[见API接口文档](../api/README.md)

## 资源管理

扩展必须正确管理资源，避免内存泄漏：

```javascript
async function activate(context) {
    // 使用 subscriptions 管理所有需要清理的资源

    // 1. 命令
    context.subscriptions.add(
        api.commands.registerCommand('cmd', () => {
        })
    );

    // 2. 事件监听
    context.subscriptions.add(
        api.events.on('event', () => {
        })
    );

    // 3. 定时器
    const timer = setInterval(() => {
    }, 1000);
    context.subscriptions.add(
        toDisposable(() => clearInterval(timer))
    );

    // 4. 自定义资源
    const resource = createResource();
    context.subscriptions.add(
        toDisposable(() => resource.cleanup())
    );
}
```

## 最佳实践

### 1. 延迟激活

只在需要时激活扩展，使用合适的激活事件：

```json
{
  "activationEvents": [
    "onCommand:myExtension.command"
  ]
}
```

### 2. 资源清理

始终使用 `context.subscriptions` 管理资源：

```javascript
context.subscriptions.add(disposable);
```

### 3. 错误处理

妥善处理错误，不要让扩展崩溃影响应用：

```javascript
try {
    await api.player.play(track);
} catch (error) {
    console.error('播放失败:', error);
    api.ui.showNotification('播放失败', 'error');
}
```

### 4. 异步操作

使用 async/await 处理异步操作：

```javascript
async function activate(context) {
    const data = await loadData();
    // ...
}
```

### 5. 性能优化

- 避免在激活时执行耗时操作
- 使用懒加载
- 及时清理不需要的资源

## 调试

### 1. 日志输出

```javascript
console.log('扩展日志');
console.error('错误信息');
```

### 2. 开发者工具

打开开发者工具查看日志和错误。

### 3. 扩展状态

检查扩展是否正确激活：

```javascript
const activated = window.extensionService.getExtension('my-extension');
console.log('扩展状态:', activated);
```

## 安装和卸载

### 安装扩展

```javascript
await window.extensionService.installExtension(manifest);
```

### 卸载扩展

```javascript
await window.extensionService.uninstallExtension('extension-id');
```

## 示例扩展

参考 `examples/hello-world-extension` 目录查看完整的示例扩展。

## 迁移指南

从旧插件系统迁移到新系统：

1. 将 `PluginBase` 改为导出 `activate` 和 `deactivate` 函数
2. 使用 `context.subscriptions` 替代 `this.disposables`
3. 使用新的 API 替代直接访问 `app`
4. 创建 `manifest.json` 文件
5. 更新激活事件和贡献点

## 常见问题

### Q: 如何访问应用的组件？

A: 通过 API 访问，不要直接访问 `app`。

### Q: 如何持久化数据？

A: 使用 `context.globalState` 或 `context.workspaceState`。

### Q: 如何监听应用事件？

A: 使用 `api.events.on()`。

### Q: 扩展何时被激活？

A: 根据 `activationEvents` 定义的事件触发时激活。

## 更多资源

- [VSCode Extension API](https://code.visualstudio.com/api)
- [示例扩展](./examples/)
- [API 参考](./APIReference.md)
