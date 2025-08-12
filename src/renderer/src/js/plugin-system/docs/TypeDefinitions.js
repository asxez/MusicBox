/**
 * MusicBox 插件系统类型定义
 * 提供插件开发的类型参考和智能提示
 */

/**
 * 插件配置接口
 * @typedef {Object} PluginConfig
 * @property {string} id - 插件唯一标识符
 * @property {string} name - 插件显示名称
 * @property {string} version - 插件版本号 (semver格式)
 * @property {string} description - 插件描述
 * @property {string} author - 插件作者
 * @property {string} [homepage] - 插件主页URL
 * @property {string} main - 主入口文件路径
 * @property {string[]} [permissions] - 所需权限列表
 * @property {string[]} [dependencies] - 依赖的其他插件
 * @property {Object} [engines] - 支持的MusicBox版本
 * @property {number} [size] - 插件大小（字节）
 */

/**
 * 曲目信息接口
 * @typedef {Object} Track
 * @property {string} id - 曲目唯一标识
 * @property {string} title - 曲目标题
 * @property {string} artist - 艺术家
 * @property {string} album - 专辑名称
 * @property {number} duration - 时长（秒）
 * @property {string} filePath - 文件路径
 * @property {string} [genre] - 流派
 * @property {number} [year] - 发行年份
 * @property {number} [trackNumber] - 曲目编号
 * @property {number} [bitrate] - 比特率
 * @property {string} [coverArt] - 封面图片路径
 */

/**
 * 专辑信息接口
 * @typedef {Object} Album
 * @property {string} id - 专辑唯一标识
 * @property {string} name - 专辑名称
 * @property {string} artist - 艺术家
 * @property {number} [year] - 发行年份
 * @property {string} [coverArt] - 封面图片路径
 * @property {Track[]} tracks - 专辑曲目列表
 */

/**
 * 艺术家信息接口
 * @typedef {Object} Artist
 * @property {string} id - 艺术家唯一标识
 * @property {string} name - 艺术家名称
 * @property {Album[]} albums - 艺术家专辑列表
 * @property {Track[]} tracks - 艺术家曲目列表
 */

/**
 * 播放器API接口
 * @typedef {Object} PlayerAPI
 * @property {() => Promise<void>} play - 播放
 * @property {() => Promise<void>} pause - 暂停
 * @property {() => Promise<void>} stop - 停止
 * @property {() => Promise<void>} next - 下一首
 * @property {() => Promise<void>} previous - 上一首
 * @property {(volume: number) => Promise<void>} setVolume - 设置音量 (0-1)
 * @property {() => Promise<number>} getVolume - 获取音量
 * @property {(position: number) => Promise<void>} seek - 跳转位置
 * @property {() => Promise<number>} getPosition - 获取播放位置
 * @property {() => Promise<number>} getDuration - 获取曲目时长
 * @property {() => Promise<boolean>} isPlaying - 是否正在播放
 * @property {() => Promise<Track>} getCurrentTrack - 获取当前曲目
 * @property {() => Promise<Track[]>} getPlaylist - 获取播放列表
 * @property {(tracks: Track[], index: number) => Promise<void>} setPlaylist - 设置播放列表
 * @property {(callback: (track: Track) => void) => void} onTrackChanged - 监听曲目变化
 * @property {(callback: (isPlaying: boolean) => void) => void} onPlaybackStateChanged - 监听播放状态变化
 * @property {(callback: (position: number) => void) => void} onPositionChanged - 监听位置变化
 */

/**
 * 音乐库API接口
 * @typedef {Object} LibraryAPI
 * @property {(options?: Object) => Promise<Track[]>} getTracks - 获取曲目列表
 * @property {() => Promise<Album[]>} getAlbums - 获取专辑列表
 * @property {() => Promise<Artist[]>} getArtists - 获取艺术家列表
 * @property {(query: string) => Promise<Track[]>} search - 搜索音乐
 * @property {(path: string) => Promise<boolean>} scanDirectory - 扫描目录
 * @property {(filePath: string) => Promise<Object>} getTrackMetadata - 获取曲目元数据
 * @property {(callback: (tracks: Track[]) => void) => void} onLibraryUpdated - 监听库更新
 * @property {(callback: (progress: Object) => void) => void} onScanProgress - 监听扫描进度
 */

/**
 * UI API接口
 * @typedef {Object} UIAPI
 * @property {(message: string, type?: string, duration?: number) => void} showNotification - 显示通知
 * @property {(tag: string, attributes?: Object, children?: Array) => HTMLElement} createElement - 创建元素
 * @property {(pluginId: string, css: string) => void} addCSS - 添加CSS
 * @property {(pluginId: string) => void} removeCSS - 移除CSS
 * @property {(name: string) => Object} getComponent - 获取组件
 * @property {(config: Object) => void} showDialog - 显示对话框
 */

/**
 * 设置API接口
 * @typedef {Object} SettingsAPI
 * @property {(key: string, defaultValue?: any) => any} get - 获取设置
 * @property {(key: string, value: any) => void} set - 设置值
 * @property {(pluginId: string, config: Object) => string} addSection - 添加设置部分
 * @property {(pluginId: string, sectionId: string) => void} removeSection - 移除设置部分
 */

/**
 * 导航API接口
 * @typedef {Object} NavigationAPI
 * @property {(pluginId: string, config: Object) => string} addItem - 添加导航项
 * @property {(pluginId: string, itemId: string) => void} removeItem - 移除导航项
 * @property {() => string} getCurrentView - 获取当前视图
 * @property {(view: string) => void} navigateTo - 导航到视图
 */

/**
 * 存储API接口
 * @typedef {Object} StorageAPI
 * @property {(key: string) => any} get - 获取数据
 * @property {(key: string, value: any) => void} set - 设置数据
 * @property {(key: string) => void} remove - 移除数据
 * @property {() => void} clear - 清空存储
 */

/**
 * 系统API接口
 * @typedef {Object} SystemAPI
 * @property {Object} fs - 文件系统API
 * @property {Object} path - 路径工具API
 * @property {Object} os - 操作系统API
 * @property {() => Promise<string>} openDirectory - 打开目录选择器
 * @property {() => Promise<string[]>} openFiles - 打开文件选择器
 * @property {(path: string) => void} showItemInFolder - 在文件夹中显示项目
 */

/**
 * 事件API接口
 * @typedef {Object} EventsAPI
 * @property {(event: string, data: any) => void} emit - 发送事件
 * @property {(event: string, callback: Function) => void} on - 监听事件
 * @property {(event: string, callback: Function) => void} off - 取消监听
 */

/**
 * 消息API接口
 * @typedef {Object} MessagingAPI
 * @property {(event: string, data: any) => void} emit - 发送插件消息
 * @property {(event: string, callback: Function) => void} on - 监听插件消息
 * @property {(event: string, callback: Function) => void} off - 取消监听
 * @property {(event: string, data: any) => void} broadcast - 广播消息
 * @property {(event: string, callback: Function) => void} onBroadcast - 监听广播
 */

/**
 * 插件上下文接口
 * @typedef {Object} PluginContext
 * @property {string} pluginId - 插件ID
 * @property {PlayerAPI} player - 播放器API
 * @property {LibraryAPI} library - 音乐库API
 * @property {UIAPI} ui - UI API
 * @property {SettingsAPI} settings - 设置API
 * @property {NavigationAPI} navigation - 导航API
 * @property {StorageAPI} storage - 存储API
 * @property {SystemAPI} system - 系统API
 * @property {EventsAPI} events - 事件API
 * @property {MessagingAPI} messaging - 消息API
 * @property {Object} app - 应用实例
 * @property {Object} api - API实例
 * @property {Document} document - DOM文档
 * @property {Window} window - 窗口对象
 * @property {typeof Component} Component - 组件基类
 * @property {typeof EventEmitter} EventEmitter - 事件发射器
 * @property {typeof PluginBase} PluginBase - 插件基类
 * @property {Object} utils - 工具函数
 */

/**
 * 插件信息接口
 * @typedef {Object} PluginInfo
 * @property {string} id - 插件ID
 * @property {PluginConfig} config - 插件配置
 * @property {boolean} enabled - 是否启用
 * @property {boolean} loaded - 是否已加载
 * @property {Object} [instance] - 插件实例
 */

/**
 * 侧边栏项目配置
 * @typedef {Object} SidebarItemConfig
 * @property {string} id - 项目ID
 * @property {string} name - 显示名称
 * @property {string} [icon] - 图标
 * @property {number} [order] - 排序权重
 * @property {() => void} onClick - 点击回调
 */

/**
 * 设置项配置
 * @typedef {Object} SettingItemConfig
 * @property {'toggle'|'select'|'input'|'button'} type - 设置项类型
 * @property {string} id - 设置项ID
 * @property {string} label - 标签
 * @property {string} description - 描述
 * @property {any} [value] - 默认值
 * @property {Array} [options] - 选项列表（select类型）
 * @property {string} [buttonText] - 按钮文本（button类型）
 * @property {(value: any) => void} [onChange] - 值变化回调
 * @property {() => void} [onClick] - 点击回调（button类型）
 */

/**
 * 设置部分配置
 * @typedef {Object} SettingsSectionConfig
 * @property {string} id - 部分ID
 * @property {string} title - 部分标题
 * @property {SettingItemConfig[]} items - 设置项列表
 */

/**
 * 右键菜单项配置
 * @typedef {Object} ContextMenuItemConfig
 * @property {string} id - 菜单项ID
 * @property {string} label - 显示标签
 * @property {string} [icon] - 图标
 * @property {(context: Object) => void} onClick - 点击回调
 */

// 导出类型定义到全局（用于开发时的智能提示）
if (typeof window !== 'undefined') {
    window.PluginTypes = {
        PluginConfig: 'PluginConfig',
        Track: 'Track',
        Album: 'Album',
        Artist: 'Artist',
        PlayerAPI: 'PlayerAPI',
        LibraryAPI: 'LibraryAPI',
        UIAPI: 'UIAPI',
        SettingsAPI: 'SettingsAPI',
        NavigationAPI: 'NavigationAPI',
        StorageAPI: 'StorageAPI',
        SystemAPI: 'SystemAPI',
        EventsAPI: 'EventsAPI',
        MessagingAPI: 'MessagingAPI',
        PluginContext: 'PluginContext',
        PluginInfo: 'PluginInfo',
        SidebarItemConfig: 'SidebarItemConfig',
        SettingItemConfig: 'SettingItemConfig',
        SettingsSectionConfig: 'SettingsSectionConfig',
        ContextMenuItemConfig: 'ContextMenuItemConfig'
    };
}

/**
 * 插件开发辅助函数
 */
let PluginHelpers = {
    /**
     * 验证插件配置
     * @param {PluginConfig} config - 插件配置
     * @returns {boolean} 是否有效
     */
    validateConfig(config) {
        const required = ['id', 'name', 'version', 'main'];
        return required.every(field => config[field]);
    },

    /**
     * 生成插件ID
     * @param {string} name - 插件名称
     * @returns {string} 生成的ID
     */
    generateId(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    },

    /**
     * 格式化版本号
     * @param {string} version - 版本号
     * @returns {string} 格式化后的版本号
     */
    formatVersion(version) {
        const parts = version.split('.');
        while (parts.length < 3) {
            parts.push('0');
        }
        return parts.slice(0, 3).join('.');
    },

    /**
     * 比较版本号
     * @param {string} version1 - 版本1
     * @param {string} version2 - 版本2
     * @returns {number} 比较结果 (-1, 0, 1)
     */
    compareVersions(version1, version2) {
        const v1 = version1.split('.').map(Number);
        const v2 = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
            const a = v1[i] || 0;
            const b = v2[i] || 0;
            
            if (a < b) return -1;
            if (a > b) return 1;
        }
        
        return 0;
    },

    /**
     * 检查权限
     * @param {string[]} required - 需要的权限
     * @param {string[]} available - 可用的权限
     * @returns {boolean} 是否有足够权限
     */
    checkPermissions(required, available) {
        return required.every(perm => available.includes(perm));
    },

    /**
     * 创建插件配置模板
     * @param {Object} options - 配置选项
     * @returns {PluginConfig} 插件配置
     */
    createConfigTemplate(options = {}) {
        return {
            id: options.id || 'my-plugin',
            name: options.name || '我的插件',
            version: options.version || '1.0.0',
            description: options.description || '插件描述',
            author: options.author || '插件作者',
            main: options.main || 'index.js',
            permissions: options.permissions || ['ui'],
            dependencies: options.dependencies || [],
            engines: {
                musicbox: '>=0.1.0'
            }
        };
    },

    /**
     * 创建插件代码模板
     * @param {string} className - 插件类名
     * @returns {string} 插件代码
     */
    createCodeTemplate(className = 'MyPlugin') {
        return `
/**
 * ${className} - MusicBox插件
 */
class ${className} extends PluginBase {
    constructor(context) {
        super(context);
        console.log('🔌 ${className}: 插件构造');
    }

    async activate() {
        await super.activate();
        console.log('🔌 ${className}: 插件激活');
        
        // 在这里添加插件功能
        this.showNotification('${className} 已激活！', 'success');
    }

    async deactivate() {
        await super.deactivate();
        console.log('🔌 ${className}: 插件停用');
    }
}

// 导出插件类
window.PluginClass = ${className};
        `.trim();
    }
};

// 导出辅助函数
if (typeof window !== 'undefined') {
    window.PluginHelpers = PluginHelpers;
}

/**
 * 插件开发常量
 */
let PluginConstants = {
    // 权限类型
    PERMISSIONS: {
        UI: 'ui',
        AUDIO: 'audio',
        STORAGE: 'storage',
        SYSTEM: 'system',
        NETWORK: 'network'
    },

    // 通知类型
    NOTIFICATION_TYPES: {
        INFO: 'info',
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error'
    },

    // 设置项类型
    SETTING_TYPES: {
        TOGGLE: 'toggle',
        SELECT: 'select',
        INPUT: 'input',
        BUTTON: 'button',
        SLIDER: 'slider'
    },

    // 插件状态
    PLUGIN_STATES: {
        INSTALLED: 'installed',
        ENABLED: 'enabled',
        DISABLED: 'disabled',
        LOADING: 'loading',
        ERROR: 'error'
    },

    // API版本
    API_VERSION: '1.0.0',

    // 最大文件大小 (50MB)
    MAX_PLUGIN_SIZE: 50 * 1024 * 1024
};

// 导出常量
if (typeof window !== 'undefined') {
    window.PluginConstants = PluginConstants;
}

console.log('🔌 插件类型定义加载完成');
