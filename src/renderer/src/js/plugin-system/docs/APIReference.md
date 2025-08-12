# MusicBox 插件 API 参考

## 🎯 核心API

### PluginBase 基类

所有插件都应该继承 `PluginBase` 类：

```javascript
class MyPlugin extends PluginBase {
    constructor(context) {
        super(context);
        // 插件初始化代码
    }
    
    async activate() {
        await super.activate();
        // 插件激活代码
    }
    
    async deactivate() {
        await super.deactivate();
        // 插件停用代码
    }
}
```

#### 生命周期方法

| 方法 | 描述 | 必需 |
|------|------|------|
| `constructor(context)` | 插件构造函数 | 是 |
| `activate()` | 插件激活时调用 | 是 |
| `deactivate()` | 插件停用时调用 | 否 |
| `dispose()` | 清理资源 | 否 |

#### 基础属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `id` | string | 插件唯一标识符 |
| `name` | string | 插件显示名称 |
| `version` | string | 插件版本号 |
| `isActive` | boolean | 插件是否激活 |
| `context` | object | 插件上下文对象 |

## 🎵 音乐播放API

### Player API

```javascript
// 播放控制
await this.context.player.play();
await this.context.player.pause();
await this.context.player.stop();
await this.context.player.next();
await this.context.player.previous();

// 音量控制
await this.context.player.setVolume(0.8);
const volume = await this.context.player.getVolume();

// 播放位置
await this.context.player.seek(60); // 跳转到60秒
const position = await this.context.player.getPosition();
const duration = await this.context.player.getDuration();

// 播放列表
const playlist = await this.context.player.getPlaylist();
await this.context.player.setPlaylist(tracks, startIndex);

// 状态查询
const isPlaying = await this.context.player.isPlaying();
const currentTrack = await this.context.player.getCurrentTrack();
```

### 播放事件监听

```javascript
// 曲目变化
this.context.player.onTrackChanged((track) => {
    console.log('当前曲目:', track);
});

// 播放状态变化
this.context.player.onPlaybackStateChanged((isPlaying) => {
    console.log('播放状态:', isPlaying);
});

// 播放位置变化
this.context.player.onPositionChanged((position) => {
    console.log('播放位置:', position);
});
```

## 📚 音乐库API

### Library API

```javascript
// 获取音乐数据
const tracks = await this.context.library.getTracks({
    limit: 100,
    offset: 0,
    sortBy: 'title',
    sortOrder: 'asc'
});

const albums = await this.context.library.getAlbums();
const artists = await this.context.library.getArtists();

// 搜索
const results = await this.context.library.search('搜索关键词');

// 扫描目录
await this.context.library.scanDirectory('/path/to/music');

// 获取元数据
const metadata = await this.context.library.getTrackMetadata('/path/to/file.mp3');
```

### 库事件监听

```javascript
// 库更新
this.context.library.onLibraryUpdated((tracks) => {
    console.log('音乐库已更新:', tracks.length);
});

// 扫描进度
this.context.library.onScanProgress((progress) => {
    console.log('扫描进度:', progress);
});
```

## 🎨 UI扩展API

### 基础UI操作

```javascript
// 创建元素
const element = this.createElement('div', {
    className: 'my-element',
    innerHTML: '内容'
}, [childElement1, childElement2]);

// 添加样式
this.addStyle(`
    .my-element {
        color: red;
        background: blue;
    }
`);

// 显示通知
this.showNotification('消息', 'success', 3000);
```

### 侧边栏扩展

```javascript
const itemId = this.addSidebarItem({
    id: 'my-page',
    name: '我的页面',
    icon: '🔌',
    order: 100,
    onClick: () => {
        this.showMyPage();
    }
});
```

### 设置页面扩展

```javascript
const sectionId = this.addSettingsSection({
    id: 'my-settings',
    title: '我的设置',
    items: [
        {
            type: 'toggle',
            id: 'my-toggle',
            label: '开关设置',
            description: '描述信息',
            value: true,
            onChange: (value) => {
                this.setStorage('toggleValue', value);
            }
        },
        {
            type: 'select',
            id: 'my-select',
            label: '选择设置',
            description: '选择一个选项',
            value: 'option1',
            options: [
                { value: 'option1', label: '选项1' },
                { value: 'option2', label: '选项2' }
            ],
            onChange: (value) => {
                this.setStorage('selectValue', value);
            }
        },
        {
            type: 'button',
            id: 'my-button',
            label: '按钮设置',
            description: '点击执行操作',
            buttonText: '执行',
            onClick: () => {
                this.executeAction();
            }
        }
    ]
});
```

### 右键菜单扩展

```javascript
const menuItemId = this.addContextMenuItem({
    id: 'my-action',
    label: '我的操作',
    icon: '🔌',
    onClick: (context) => {
        console.log('右键菜单上下文:', context);
        this.handleContextAction(context);
    }
});
```

## 💾 存储API

### 插件专用存储

```javascript
// 设置数据
this.setStorage('key', { complex: 'data' });

// 获取数据
const data = this.getStorage('key');

// 移除数据
this.removeStorage('key');
```

### 全局存储

```javascript
// 访问应用设置
const setting = this.context.settings.get('settingKey', defaultValue);
this.context.settings.set('settingKey', value);

// 访问缓存管理器
const cached = this.context.storage.get('cacheKey');
this.context.storage.set('cacheKey', value);
```

## 🔧 命令系统

### 注册命令

```javascript
this.registerCommand('myCommand', (arg1, arg2) => {
    console.log('命令执行:', arg1, arg2);
    return '命令结果';
});
```

### 执行命令

```javascript
// 执行自己的命令
const result = await this.context.utils.executeCommand(`${this.id}.myCommand`, 'arg1', 'arg2');

// 执行其他插件的命令
const result = await this.context.utils.executeCommand('other-plugin.someCommand');
```

## 🌐 系统集成

### 文件系统访问

```javascript
// 读取文件
const content = await this.fs.readFile('/path/to/file.txt', 'utf8');

// 写入文件
await this.fs.writeFile('/path/to/file.txt', 'content');

// 列出目录
const files = await this.fs.readdir('/path/to/directory');

// 检查文件存在
const exists = await this.fs.exists('/path/to/file');
```

### 路径操作

```javascript
const fullPath = this.path.join('/base', 'subdir', 'file.txt');
const dirname = this.path.dirname('/path/to/file.txt');
const basename = this.path.basename('/path/to/file.txt');
const extname = this.path.extname('/path/to/file.txt');
```

### 系统信息

```javascript
const platform = this.os.platform(); // 'win32', 'darwin', 'linux'
const arch = this.os.arch(); // 'x64', 'arm64'
const homedir = this.os.homedir();
const tmpdir = this.os.tmpdir();
```

## 🔄 热重载

开发模式下支持热重载：

```javascript
// 启用开发模式
window.pluginDevTools.enable();

// 重载插件
window.pluginDev.reload('plugin-id');
```

## ⚠️ 注意事项

1. **资源清理**: 确保在 `deactivate` 方法中清理所有资源
2. **错误处理**: 使用 try-catch 处理可能的错误
3. **性能考虑**: 避免阻塞主线程的操作
4. **安全性**: 谨慎使用系统API，避免恶意操作
5. **兼容性**: 检查API可用性，提供降级方案

## 📚 更多资源

- [插件开发模板](../templates/)
- [示例插件](../examples/)
- [API类型定义](./TypeDefinitions.md)
- [常见问题](./FAQ.md)
