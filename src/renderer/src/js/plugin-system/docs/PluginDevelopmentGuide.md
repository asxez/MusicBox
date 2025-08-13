# MusicBox 插件开发指南

## 📖 概述

MusicBox 插件系统是一个高权限、灵活的扩展框架，允许第三方开发者为 MusicBox 音乐播放器添加新功能和增强现有功能。插件系统提供了完整的API接口，支持音乐播放控制、音乐库管理、UI扩展、系统交互等功能。

## 🏗️ 插件架构

### 核心组件

1. **PluginManager** - 插件生命周期管理，负责插件的安装、加载、卸载和状态管理
2. **PluginLoader** - 动态加载插件脚本，支持热重载和多种插件格式
3. **PluginAPI** - 提供标准化API接口，包含9个核心命名空间
4. **PluginBase** - 插件基类，提供标准的生命周期方法和工具函数

请注意：开发插件时，若遇到问题，请
1. 查看 PluginAPI 下的 initializeCoreAPIs 方法，
此方法注册了 context 中大量的核心接口，createPluginContext 方法则是创建上下文（context）的总方法，所有 context 都在这里创建。
2. 查看 PluginBase 类，这是所有插件的基类，可查看其内置的接口。

3. 查看示例插件

ThemeSwitcherPlugin.js => 主要是ui和storage

SettingsNavigationTestPlugin.js => 主要是settings和navigation以及事件监听等

RealtimeStatusAPIPlugin.js => 主要是network, system, api和事件监听等。

- [示例插件](../examples/)
- [类型定义文件](./TypeDefinitions.js)

### 插件生命周期

```
安装 → 启用 → 加载 → 激活 → 运行 → 停用 → 卸载
```

**详细说明：**
- **安装**: 将插件配置添加到系统中
- **启用**: 标记插件为可用状态
- **加载**: 动态加载插件脚本文件
- **激活**: 调用插件的 `activate()` 方法
- **运行**: 插件正常工作状态
- **停用**: 调用插件的 `deactivate()` 方法
- **卸载**: 从系统中完全移除插件

## 🚀 快速开始

### 1. 创建基础插件

```javascript
class MyPlugin extends PluginBase {
    constructor(context) {
        super(context);
        console.log('🔌 MyPlugin: 插件构造完成');
    }

    async activate() {
        await super.activate();

        // 显示激活通知
        this.showNotification('我的插件已激活！', 'success');

        // 获取当前播放的音乐
        const currentTrack = await this.context.player.getCurrentTrack();
        if (currentTrack) {
            console.log('当前播放:', currentTrack.title);
        }

        // 监听音乐变化
        this.context.player.onTrackChanged((track) => {
            console.log('音乐切换到:', track.title);
        });
    }

    async deactivate() {
        await super.deactivate();
        console.log('🔌 MyPlugin: 插件已停用');
    }
}

// 导出插件类
window.PluginClass = MyPlugin;
```

### 2. 插件信息

```javascript
class ThemeSwitcherPlugin extends PluginBase {
    constructor(context) {
        super(context);

        // 插件元数据
        this.metadata = {
            id: 'theme-switcher',
            name: '主题切换器',
            version: '六百六十六',
            description: '提供多种预设主题和自定义主题功能，支持实时切换和主题导入导出',
            author: 'MusicBox-ASXE',
            permissions: ['ui', 'settings', 'storage'],
            category: '界面增强'
        };
    }
}
```

## 🔧 API 参考

MusicBox 插件系统提供了9个核心API命名空间，每个命名空间都包含特定功能的方法和事件。

### 1. Player API - 音乐播放控制

```javascript
// 播放控制
await this.context.player.play();           // 播放
await this.context.player.pause();          // 暂停
await this.context.player.stop();           // 停止
await this.context.player.next();           // 下一首
await this.context.player.previous();       // 上一首

// 音量控制
await this.context.player.setVolume(0.8);   // 设置音量 (0-1)
const volume = await this.context.player.getVolume();

// 播放位置控制
await this.context.player.seek(60);         // 跳转到60秒
const position = await this.context.player.getPosition();
const duration = await this.context.player.getDuration();

// 播放列表管理
const playlist = await this.context.player.getPlaylist();
await this.context.player.setPlaylist(tracks, startIndex);

// 状态查询
const isPlaying = await this.context.player.isPlaying();
const currentTrack = await this.context.player.getCurrentTrack();

// 事件监听
this.context.player.onTrackChanged((track) => {
    console.log('当前播放:', track.title, '-', track.artist);
});

this.context.player.onPlaybackStateChanged((isPlaying) => {
    console.log('播放状态:', isPlaying ? '播放中' : '已暂停');
});

this.context.player.onPositionChanged((position) => {
    console.log('播放进度:', Math.floor(position), '秒');
});
```

### 2. Library API - 音乐库管理

```javascript
// 获取音乐数据
const tracks = await this.context.library.getTracks();
const albums = await this.context.library.getAlbums();
const artists = await this.context.library.getArtists();

// 搜索功能
const searchResults = await this.context.library.search('周杰伦');

// 扫描音乐目录
const success = await this.context.library.scanDirectory('/path/to/music');

// 获取音乐元数据
const metadata = await this.context.library.getTrackMetadata('/path/to/song.mp3');

// 监听音乐库变化
this.context.library.onLibraryUpdated((tracks) => {
    console.log('音乐库已更新，共', tracks.length, '首歌曲');
});

// 监听扫描进度
this.context.library.onScanProgress((progress) => {
    console.log('扫描进度:', progress.current, '/', progress.total);
});
```

### 3. UI API - 用户界面扩展

```javascript
// 显示通知
this.context.ui.showNotification('操作成功！', 'success', 3000);
this.context.ui.showNotification('警告信息', 'warning');
this.context.ui.showNotification('错误信息', 'error');

// 创建DOM元素
const button = this.context.ui.createElement('button', {
    className: 'my-button',
    textContent: '点击我',
    onclick: () => console.log('按钮被点击')
});

// 添加CSS样式
this.context.ui.addCSS(this.id, `
    .my-button {
        background: #007acc;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    }
    .my-button:hover {
        background: #005a9e;
    }
`);

// 移除CSS样式
this.context.ui.removeCSS(this.id);

// 获取应用组件
const playerComponent = this.context.ui.getComponent('player');

// 显示对话框
this.context.ui.showDialog({
    title: '确认操作',
    message: '您确定要执行此操作吗？',
    buttons: ['确定', '取消']
});
```

### 4. Navigation API - 导航管理

```javascript
// 添加导航项
const itemId = this.context.navigation.addItem(this.id, {
    id: 'my-page',
    name: '我的页面',
    icon: '🔌',
    order: 100,
    onClick: () => {
        console.log('导航到我的页面');
        this.showMyPage();
    }
});

// 移除导航项
this.context.navigation.removeItem(this.id, itemId);

// 获取当前视图
const currentView = this.context.navigation.getCurrentView();

// 导航到指定视图
this.context.navigation.navigateTo('library');
```

### 5. Settings API - 设置管理

```javascript
// 获取设置值
const theme = this.context.settings.get('theme', 'dark');
const volume = this.context.settings.get('volume', 0.8);

// 设置值
this.context.settings.set('theme', 'light');
this.context.settings.set('volume', 0.6);

// 添加设置部分
const sectionId = this.context.settings.addSection(this.id, {
    id: 'my-settings',
    title: '我的插件设置',
    items: [
        {
            type: 'toggle',
            id: 'enabled',
            label: '启用功能',
            description: '是否启用此功能',
            value: true,
            onChange: (value) => console.log('设置变更:', value)
        },
        {
            type: 'select',
            id: 'mode',
            label: '工作模式',
            options: [
                { value: 'auto', label: '自动' },
                { value: 'manual', label: '手动' }
            ],
            value: 'auto'
        }
    ]
});

// 移除设置部分
this.context.settings.removeSection(this.id, sectionId);
```

### 6. ContextMenu API - 右键菜单

```javascript
// 添加右键菜单项
const menuId = this.context.contextMenu.addItem(this.id, {
    id: 'my-action',
    label: '我的操作',
    icon: '⚡',
    contexts: ['track', 'playlist'],  // 在哪些上下文中显示
    onClick: (context) => {
        console.log('右键菜单点击:', context);
        // context 包含被右键点击的对象信息
    }
});

// 移除右键菜单项
this.context.contextMenu.removeItem(this.id, menuId);
```

### 7. Storage API - 数据存储

```javascript
// 基本存储操作
this.context.storage.set('user-preference', { theme: 'dark', lang: 'zh' });
const preference = this.context.storage.get('user-preference');
this.context.storage.remove('old-data');
this.context.storage.clear(); // 清空所有存储-不建议使用

// 插件专用存储（推荐使用）
this.setStorage('my-data', { count: 10, items: [] });
const myData = this.getStorage('my-data', { count: 0, items: [] }); // 可传默认值，若无则返回默认值
this.removeStorage('my-data');
```

### 8. System API - 系统交互（高权限）
```javascript
// 以下为允许的系统接口
const OS_ALLOWED = [
    'platform', 'type', 'arch', 'release',
    'uptime', 'freemem', 'totalmem', 'cpus', 'loadavg', 'endianness'
];

const PATH_ALLOWED = [
    'join', 'resolve', 'normalize', 'basename', 'dirname',
    'extname', 'isAbsolute', 'relative', 'parse', 'format', 'sep'
];

const FS_ALLOWED = [
    'stat', 'lstat', 'readdir', 'readFile', 'realpath', 'access'
];
```

```javascript
// 文件系统操作
const fs = this.context.system.fs;
const files = await fs.fs.readFileSync('/path/to/directory');
const stats = await fs.stat('/path/to/file.txt');
const content = await fs.readFile('/path/to/file.txt', 'utf8');

// 路径操作
const path = this.context.system.path();
const fullPath = path.join('/base', 'subfolder', 'file.txt');
const dirname = path.dirname('/path/to/file.txt');
const basename = path.basename('/path/to/file.txt');

// 操作系统信息
const os = this.context.system.os;
const platform = await os.platform();      // 'win32', 'darwin', 'linux'
const arch = await os.arch();              // 'x64', 'arm64'
const cpus = await os.cpus();              // CPU信息
const totalMem = await os.totalmem();      // 总内存
const freeMem = await os.freemem();        // 可用内存

// 文件对话框
const directory = await this.context.system.openDirectory();
const files = await this.context.system.openFiles();
```

### 9. Events API - 事件系统

```javascript
// 发送事件
this.context.events.emit('my-plugin-event', { data: 'hello' });

// 监听事件
this.context.events.on('trackChanged', (track) => {
    console.log('歌曲变化:', track.title);
});

// 取消监听
const handler = (track) => console.log(track);
this.context.events.on('trackChanged', handler);
this.context.events.off('trackChanged', handler);

// 监听应用级事件
this.context.events.on('app:ready', () => {
    console.log('应用已准备就绪');
});

this.context.events.on('library:updated', (tracks) => {
    console.log('音乐库更新:', tracks.length, '首歌曲');
});
```

## 📝 完整示例

### 示例1：音乐统计插件

```javascript
class MusicStatsPlugin extends PluginBase {
    constructor(context) {
        super(context);
        this.playCount = 0;
        this.totalPlayTime = 0;
        this.startTime = null;
    }

    async activate() {
        await super.activate();

        // 加载保存的统计数据
        const savedStats = this.getStorage('stats', { playCount: 0, totalPlayTime: 0 });
        this.playCount = savedStats.playCount;
        this.totalPlayTime = savedStats.totalPlayTime;

        // 监听播放事件
        this.context.player.onTrackChanged((track) => {
            this.playCount++;
            this.saveStats();
            this.showNotification(`已播放 ${this.playCount} 首歌曲`, 'info');
        });

        this.context.player.onPlaybackStateChanged((isPlaying) => {
            if (isPlaying) {
                this.startTime = Date.now();
            } else if (this.startTime) {
                this.totalPlayTime += Date.now() - this.startTime;
                this.startTime = null;
                this.saveStats();
            }
        });

        // 添加导航项
        this.context.navigation.addItem(this.id, {
            id: 'stats-page',
            name: '音乐统计',
            icon: '📊',
            onClick: () => this.showStatsPage()
        });

        this.showNotification('音乐统计插件已启动', 'success');
    }

    saveStats() {
        this.setStorage('stats', {
            playCount: this.playCount,
            totalPlayTime: this.totalPlayTime
        });
    }

    showStatsPage() {
        const hours = Math.floor(this.totalPlayTime / (1000 * 60 * 60));
        const minutes = Math.floor((this.totalPlayTime % (1000 * 60 * 60)) / (1000 * 60));

        this.context.ui.showDialog({
            title: '音乐统计',
            message: `
                播放歌曲数: ${this.playCount} 首
                总播放时长: ${hours}小时${minutes}分钟
            `
        });
    }

    async deactivate() {
        this.saveStats();
        this.context.navigation.removeItem(this.id, 'stats-page');
        await super.deactivate();
    }
}

window.PluginClass = MusicStatsPlugin;
```

### 示例2：歌词显示插件

```javascript
class LyricsDisplayPlugin extends PluginBase {
    constructor(context) {
        super(context);
        this.lyricsPanel = null;
        this.currentTrack = null;
    }

    async activate() {
        await super.activate();

        // 创建歌词显示面板
        this.createLyricsPanel();

        // 监听音乐变化
        this.context.player.onTrackChanged(async (track) => {
            this.currentTrack = track;
            await this.loadLyrics(track);
        });

        // 监听播放位置变化
        this.context.player.onPositionChanged((position) => {
            this.highlightCurrentLyric(position);
        });

        this.showNotification('歌词显示插件已启动', 'success');
    }

    createLyricsPanel() {
        // 添加CSS样式
        this.context.ui.addCSS(this.id, `
            .lyrics-panel {
                position: fixed;
                right: 20px;
                top: 100px;
                width: 300px;
                height: 400px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 8px;
                overflow-y: auto;
                z-index: 1000;
            }
            .lyrics-line {
                margin: 10px 0;
                transition: color 0.3s;
            }
            .lyrics-line.current {
                color: #007acc;
                font-weight: bold;
            }
        `);

        // 创建面板元素
        this.lyricsPanel = this.context.ui.createElement('div', {
            className: 'lyrics-panel',
            innerHTML: '<div>暂无歌词</div>'
        });

        document.body.appendChild(this.lyricsPanel);
    }

    async loadLyrics(track) {
        try {
            // 这里可以调用歌词API或读取本地歌词文件
            const lyrics = await this.fetchLyrics(track);
            this.displayLyrics(lyrics);
        } catch (error) {
            this.lyricsPanel.innerHTML = '<div>歌词加载失败</div>';
        }
    }

    async fetchLyrics(track) {
        // 模拟歌词获取
        return [
            { time: 0, text: track.title },
            { time: 5, text: '演唱：' + track.artist },
            { time: 10, text: '暂无歌词内容...' }
        ];
    }

    displayLyrics(lyrics) {
        const lyricsHTML = lyrics.map((line, index) =>
            `<div class="lyrics-line" data-time="${line.time}" data-index="${index}">
                ${line.text}
            </div>`
        ).join('');

        this.lyricsPanel.innerHTML = lyricsHTML;
    }

    highlightCurrentLyric(position) {
        const lines = this.lyricsPanel.querySelectorAll('.lyrics-line');
        lines.forEach(line => {
            const time = parseFloat(line.dataset.time);
            if (position >= time) {
                line.classList.add('current');
            } else {
                line.classList.remove('current');
            }
        });
    }

    async deactivate() {
        if (this.lyricsPanel) {
            this.lyricsPanel.remove();
        }
        this.context.ui.removeCSS(this.id);
        await super.deactivate();
    }
}

window.PluginClass = LyricsDisplayPlugin;
```

## 🎯 最佳实践

### 1. 插件结构组织

目前只能加载单个js文件。

### 2. 错误处理

```javascript
class MyPlugin extends PluginBase {
    async activate() {
        try {
            await super.activate();

            // 插件逻辑
            await this.initializeFeatures();

        } catch (error) {
            console.error('插件激活失败:', error);
            this.showNotification('插件启动失败: ' + error.message, 'error');
            throw error; // 重新抛出错误，让插件管理器知道失败
        }
    }

    async initializeFeatures() {
        // 使用 try-catch 包装可能失败的操作
        try {
            const data = await this.context.library.getTracks();
            this.processData(data);
        } catch (error) {
            console.warn('获取音乐库数据失败:', error);
            // 提供降级方案
            this.useDefaultData();
        }
    }
}
```

### 3. 资源清理

```javascript
class MyPlugin extends PluginBase {
    constructor(context) {
        super(context);
        this.eventListeners = [];
        this.timers = [];
        this.domElements = [];
    }

    async activate() {
        await super.activate();

        // 记录事件监听器
        const handler = (track) => this.onTrackChanged(track);
        this.context.player.onTrackChanged(handler);
        this.eventListeners.push({ type: 'trackChanged', handler });

        // 记录定时器
        const timer = setInterval(() => this.updateStatus(), 1000);
        this.timers.push(timer);

        // 记录DOM元素
        const element = this.context.ui.createElement('div');
        document.body.appendChild(element);
        this.domElements.push(element);
    }

    async deactivate() {
        // 清理事件监听器
        this.eventListeners.forEach(({ type, handler }) => {
            this.context.player[`off${type.charAt(0).toUpperCase() + type.slice(1)}`]?.(handler);
        });
        this.eventListeners = [];

        // 清理定时器
        this.timers.forEach(timer => clearInterval(timer));
        this.timers = [];

        // 清理DOM元素
        this.domElements.forEach(element => element.remove());
        this.domElements = [];

        await super.deactivate();
    }
}
```

### 4. 性能优化

```javascript
class MyPlugin extends PluginBase {
    constructor(context) {
        super(context);
        // 使用防抖避免频繁更新
        this.updateUI = this.debounce(this.updateUI.bind(this), 100);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async activate() {
        await super.activate();

        // 使用节流避免过度监听
        this.context.player.onPositionChanged(
            this.throttle((position) => this.onPositionChanged(position), 500)
        );
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
}
```

### 5. 数据持久化

```javascript
class MyPlugin extends PluginBase {
    async activate() {
        await super.activate();

        // 加载配置
        this.config = this.getStorage('config', {
            enabled: true,
            theme: 'dark',
            updateInterval: 1000
        });

        // 监听配置变化
        this.on('configChanged', (newConfig) => {
            this.config = { ...this.config, ...newConfig };
            this.setStorage('config', this.config);
            this.applyConfig();
        });
    }

    updateConfig(updates) {
        this.emit('configChanged', updates);
    }

    applyConfig() {
        // 根据配置更新插件行为
        if (this.config.enabled) {
            this.startFeature();
        } else {
            this.stopFeature();
        }
    }
}
```

## ❓ 常见问题

### Q: 插件无法加载怎么办？

**A:** 检查以下几点：
1. 检查主入口文件路径是否正确
2. 确保插件正确继承自 `PluginBase`
3. 确保插件类正确导出到 `window.PluginClass`
4. 应用中按 ctrl+shift+i 调出浏览器控制台，查看错误信息

### Q: 如何调试插件？

**A:**
1. 使用 `console.log()` 输出调试信息
2. 在浏览器开发者工具中设置断点，可按 ctrl+shift+i 打开控制台
3. 使用 `this.showNotification()` 显示状态信息
4. 检查插件管理器的日志输出

### Q: 插件权限不足怎么办？

**A:**
1. 检查插件配置中的 `permissions` 字段
2. 确保请求了必要的权限：`ui`, `player`, `library`, `storage`, `system`
3. 系统API需要 `system` 权限

### Q: 如何与其他插件通信？

**A:**
使用事件系统：
```javascript
// 发送事件
this.context.events.emit('my-plugin:data-updated', data);

// 监听事件
this.context.events.on('other-plugin:event', (data) => {
    console.log('收到其他插件的数据:', data);
});
```

### Q: 插件卸载后如何清理数据？

**A:**
在 `deactivate()` 方法中进行清理：
```javascript
async deactivate() {
    // 清理存储数据
    this.removeStorage('temp-data');

    // 清理UI元素
    this.context.ui.removeCSS(this.id);

    // 清理事件监听器
    this.removeAllListeners();

    await super.deactivate();
}
```

## 📚 参考资源

- [类型定义文件](./TypeDefinitions.js)
- [示例插件](../examples/)

## 🤝 贡献指南

欢迎为 MusicBox 贡献插件

链接插件的方式：发布插件到你的 GitHub 仓库，在 MusicBox 中提一个 issue，我会将你的插件仓库链接到本仓库首页。

插件系统目前并不完善，欢迎提交bug、特性或者你的代码！
