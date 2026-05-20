# MusicBox 插件系统

MusicBox 插件系统用于在不修改播放器核心代码的前提下扩展播放器能力。插件通过 `manifest.json` 声明元数据、激活事件、权限和贡献点，通过入口脚本的 `activate(context)` / `deactivate()` 管理生命周期。

## 目录结构

```text
extensions/
  api/                     插件可用的标准 API 与类型
  builtin/                 内置插件和内置插件索引
  core/                    插件生命周期、注册表、激活器、sandbox runtime
  docs/                    插件系统架构与开发指南
  examples/                示例插件
```

相关文档：

- [插件开发指南](docs/PluginSystemGuide.md)
- [插件系统架构](docs/Architecture.md)
- [Extension API](api/README.md)

## 插件包结构

最小插件：

```text
my-extension/
  manifest.json
  extension.js
```

`manifest.json` 示例：

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "MusicBox 插件示例",
  "author": "MusicBox Team",
  "main": "extension.js",
  "module": "helloWorldExtension",
  "canDisable": true,
  "activationEvents": ["onStartUp"],
  "permissions": [
    "ui.notification",
    "storage.read",
    "storage.write"
  ],
  "contributes": {
    "commands": [
      {
        "command": "helloWorld.sayHello",
        "title": "Hello World: Say Hello"
      }
    ]
  },
  "engines": {
    "musicbox": "^1.0.0"
  }
}
```

`extension.js` 示例：

```javascript
async function activate(context) {
    const api = context.api;

    await api.ui.showNotification('Hello World 插件已加载', 'success');

    const command = await api.commands.registerCommand('helloWorld.sayHello', async () => {
        await api.ui.showNotification('Hello from extension', 'info');
    });

    context.subscriptions.add(command);

    return {
        sayHello() {
            return 'Hello from MusicBox extension';
        }
    };
}

async function deactivate() {
    console.log('Hello World 插件已停用');
}

window.helloWorldExtension = {
    activate,
    deactivate
};
```

`manifest.module` 必须与入口脚本挂到 `window` 上的对象名一致。

## 插件来源

### 内置插件

内置插件位于 `extensions/builtin/`，并由 `extensions/builtin/extensions.json` 索引。构建 renderer 时，Vite 会将 `extensions/builtin` 复制到 `src/renderer/public`。

当前内置插件：

- `theme-enhancer`：主题增强插件。

### 用户插件

外部插件以 ZIP 包安装。主进程 `ExtensionInstaller` 会：

- 校验 `manifest.json` 必需字段。
- 阻止路径穿越。
- 拒绝覆盖内置插件 ID。
- 安装到 Electron userData 的 `extensions/<extensionId>` 目录。
- 将启用状态写入 userData 下的 `extensions.json`。

插件私有存储写入 userData 下的 `extension-storage/<extensionId>/<scope>.json`。

## 生命周期

1. 插件服务扫描内置插件和用户插件。
2. 根据 `activationEvents` 等待激活条件。
3. 激活时创建 `context`，包括 `api`、`subscriptions`、存储等能力。
4. 调用插件入口模块的 `activate(context)`。
5. 插件注册命令、事件、快捷键等 disposable，并加入 `context.subscriptions`。
6. 停用时调用 `deactivate()`，并释放 `subscriptions`。

常见激活事件：

- `onStartUp`：应用启动后激活。
- `onCommand:<commandId>`：命令首次执行时激活。
- `onView:<viewId>`：打开指定视图时激活。
- `*`：总是激活，不建议普通插件使用。

## API 边界

插件应只使用 `context.api` 暴露的标准能力，例如：

- `api.player`：播放控制和播放状态。
- `api.library`：音乐库和歌单。
- `api.ui`：通知、对话框、主题。
- `api.storage`：插件持久化存储。
- `api.settings`：设置读写。
- `api.commands`：命令注册和执行。
- `api.events`：事件订阅。
- `api.keybindings`：局部和全局快捷键。
- `api.network`、`api.system`、`api.window`：受控网络、系统和窗口能力。

不要直接访问 renderer 内部模块、Electron/Node API、`window.electronAPI` 或其他插件的私有全局对象。插件 host/framework 代码也不应硬编码具体插件 ID、命令前缀或插件私有行为。

## 开发检查清单

- `manifest.json` 包含 `id`、`name`、`version`、`main`。
- `id` 仅使用字母、数字、连字符和下划线。
- `module` 与入口脚本导出的 `window.<module>` 一致。
- 异步操作使用 `try/catch`，错误通过通知或日志反馈。
- 事件监听、命令、快捷键、timer 都加入 `context.subscriptions`。
- 不在激活阶段执行长时间阻塞任务。
- 插件包 ZIP 根目录或子目录中必须能找到 `manifest.json`。

## 示例

可参考：

- `examples/hello-world`
- `examples/keybindings-demo`
- `examples/extension-api-test`
- `examples/advanced-extension`
