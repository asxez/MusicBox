# MusicBox 插件系统

## 🎯 概述

MusicBox 插件系统是一个功能强大、高度灵活的扩展框架，允许第三方开发者为 MusicBox 音乐播放器添加**任何**新功能和增强现有功能。

### ✨ 主要特性

- 🔌 **高权限访问** - 插件可以访问应用的DOM元素、API和部分安全的系统功能
- 🎨 **UI扩展** - 支持添加侧边栏项目、设置页面、右键菜单等
- 🔥 **热重载** - 开发模式下支持插件热重载，无需重启应用
- 📦 **模块化架构** - 清晰的插件架构和生命周期管理
- 🛠️ **开发工具** - 完整的开发调试工具和模板
- 💾 **存储管理** - 插件专用的数据存储和配置管理
- 🌐 **事件系统** - 强大的事件通信和插件间消息传递

## 🏗️ 系统架构

```
MusicBox Application
├── PluginManager (插件生命周期管理)
├── PluginLoader (动态脚本加载)
├── PluginAPI (标准化API接口)
├── PluginBase (插件基类)
├── PluginDevServer (开发服务器)
└── PluginTester (测试工具)
```

## 🚀 快速开始

### 1. 启用开发模式

在应用设置中启用"插件开发模式"，或在控制台中执行：

### 2. 创建第一个插件

```javascript
// 使用开发工具快速创建
window.pluginDev.create('my-first-plugin', `
    class MyFirstPlugin extends PluginBase {
        async activate() {
            await super.activate();
            this.showNotification('我的第一个插件已激活！', 'success');
        }
    }
    window.PluginClass = MyFirstPlugin;
`);
```

### 3. 查看插件状态

```javascript
// 检查插件系统状态
window.checkPluginSystemStatus();

// 查看所有插件
window.pluginDev.debug.listPlugins();

// 调试特定插件
window.pluginDev.debug.getPlugin('my-first-plugin');
```

## 📁 文件结构

```
plugin-system/
├── PluginManager.js          # 插件管理器
├── PluginLoader.js           # 插件加载器
├── PluginAPI.js              # API接口定义
├── PluginBase.js             # 插件基类
├── PluginDevServer.js        # 开发服务器
├── PluginTester.js           # 测试工具
├── index.js                  # 主入口文件
├── docs/                     # 文档
│   ├── PluginDevelopmentGuide.md
│   ├── APIReference.md
│   └── TypeDefinitions.js
├── templates/                # 插件模板
│   ├── BasicPlugin.js
│   ├── UIExtensionPlugin.js
│   └── MusicEnhancerPlugin.js
└── examples/                 # 示例插件
    ├── ThemeSwitcherPlugin.js
    ├── MusicVisualizerPlugin.js
    └── LyricsEnhancerPlugin.js
```

## 🔧 API 概览

### 核心API

```javascript
// 应用访问
this.getApp()                 // 获取应用实例
this.getAPI()                 // 获取API实例
this.getComponent(name)       // 获取组件

// 播放器控制
this.context.player.play()
this.context.player.pause()
this.context.player.getCurrentTrack()

// UI扩展
this.addSidebarItem(config)
this.addSettingsSection(config)
this.addContextMenuItem(config)

// 存储管理
this.setStorage(key, value)
this.getStorage(key)
this.removeStorage(key)

// 系统访问
this.fs                       // 文件系统
this.path                     // 路径工具
this.os                       // 操作系统信息
```

## 🎨 UI扩展示例

### 添加侧边栏项目

```javascript
this.addSidebarItem({
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
this.addSettingsSection({
    id: 'my-settings',
    title: '我的设置',
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

## 🛠️ 开发工具

### 控制台命令

```javascript
// 插件管理
window.plugins.getAll()                    // 获取所有插件
window.plugins.get('plugin-id')            // 获取特定插件
window.plugins.enable('plugin-id')         // 启用插件
window.plugins.disable('plugin-id')        // 禁用插件

// 开发工具
window.pluginDev.create(id, code)          // 创建开发插件
window.pluginDev.reload(id)                // 重载插件
window.pluginDev.remove(id)                // 删除插件
window.pluginDev.status()                  // 获取开发状态

// 测试工具
window.testPluginSystem()                  // 运行完整测试
window.testPlugin('plugin-id')             // 测试特定插件
window.pluginTester.runPerformanceTest()   // 性能测试
```

### 开发面板

启用开发模式后，可以使用：

```javascript
window.plugins.dev.panel()  // 显示开发面板
```

## 📋 插件模板

### 基础插件
- 最简单的插件结构
- 展示基本生命周期
- 适合简单功能

### UI扩展插件
- 展示UI扩展功能
- 侧边栏、设置、右键菜单
- 适合界面增强

### 音乐增强插件
- 音频处理和分析
- 播放控制和监听
- 适合音乐功能扩展

## 🧪 测试验证

### 运行测试

```javascript
// 运行完整测试套件
await window.testPluginSystem();

// 测试特定插件
await window.testPlugin('plugin-id');

// 性能测试
const perfResults = await window.pluginTester.runPerformanceTest();
```

### 测试覆盖

- ✅ 插件系统核心功能
- ✅ 插件管理器功能
- ✅ 插件加载器功能
- ✅ 插件API接口
- ✅ 示例插件功能
- ✅ 开发工具功能
- ✅ 热重载功能
- ✅ 性能测试

## 🔒 安全考虑

插件系统提供高权限访问，请注意：

1. **只安装可信插件** - 插件可以访问系统API和文件系统
2. **审查插件代码** - 在安装前检查插件代码
3. **定期更新** - 保持插件和系统更新
4. **备份数据** - 在安装新插件前备份重要数据

## 📚 文档资源

- [插件开发指南](docs/PluginDevelopmentGuide.md) - 详细的开发教程
- [API参考文档](docs/APIReference.md) - 完整的API文档
- [类型定义](docs/TypeDefinitions.js) - TypeScript风格的类型定义

## 🎯 使用场景

### 适合开发的插件类型

1. **主题和外观** - 自定义主题、颜色方案、布局
2. **音乐增强** - 音频效果、可视化、分析工具
3. **歌词功能** - 歌词翻译、同步、卡拉OK模式
4. **播放列表** - 智能播放列表、推荐算法
5. **统计分析** - 播放统计、音乐分析、报告
6. **外部集成** - 社交分享、云同步、API集成
7. **开发工具** - 调试工具、性能监控、日志记录

## 🚀 部署和分发

### 开发环境
- 使用开发模式进行实时调试
- 利用热重载快速迭代
- 使用测试工具验证功能

### 生产环境
- 打包插件为标准格式
- 提供完整的配置文件
- 编写详细的使用说明

## 🤝 贡献

欢迎为插件系统贡献代码和想法：

1. 报告问题和建议
2. 提交插件模板
3. 改进API设计
4. 优化性能和稳定性

## 📞 支持

如果在使用过程中遇到问题：

1. 查看控制台错误信息
2. 使用 `window.checkPluginSystemStatus()` 检查状态
3. 运行 `window.testPluginSystem()` 进行诊断
4. 查看文档和示例代码

---

**🎵 享受使用 MusicBox 插件系统扩展您的音乐体验！**
