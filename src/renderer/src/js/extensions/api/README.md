# MusicBox Extension API

MusicBox 扩展 API 提供了一套完整的接口，让扩展能够与应用进行交互。

## 📦 模块化架构

API 系统采用模块化设计，每个功能域都有独立的模块：

```
api/
├── index.ts              # API 入口
├── player.ts             # 播放器 API
├── library.ts            # 音乐库 API
├── ui.ts                 # UI API
├── storage.ts            # 存储 API
├── settings.ts           # 设置 API
├── navigation.ts         # 导航 API
├── network.ts            # 网络 API
├── system.ts             # 系统 API
├── events.ts             # 事件 API
├── commands.ts           # 命令 API
├── diagnostics.ts        # 诊断 API
├── tasks.ts              # 任务 API
├── window.ts             # 窗口 API
├── keybindings.ts        # 快捷键 API
└── common/
    ├── errors.ts         # 错误定义
    └── validation.ts     # 参数验证
```

## 🚀 快速开始

### 基本用法

```javascript
function activate(context) {
    const api = createExtensionAPI(context);
    
    // 使用播放器 API
    const track = api.player.getCurrentTrack();
    
    // 使用 UI API
    api.ui.showInformationMessage(`当前播放：${track.title}`);
    
    // 注册命令
    const disposable = api.commands.registerCommand('myext.hello', () => {
        api.ui.showSuccessMessage('Hello, MusicBox!');
    });
    
    // 调用命令
    api.commands.executeCommand('myext.hello');
    
    context.subscriptions.push(disposable);
}
```

## 📚 API 参考

### Player API

播放器控制和状态管理。

```javascript
// 播放控制
await api.player.play(track);
await api.player.pause();
await api.player.stop();
await api.player.nextTrack();
await api.player.previousTrack();

// 从路径播放
api.player.playTrack("G:/音乐/晴天-周杰伦.flac")

// 音量控制
await api.player.setVolume(0.5);
const volume = api.player.getVolume();

// 进度控制
await api.player.seek(60); // 跳转到 60 秒
const position = await api.player.getPosition();
const duration = api.player.getDuration();

// 播放列表
await api.player.setPlaylist(tracks, 0);
const playlist = api.player.getPlaylist();

// 播放模式
await api.player.setPlayMode('shuffle');
const mode = api.player.getPlayMode();

// 状态查询
const state = api.player.getState();
const track = api.player.getCurrentTrack();

// 事件监听
api.player.onTrackChanged((track) => {
    console.log('歌曲变化:', track);
});

api.player.onPlaybackStateChanged((state) => {
    console.log('播放状态:', state);
});
```

### Library API

音乐库管理。

```javascript
// 获取歌曲
const tracks = api.library.getAllTracks();
const track = api.library.getTrackById('track-id');

// 搜索
const results = await api.library.searchTracks('关键词');

// 添加/删除歌曲
await api.library.addTrack(track);
await api.library.removeTrack('track-id');
await api.library.updateTrack('track-id', { title: '新标题' });

// 专辑和艺术家
const albums = api.library.getAlbums();
const album = api.library.getAlbumByName('专辑名');
const artists = api.library.getArtists();
const artist = api.library.getArtistByName('艺术家名');

// 播放列表管理
const playlists = api.library.getPlaylists();
const playlist = api.library.getPlaylistById('playlist-id');
const newPlaylist = await api.library.createPlaylist('我的播放列表', tracks);
await api.library.updatePlaylist('playlist-id', { name: '新名称' });
await api.library.deletePlaylist('playlist-id');
```

### UI API

用户界面交互。

```javascript
// 通知
api.ui.showInformationMessage('信息');
api.ui.showSuccessMessage('成功');
api.ui.showWarningMessage('警告');
api.ui.showErrorMessage('错误');

// 对话框
const confirmed = await api.ui.showConfirmDialog('确认删除吗？');

// 输入框
const input = await api.ui.showInputBox({
    prompt: '请输入名称',
    placeholder: '播放列表名称'
});

const theme = api.ui.getCurrentTheme();
api.ui.setTheme('dark');
api.ui.toggleTheme();

const e = api.ui.onThemeChanged((themeName) => {
    console.log(themeName);
});


```

### Storage API

数据持久化存储。

```javascript
// 全局存储
await api.storage.update('key', 'value');
const value = api.storage.get('key', 'default');
await api.storage.delete('key');
const keys = api.storage.keys();

// 工作区存储
await api.storage.updateWorkspace('key', 'value');
const value = api.storage.getWorkspace('key', 'default');
await api.storage.deleteWorkspace('key');
const keys = api.storage.workspaceKeys();
```

### Settings API

应用设置管理。

```javascript
// 读取设置
const value = api.settings.get('section.key', 'default');

// 修改设置
await api.settings.set('section.key', 'value');

// 删除设置
await api.settings.delete('section.key');

// 检查设置是否存在
const exists = api.settings.has('section.key');

// 获取所有设置键
const keys = api.settings.keys();

// 监听设置变化
const disposable = api.settings.onDidChange('section.key', (event) => {
    console.log('设置变化:', event.newValue);
});
```

### Commands API

命令注册和执行。

```javascript
// 注册命令
const disposable = api.commands.registerCommand('myext.command', (...args) => {
    console.log('命令执行:', args);
    return 'result';
}, {
    title: '我的命令',
    category: '扩展'
});

// 执行命令
const result = await api.commands.executeCommand('myext.command', arg1, arg2);

// 查询命令
const exists = api.commands.hasCommand('myext.command');
const info = api.commands.getCommandInfo('myext.command');
const allCommands = api.commands.getCommands();

// 启用/禁用命令
api.commands.enableCommand('myext.command');
api.commands.disableCommand('myext.command');
```

### Events API

事件监听和触发。

```javascript
// 监听事件
const disposable = api.events.on('eventName', (data) => {
    console.log('事件触发:', data);
});

// 一次性监听
api.events.once('eventName', (data) => {
    console.log('事件触发（仅一次）:', data);
});

// 触发事件
api.events.emit('eventName', { key: 'value' });

// 移除监听器
api.events.off('eventName', callback);
api.events.removeAllListeners('eventName');
```

### Views API

自定义视图管理。

```javascript
// 注册视图
const disposable = api.views.registerView('myext.view', {
    render() {
        return '<div>我的视图</div>';
    }
});

// 注册视图容器
api.views.registerViewContainer('myext.container', {
    title: '我的容器',
    icon: 'icon-path'
});

// 创建树视图
const treeView = api.views.createTreeView('myext.tree', {
    treeDataProvider: {
        getChildren(element) {
            return element ? element.children : rootElements;
        }
    }
});

// 注册 Webview 视图
api.views.registerWebviewViewProvider('myext.webview', {
    resolveWebviewView(webviewView) {
        webviewView.webview.html = '<h1>Hello</h1>';
    }
});
```

### Diagnostics API

诊断信息管理。

```javascript
// 创建诊断集合
const collection = api.diagnostics.createDiagnosticCollection('myext');

// 设置诊断
collection.set('file:///path/to/file.js', [
    {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        message: '错误信息',
        severity: DiagnosticSeverity.ERROR
    }
]);

// 获取诊断
const diagnostics = collection.get('file:///path/to/file.js');

// 清空诊断
collection.clear();

// 释放集合
collection.dispose();
```

### Tasks API

后台任务管理。

```javascript
// 创建任务
const task = api.tasks.createTask('我的任务', async (progress, token) => {
    progress.report({ message: '开始处理...' });
    
    for (let i = 0; i <= 100; i += 10) {
        if (token.isCancellationRequested) {
            throw new Error('任务已取消');
        }
        
        progress.report({ 
            increment: 10, 
            message: `处理中 ${i}%` 
        });
        
        await doWork();
    }
    
    return '任务完成';
}, {
    cancellable: true,
    showProgress: true
});

// 执行任务
const result = await task.execute();

// 监听任务状态
task.onDidChangeState((state) => {
    console.log('任务状态:', state);
});

// 取消任务
task.cancel();
```

### Navigation API

应用内导航。

```javascript
// 导航到视图
api.navigation.navigateToView('library');

// 返回/前进
api.navigation.goBack();
api.navigation.goForward();

// 获取当前视图
const currentView = api.navigation.getCurrentView();
```

### Network API

网络请求。

```javascript
// 基础请求
const response = await api.network.fetch('https://api.example.com/data');

// GET 请求
const data = await api.network.get('https://api.example.com/data');

// POST 请求
const result = await api.network.post('https://api.example.com/data', {
    key: 'value'
});

// PUT 请求
await api.network.put('https://api.example.com/data/1', {
    key: 'new-value'
});

// DELETE 请求
await api.network.delete('https://api.example.com/data/1');

// 下载文件
const blob = await api.network.downloadFile('https://example.com/file.mp3');
```

### System API

系统信息和环境。

```javascript
// 获取版本和平台
const version = await api.system.getVersion();
const platform = await api.system.getPlatform();
const os = await api.system.getOS();

// 获取路径
const appPath = await api.system.getAppPath();
const userDataPath = await api.system.getUserDataPath();
const tempPath = await api.system.getTempPath();

// 获取语言
const language = api.system.getLanguage();

// 检查开发模式
const isDev = api.system.isDevelopment();

// 环境变量
const env = api.system.getEnv('NODE_ENV');

// 打开外部链接
await api.system.openExternal('https://example.com');

// 显示文件
await api.system.showItemInFolder('/path/to/file');

// 剪贴板
const text = await api.system.getClipboardText();
await api.system.setClipboardText('复制的文本');
```

### Window API

窗口控制。

```javascript
// 获取版本和平台
await api.window.maximize();
await api.window.minimize();
await api.window.close();

const isMax = await api.window.isMaximized();
const position = await api.window.getPosition();
const size = await api.window.getSize();
const obj = await api.window.setSize();

await api.window.onMaximizedChanged((isMaximized) => {
    console.log(isMaximized);
});
```

### Keybindings API

快捷键。

```javascript
// 注册局部快捷键（仅在应用窗口激活时生效）
const disposable = await api.keybindings.registerKeybinding('Ctrl+Shift+P', () => {
    console.log('快捷键触发');
    api.ui.showNotification('快捷键已触发', 'info');
}, {
    commandId: 'myExtension.command',
    description: '打开命令面板',
    when: 'always'  // 上下文条件
});

context.subscriptions.add(disposable);

// 注册全局快捷键（系统级，即使应用未激活也生效）
const globalDisposable = await api.keybindings.registerGlobalKeybinding('Alt+Ctrl+M', () => {
    console.log('全局快捷键触发');
}, {
    id: 'globalCtrl',
    name: '控制音乐',
    description: '全局音乐控制'
});

context.subscriptions.add(globalDisposable);

// 获取所有已注册的快捷键
const keybindings = api.keybindings.getKeybindings();

// 检查快捷键是否已注册
const hasKeybinding = api.keybindings.hasKeybinding('Ctrl+Shift+P');

// 模拟触发快捷键
await api.keybindings.triggerKeybinding('Ctrl+Shift+P');
```

## 🛡️ 错误处理

所有 API 都包含统一的错误处理机制：

```javascript
try {
    await api.player.play(track);
} catch (error) {
    if (error instanceof ValidationError) {
        console.error('参数验证失败:', error.message);
    } else if (error instanceof NotAvailableError) {
        console.error('功能不可用:', error.message);
    } else if (error instanceof NotFoundError) {
        console.error('资源未找到:', error.message);
    } else {
        console.error('未知错误:', error.message);
    }
}
```

## 📝 类型提示

虽然使用 JavaScript，但所有 API 都包含完整的 JSDoc 注释，提供类型提示：

```javascript
/**
 * @param {string} commandId - 命令 ID
 * @param {Function} callback - 回调函数
 * @param {Object} [options={}] - 命令选项
 * @returns {Disposable} 可释放对象
 */
registerCommand(commandId, callback, options = {}) {
    // ...
}
```

## 🔧 最佳实践

1. **总是清理资源**：使用 `context.subscriptions.add()` 管理 Disposable 对象
2. **错误处理**：使用 try-catch 捕获异步操作的错误
3. **参数验证**：API 会自动验证参数，但建议在调用前进行检查
4. **事件监听**：记得在扩展停用时移除事件监听器
5. **异步操作**：使用 async/await 处理异步 API

## 🔗 相关文档

- [插件系统架构](../docs/Architecture.md)
- [插件开发指南](../docs/PluginSystemGuide.md)
