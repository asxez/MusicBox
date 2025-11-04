# MusicBox 插件系统架构设计

## 概述

MusicBox 的新插件系统参考了 VSCode 的扩展系统架构，采用了现代化的设计模式和最佳实践，提供了强大、可扩展、易于使用的插件开发能力。

## 设计目标

1. **可扩展性**：允许第三方开发者轻松扩展应用功能
2. **隔离性**：插件之间相互隔离，避免冲突
3. **性能**：延迟加载，按需激活，最小化性能影响
4. **安全性**：提供受控的 API，保护应用核心
5. **易用性**：简单直观的 API，完善的文档
6. **兼容性**：与现有代码无缝集成

## 核心架构

### 1. 分层架构

```
┌─────────────────────────────────────────┐
│         Extension Layer                 │  扩展层
│  (Third-party Extensions)               │
├─────────────────────────────────────────┤
│         Extension API Layer             │  API 层
│  (Standardized APIs)                    │
├─────────────────────────────────────────┤
│         Extension Service Layer         │  服务层
│  (Registry, Activator, Lifecycle)       │
├─────────────────────────────────────────┤
│         Core Infrastructure Layer       │  基础设施层
│  (DI, Events, Disposables)              │
├─────────────────────────────────────────┤
│         Application Core Layer          │  应用核心层
│  (MusicBox App, Components)             │
└─────────────────────────────────────────┘
```

### 2. 核心组件

#### 2.1 基础设施层 (Core Infrastructure)

**Lifecycle.js** - 生命周期管理
- `Disposable`：可释放对象基类
- `DisposableStore`：管理多个 Disposable
- `DisposableMap`：可释放的 Map
- `toDisposable()`：创建 Disposable
- `combinedDisposable()`：组合多个 Disposable

**Event.js** - 事件系统
- `Emitter`：事件发射器
- `Event`：事件工具函数集合
  - `any()`：合并多个事件
  - `map()`：映射事件数据
  - `filter()`：过滤事件
  - `once()`：只触发一次
  - `debounce()`：防抖
  - `fromDOMEvent()`：从 DOM 事件创建
- `EventMultiplexer`：事件多路复用器

**Instantiation.js** - 依赖注入
- `ServiceIdentifier`：服务标识符
- `createDecorator()`：创建服务装饰器
- `SyncDescriptor`：服务描述符
- `ServiceCollection`：服务集合
- `InstantiationService`：实例化服务
- `ServiceRegistry`：服务注册表

#### 2.2 服务层 (Extension Service)

**ExtensionsRegistry.js** - 扩展注册表
- `ExtensionPoint`：扩展点
- `ExtensionDescriptor`：扩展描述符
- `ExtensionsRegistry`：扩展注册表
- `ActivationEvents`：激活事件类型
- `ContributionPoints`：贡献点类型

**ExtensionActivator.js** - 扩展激活器
- `ExtensionActivationTimes`：激活时间记录
- `ExtensionActivationReason`：激活原因
- `ActivatedExtension`：已激活的扩展
- `ExtensionActivator`：扩展激活器

**ExtensionService.js** - 扩展服务
- `ExtensionService`：扩展服务主类
  - 扫描和加载扩展
  - 管理扩展生命周期
  - 处理激活事件
  - 提供扩展管理 API

#### 2.3 API 层 (Extension API)

**ExtensionAPI.js** - 扩展 API
- `createExtensionAPI()`：创建扩展 API
- API 命名空间：
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

## 工作流程

### 1. 应用启动流程

```
1. 加载核心基础设施
   ├─ Lifecycle.js
   ├─ Event.js
   └─ Instantiation.js

2. 加载扩展系统
   ├─ ExtensionsRegistry.js
   ├─ ExtensionActivator.js
   └─ ExtensionService.js

3. 加载扩展 API
   └─ ExtensionAPI.js

4. 初始化应用
   └─ MusicBoxApp.init()

5. 初始化扩展服务
   ├─ 创建服务集合
   ├─ 创建实例化服务
   ├─ 创建扩展服务
   └─ 初始化扩展服务

6. 注册核心扩展点
   ├─ commands
   ├─ menus
   ├─ views
   ├─ configuration
   ├─ themes
   └─ keybindings

7. 扫描并加载扩展
   └─ 从本地存储读取扩展配置

8. 激活启动扩展
   ├─ onStartUp 事件
   └─ * (通配符)
```

### 2. 扩展激活流程

```
1. 触发激活事件
   └─ extensionService.activateByEvent(event)

2. 查找需要激活的扩展
   └─ registry.getExtensionsByActivationEvent(event)

3. 对每个扩展执行激活
   ├─ 检查是否已激活
   ├─ 检查是否正在激活
   └─ 执行激活流程

4. 加载扩展模块
   ├─ 从 window 对象获取
   └─ 动态加载脚本

5. 创建扩展上下文
   ├─ extensionId
   ├─ extensionPath
   ├─ subscriptions
   ├─ globalState
   └─ workspaceState

6. 调用 activate 函数
   └─ module.activate(context)

7. 记录激活信息
   ├─ 激活时间
   ├─ 导出的 API
   └─ 订阅列表

8. 触发激活完成事件
   └─ onDidActivateExtension
```

### 3. 扩展停用流程

```
1. 调用 deactivate 函数
   └─ module.deactivate()

2. 释放订阅资源
   └─ subscriptions.dispose()

3. 从激活列表移除
   └─ activatedExtensions.delete(id)

4. 触发停用完成事件
   └─ onDidDeactivateExtension
```

## 设计模式

### 1. 依赖注入 (Dependency Injection)

使用服务标识符和服务集合实现依赖注入：

```javascript
// 创建服务标识符
const IMyService = createDecorator('myService');

// 注册服务
const services = new ServiceCollection();
services.set(IMyService, new MyService());

// 创建实例化服务
const instantiationService = new InstantiationService(services);

// 创建实例（自动注入依赖）
const instance = instantiationService.createInstance(MyClass);
```

### 2. 事件驱动 (Event-Driven)

使用 Emitter 和 Event 实现事件驱动：

```javascript
// 创建事件发射器
const emitter = new Emitter();

// 订阅事件
const disposable = emitter.event((data) => {
    console.log('事件触发:', data);
});

// 触发事件
emitter.fire({ message: 'Hello' });

// 取消订阅
disposable.dispose();
```

### 3. 资源管理 (Resource Management)

使用 Disposable 模式管理资源：

```javascript
// 创建资源容器
const disposables = new DisposableStore();

// 添加资源
disposables.add(subscription1);
disposables.add(subscription2);

// 释放所有资源
disposables.dispose();
```

### 4. 注册表模式 (Registry Pattern)

使用注册表管理扩展和扩展点：

```javascript
// 注册扩展点
registry.registerExtensionPoint('commands');

// 注册扩展
registry.registerExtension(descriptor);

// 获取扩展
const extension = registry.getExtension('extension-id');
```

### 5. 工厂模式 (Factory Pattern)

使用工厂函数创建 API 实例：

```javascript
function createExtensionAPI(context) {
    return {
        player: createPlayerAPI(),
        library: createLibraryAPI(),
        // ...
    };
}
```

## 与 VSCode 的对比

### 相似之处

1. **架构设计**：分层架构，核心基础设施 + 服务层 + API 层
2. **依赖注入**：使用服务标识符和服务集合
3. **事件系统**：Emitter/Event 模式
4. **生命周期管理**：Disposable 模式
5. **扩展注册表**：ExtensionPoint 和 ExtensionDescriptor
6. **激活事件**：延迟加载，按需激活
7. **贡献点**：标准化的扩展点

### 差异之处

1. **语言**：VSCode 使用 TypeScript，MusicBox 使用 JavaScript
2. **模块系统**：VSCode 使用 ES 模块，MusicBox 使用全局对象
3. **装饰器**：VSCode 使用 TypeScript 装饰器，MusicBox 使用函数式方法
4. **进程模型**：VSCode 有独立的扩展主机进程，MusicBox 在同一进程
5. **API 范围**：VSCode 的 API 更广泛，MusicBox 专注于音乐播放器功能

## 扩展性设计

### 1. 扩展点系统

允许应用定义扩展点，扩展可以向这些点贡献功能：

```javascript
// 注册扩展点
const commandsPoint = registry.registerExtensionPoint('commands');

// 设置处理器
commandsPoint.setHandler((contributions) => {
    contributions.forEach(contrib => {
        registerCommand(contrib.value);
    });
});
```

### 2. API 版本控制

通过 `engines` 字段控制兼容性：

```json
{
  "engines": {
    "musicbox": "^1.0.0"
  }
}
```

### 3. 向后兼容

保持与旧插件系统的兼容：

```javascript
// 新系统
if (typeof ExtensionService !== 'undefined') {
    // 使用新系统
}

// 旧系统（兼容模式）
if (typeof window.initializePluginSystem === 'function') {
    // 使用旧系统
}
```

## 性能优化

### 1. 延迟加载

只在需要时加载和激活扩展：

```json
{
  "activationEvents": [
    "onCommand:myExtension.command"
  ]
}
```

### 2. 异步激活

使用 async/await 避免阻塞主线程：

```javascript
async function activate(context) {
    await loadData();
    // ...
}
```

### 3. 资源清理

及时释放不需要的资源：

```javascript
context.subscriptions.add(disposable);
```

## 安全性

### 1. API 隔离

扩展只能通过标准 API 访问应用功能，不能直接访问内部实现。

### 2. 沙箱化

每个扩展有独立的上下文，避免相互干扰。

### 3. 权限控制

通过 API 设计控制扩展的权限范围。

## 未来扩展

### 1. 扩展市场

- 在线扩展商店
- 扩展搜索和安装
- 扩展评分和评论

### 2. 扩展主机

- 独立的扩展进程
- 更好的隔离性
- 崩溃恢复

### 3. 更多 API

- 歌词 API
- 均衡器 API
- 可视化 API
- 主题 API

### 4. 开发工具

- 扩展调试器
- 扩展生成器
- 扩展测试框架

## 总结

MusicBox 的新插件系统采用了现代化的架构设计，参考了 VSCode 的最佳实践，提供了强大、可扩展、易于使用的插件开发能力。通过分层架构、依赖注入、事件驱动等设计模式，实现了高内聚、低耦合的系统设计，为未来的扩展和维护奠定了坚实的基础。
