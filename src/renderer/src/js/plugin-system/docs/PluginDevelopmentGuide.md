# MusicBox 插件开发指南

## 📖 概述

MusicBox 插件系统是一个高权限、灵活的扩展框架，允许第三方开发者为 MusicBox 音乐播放器添加新功能和增强现有功能。

## 🏗️ 插件架构

### 核心组件

1. **PluginManager** - 插件生命周期管理
2. **PluginLoader** - 动态加载插件脚本
3. **PluginAPI** - 提供标准化API接口
4. **PluginBase** - 插件基类，所有插件都应继承

### 插件生命周期

```
安装 → 启用 → 激活 → 运行 → 停用 → 卸载
```

## 🚀 快速开始

### 1. 创建基础插件

```javascript
class MyPlugin extends PluginBase {
    async activate() {
        await super.activate();
        this.showNotification('我的插件已激活！', 'success');
    }
    
    async deactivate() {
        await super.deactivate();
    }
}

// 导出插件类
window.PluginClass = MyPlugin;
```

### 2. 插件配置文件

```json
{
    "id": "my-plugin",
    "name": "我的插件",
    "version": "1.0.0",
    "description": "这是我的第一个插件",
    "author": "作者",
    "main": "index.js",
    "permissions": ["ui", "audio", "storage"],
    "dependencies": []
}
```

## 🔧 API 参考

### 核心API

#### 应用访问
```javascript
// 获取应用实例
const app = this.getApp();

// 获取API实例
const api = this.getAPI();

// 获取组件
const player = this.getComponent('player');
const settings = this.getComponent('settings');
```

#### 音乐播放API
```javascript
// 播放控制
await this.context.player.play();
await this.context.player.pause();
await this.context.player.next();
await this.context.player.previous();

// 获取播放信息
const currentTrack = await this.context.player.getCurrentTrack();
const isPlaying = await this.context.player.isPlaying();
const position = await this.context.player.getPosition();

// 监听播放事件
this.context.player.onTrackChanged((track) => {
    console.log('曲目变化:', track);
});
```

#### 音乐库API
```javascript
// 获取音乐数据
const tracks = await this.context.library.getTracks();
const albums = await this.context.library.getAlbums();
const artists = await this.context.library.getArtists();

// 搜索音乐
const results = await this.context.library.search('关键词');

// 监听库更新
this.context.library.onLibraryUpdated((tracks) => {
    console.log('音乐库已更新:', tracks.length);
});
```

#### UI扩展API
```javascript
// 创建DOM元素
const element = this.createElement('div', {
    className: 'my-element',
    innerHTML: '内容'
});

// 添加CSS样式
this.addStyle(`
    .my-element {
        color: red;
    }
`);

// 显示通知
this.showNotification('消息内容', 'success');

// 添加侧边栏项目
const itemId = this.addSidebarItem({
    id: 'my-page',
    name: '我的页面',
    icon: '🔌',
    onClick: () => this.showMyPage()
});
```

#### 存储API
```javascript
// 插件专用存储
this.setStorage('key', 'value');
const value = this.getStorage('key');
this.removeStorage('key');

// 全局存储
this.context.storage.set('global-key', 'value');
const value = this.context.storage.get('global-key');
```

#### 系统API（高权限）
```javascript
// 文件系统访问
const fs = this.context.system.fs;
const files = await fs.readdir('/path/to/directory');

// 路径操作
const path = this.context.system.path;
const fullPath = path.join('/base', 'file.txt');

// 系统信息
const os = this.context.system.os;
const platform = os.platform();
```

### 事件系统

#### 监听应用事件
```javascript
this.context.events.on('trackChanged', (track) => {
    console.log('曲目变化:', track);
});
```

#### 插件间通信
```javascript
// 发送消息
this.emit('myEvent', { data: 'value' });

// 监听消息
this.on('myEvent', (data) => {
    console.log('收到消息:', data);
});

// 监听其他插件消息
this.onPlugin('other-plugin', 'someEvent', (data) => {
    console.log('其他插件消息:', data);
});

// 广播消息
this.context.messaging.broadcast('globalEvent', data);
```

## 🎨 UI扩展

### 添加侧边栏项目
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

### 添加设置项
```javascript
const sectionId = this.addSettingsSection({
    id: 'my-settings',
    title: '我的插件设置',
    items: [
        {
            type: 'toggle',
            id: 'enable-feature',
            label: '启用功能',
            description: '启用插件的特殊功能',
            value: true,
            onChange: (value) => {
                this.setStorage('featureEnabled', value);
            }
        }
    ]
});
```

### 添加右键菜单项
```javascript
const menuItemId = this.addContextMenuItem({
    id: 'my-action',
    label: '我的操作',
    icon: '🔌',
    onClick: (context) => {
        console.log('右键菜单被点击:', context);
    }
});
```

## 🔒 权限系统

插件可以请求以下权限：

- `ui` - UI扩展权限
- `audio` - 音频控制权限
- `storage` - 存储访问权限
- `system` - 系统API访问权限
- `network` - 网络访问权限

## 📦 插件打包

### 目录结构
```
my-plugin/
├── plugin.json          # 插件配置文件
├── index.js             # 主入口文件
├── styles.css           # 样式文件（可选）
├── assets/              # 资源文件（可选）
│   ├── icons/
│   └── images/
└── README.md            # 插件说明（可选）
```

### 配置文件示例
```json
{
    "id": "my-awesome-plugin",
    "name": "我的超棒插件",
    "version": "1.0.0",
    "description": "这个插件很棒",
    "author": "开发者姓名",
    "homepage": "https://github.com/user/my-plugin",
    "main": "index.js",
    "permissions": ["ui", "audio", "storage"],
    "dependencies": [],
    "engines": {
        "musicbox": ">=0.1.0"
    }
}
```

## 🛠️ 开发工具

### 启用开发模式
```javascript
// 在控制台中启用开发模式
window.pluginDevTools.enable();

// 创建开发插件
window.pluginDev.createPlugin('test-plugin', `
    class TestPlugin extends PluginBase {
        async activate() {
            this.showNotification('测试插件激活！', 'success');
        }
    }
    window.PluginClass = TestPlugin;
`);
```

### 调试插件
```javascript
// 查看插件信息
window.pluginDev.debug('plugin-id');

// 重载插件
window.pluginDev.reload('plugin-id');

// 列出所有插件
window.pluginDev.list();
```

## 📋 最佳实践

### 1. 资源管理
- 使用 `this.disposables` 管理需要清理的资源
- 在 `deactivate` 方法中确保所有资源被正确清理

### 2. 错误处理
- 使用 try-catch 包装异步操作
- 提供有意义的错误消息

### 3. 性能优化
- 避免在主线程中执行耗时操作
- 使用防抖和节流优化频繁操作

### 4. 用户体验
- 提供清晰的操作反馈
- 使用一致的UI设计风格

## 🔍 示例插件

查看 `templates/` 目录中的示例插件：

- `BasicPlugin.js` - 基础插件示例
- `UIExtensionPlugin.js` - UI扩展示例
- `MusicEnhancerPlugin.js` - 音乐功能增强示例

## 🐛 调试技巧

### 1. 使用控制台
```javascript
console.log('插件调试信息:', this.getStatus());
```

### 2. 检查插件状态
```javascript
window.checkPluginSystemStatus();
```

### 3. 热重载
开发模式下，插件会自动重载，无需重启应用。

## 📞 支持

如果在插件开发过程中遇到问题，可以：

1. 查看控制台错误信息
2. 使用开发工具调试
3. 参考示例插件代码
4. 检查API文档

---

**注意**: 插件系统提供了高权限访问，请确保只安装来自可信来源的插件。
