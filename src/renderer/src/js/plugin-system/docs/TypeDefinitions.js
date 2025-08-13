/**
 * MusicBox 插件系统类型定义
 * 提供插件开发的类型参考和智能提示
 *
 *
 * 本文件包含了MusicBox插件系统的完整类型定义，
 */

/**
 * 插件配置接口
 * @typedef {Object} PluginConfig
 * @property {string} id - 插件唯一标识符，必须符合命名规范
 * @property {string} name - 插件显示名称
 * @property {string} version - 插件版本号 (semver格式，如 "1.0.0")
 * @property {string} description - 插件功能描述
 * @property {string} author - 插件作者
 * @property {string} [homepage] - 插件主页URL
 * @property {string} main - 主入口文件路径，相对于插件根目录
 * @property {string[]} [permissions] - 所需权限列表 ['ui', 'player', 'library', 'storage', 'system', 'events', 'navigation', 'settings', 'contextMenu']
 * @property {string[]} [dependencies] - 依赖的其他插件ID列表
 * @property {Object} [engines] - 支持的MusicBox版本要求
 * @property {string} [engines.musicbox] - MusicBox版本要求，如 ">=0.1.0"
 * @property {number} [size] - 插件大小（字节）
 * @property {string} [category] - 插件分类
 * @property {string[]} [keywords] - 关键词标签
 * @property {string[]} [features] - 功能特性列表
 */

/**
 * 歌曲信息接口
 * @typedef {Object} Track
 * @property {string} id - 歌曲唯一标识
 * @property {string} title - 歌曲标题
 * @property {string} artist - 艺术家名称
 * @property {string} album - 专辑名称
 * @property {number} duration - 时长（秒）
 * @property {string} filePath - 文件完整路径
 * @property {string} [genre] - 音乐流派
 * @property {number} [year] - 发行年份
 * @property {number} [trackNumber] - 专辑中的歌曲编号
 * @property {number} [bitrate] - 音频比特率 (kbps)
 * @property {string} [coverArt] - 封面图片路径或URL
 * @property {number} [fileSize] - 文件大小（字节）
 * @property {string} [format] - 音频格式 (mp3, flac, wav等)
 * @property {Object} [metadata] - 额外的元数据信息
 */

/**
 * 专辑信息接口
 * @typedef {Object} Album
 * @property {string} id - 专辑唯一标识
 * @property {string} name - 专辑名称
 * @property {string} artist - 主要艺术家
 * @property {number} [year] - 发行年份
 * @property {string} [coverArt] - 封面图片路径或URL
 * @property {Track[]} tracks - 专辑包含的歌曲列表
 * @property {string} [genre] - 专辑流派
 * @property {number} [trackCount] - 歌曲总数
 * @property {number} [duration] - 专辑总时长（秒）
 */

/**
 * 艺术家信息接口
 * @typedef {Object} Artist
 * @property {string} id - 艺术家唯一标识
 * @property {string} name - 艺术家名称
 * @property {Album[]} albums - 艺术家的专辑列表
 * @property {Track[]} tracks - 艺术家的所有歌曲
 * @property {string} [bio] - 艺术家简介
 * @property {string} [image] - 艺术家头像或照片
 * @property {number} [albumCount] - 专辑数量
 * @property {number} [trackCount] - 歌曲数量
 */

/**
 * 播放器API接口
 * @typedef {Object} PlayerAPI
 * @property {() => Promise<void>} play - 开始播放当前歌曲
 * @property {() => Promise<void>} pause - 暂停播放
 * @property {() => Promise<void>} stop - 停止播放
 * @property {() => Promise<void>} next - 播放下一首
 * @property {() => Promise<void>} previous - 播放上一首
 * @property {(volume: number) => Promise<void>} setVolume - 设置音量 (0-1)
 * @property {() => Promise<number>} getVolume - 获取当前音量
 * @property {(position: number) => Promise<void>} seek - 跳转到指定位置（秒）
 * @property {() => Promise<number>} getPosition - 获取当前播放位置（秒）
 * @property {() => Promise<number>} getDuration - 获取当前歌曲总时长（秒）
 * @property {() => boolean} isPlaying - 检查是否正在播放（同步方法）
 * @property {() => Promise<Track|null>} getCurrentTrack - 获取当前播放的歌曲
 * @property {() => Track[]} getPlaylist - 获取当前播放列表（同步方法）
 * @property {(tracks: Track[], index?: number) => Promise<void>} setPlaylist - 设置播放列表
 * @property {(callback: (track: Track) => void) => void} onTrackChanged - 监听歌曲变化事件
 * @property {(callback: (isPlaying: boolean) => void) => void} onPlaybackStateChanged - 监听播放状态变化
 * @property {(callback: (position: number) => void) => void} onPositionChanged - 监听播放位置变化
 * @property {(callback: (track: Track) => void) => void} onTrackLoaded - 监听歌曲加载完成
 * @property {(callback: (duration: number) => void) => void} onDurationChanged - 监听时长变化
 * @property {(callback: (volume: number) => void) => void} onVolumeChanged - 监听音量变化
 * @property {(callback: Function) => void} offTrackChanged - 取消歌曲变化监听
 * @property {(callback: Function) => void} offPlaybackStateChanged - 取消播放状态监听
 * @property {(callback: Function) => void} offPositionChanged - 取消位置变化监听
 * @property {() => void} removeAllListeners - 移除所有事件监听器
 */

/**
 * 音乐库API接口
 * @typedef {Object} LibraryAPI
 * @property {(options?: {limit?: number, offset?: number, genre?: string}) => Promise<Track[]>} getTracks - 获取歌曲列表
 * @property {() => Promise<Album[]>} getAlbums - 获取专辑列表
 * @property {() => Promise<Artist[]>} getArtists - 获取艺术家列表
 * @property {(query: string) => Promise<Track[]>} search - 搜索音乐
 * @property {(path: string) => Promise<boolean>} scanDirectory - 扫描指定目录
 * @property {(filePath: string) => Promise<Object>} getTrackMetadata - 获取音乐文件元数据
 * @property {(callback: (tracks: Track[]) => void) => void} onLibraryUpdated - 监听音乐库更新
 * @property {(callback: (progress: {current: number, total: number, file: string}) => void) => void} onScanProgress - 监听扫描进度
 */

/**
 * UI API接口
 * @typedef {Object} UIAPI
 * @property {(message: string, type?: 'info'|'success'|'warning'|'error', duration?: number) => void} showNotification - 显示通知消息
 * @property {(tag: string, attributes?: Object, children?: Array|string) => HTMLElement} createElement - 创建DOM元素
 * @property {(pluginId: string, css: string) => void} addCSS - 为插件添加CSS样式
 * @property {(pluginId: string) => void} removeCSS - 移除插件的CSS样式
 * @property {(name: string) => Object|null} getComponent - 获取应用组件实例
 * @property {(config: DialogConfig) => void} showDialog - 显示对话框
 */

/**
 * 对话框配置
 * @typedef {Object} DialogConfig
 * @property {string} title - 对话框标题
 * @property {string} message - 对话框内容
 * @property {string[]} [buttons] - 按钮文本数组
 * @property {(buttonIndex: number) => void} [onClose] - 关闭回调
 */

/**
 * 设置API接口
 * @typedef {Object} SettingsAPI
 * @property {(key: string, defaultValue?: any) => any} get - 获取设置值
 * @property {(key: string, value: any) => void} set - 设置值
 * @property {(pluginId: string, config: SettingsSectionConfig) => string} addSection - 添加设置部分
 * @property {(pluginId: string, sectionId: string) => void} removeSection - 移除设置部分
 */

/**
 * 导航API接口
 * @typedef {Object} NavigationAPI
 * @property {(config: NavigationItemConfig) => string} addItem - 添加导航项
 * @property {(itemId: string) => void} removeItem - 移除导航项
 * @property {() => string} getCurrentView - 获取当前视图名称
 * @property {(view: string) => void} navigateTo - 导航到指定视图
 */

/**
 * 导航项配置
 * @typedef {Object} NavigationItemConfig
 * @property {string} id - 导航项ID
 * @property {string} name - 显示名称
 * @property {string} [icon] - 图标（emoji或CSS类名）
 * @property {number} [order] - 排序权重，数字越小越靠前
 * @property {() => void} onClick - 点击回调函数
 */

/**
 * 右键菜单API接口
 * @typedef {Object} ContextMenuAPI
 * @property {(pluginId: string, config: ContextMenuItemConfig) => string} addItem - 添加右键菜单项
 * @property {(pluginId: string, itemId: string) => void} removeItem - 移除右键菜单项
 */

/**
 * 存储API接口
 * @typedef {Object} StorageAPI
 * @property {(key: string) => any} get - 获取存储的数据
 * @property {(key: string, value: any) => void} set - 存储数据
 * @property {(key: string) => void} remove - 移除指定键的数据
 * @property {() => void} clear - 清空所有存储数据
 */

/**
 * 文件系统API接口
 * @typedef {Object} FileSystemAPI
 * @property {() => Object} fs - 获取Node.js fs模块
 * @property {(filePath: string) => Promise<Object>} stat - 获取文件状态
 * @property {(filePath: string, encoding?: string) => Promise<string|Buffer>} readFile - 读取文件
 */

/**
 * 操作系统API接口
 * @typedef {Object} OperatingSystemAPI
 * @property {() => Promise<string>} platform - 获取操作系统平台
 * @property {() => Promise<string>} arch - 获取CPU架构
 * @property {() => Promise<string>} type - 获取操作系统类型
 * @property {() => Promise<string>} release - 获取操作系统版本
 * @property {() => Promise<string>} hostname - 获取主机名
 * @property {() => Promise<number>} totalmem - 获取总内存
 * @property {() => Promise<number>} freemem - 获取可用内存
 * @property {() => Promise<Array>} cpus - 获取CPU信息
 * @property {() => Promise<number>} uptime - 获取系统运行时间
 * @property {() => Promise<string>} homedir - 获取用户主目录
 * @property {() => Promise<string>} tmpdir - 获取临时目录
 */

/**
 * 系统API接口
 * @typedef {Object} SystemAPI
 * @property {FileSystemAPI} fs - 文件系统API
 * @property {() => Object} path - 路径工具API
 * @property {OperatingSystemAPI} os - 操作系统API
 * @property {() => Promise<string|null>} openDirectory - 打开目录选择器
 * @property {() => Promise<string[]|null>} openFiles - 打开文件选择器
 * @property {(path: string) => void} showItemInFolder - 在文件管理器中显示文件
 */

/**
 * 事件API接口
 * @typedef {Object} EventsAPI
 * @property {(event: string, data?: any) => void} emit - 发送事件
 * @property {(event: string, callback: Function) => void} on - 监听事件
 * @property {(event: string, callback: Function) => void} off - 取消事件监听
 */

/**
 * 插件上下文接口 - 插件运行时的完整环境
 * @typedef {Object} PluginContext
 * @property {string} pluginId - 当前插件的唯一标识符
 * @property {PlayerAPI} player - 音乐播放器控制API
 * @property {LibraryAPI} library - 音乐库管理API
 * @property {UIAPI} ui - 用户界面扩展API
 * @property {SettingsAPI} settings - 设置管理API
 * @property {NavigationAPI} navigation - 导航管理API
 * @property {ContextMenuAPI} contextMenu - 右键菜单API
 * @property {StorageAPI} storage - 数据存储API
 * @property {SystemAPI} system - 系统交互API（高权限）
 * @property {EventsAPI} events - 事件系统API
 * @property {Object} app - MusicBox应用实例
 * @property {Object} api - MusicBox核心API实例
 * @property {Document} document - DOM文档对象
 * @property {Window} window - 浏览器窗口对象
 * @property {Object} electronAPI - Electron主进程通信API
 * @property {typeof Component} Component - UI组件基类
 * @property {typeof EventEmitter} EventEmitter - 事件发射器基类
 * @property {typeof PluginBase} PluginBase - 插件基类
 * @property {PluginUtils} utils - 插件工具函数集合
 */

/**
 * 插件工具函数集合
 * @typedef {Object} PluginUtils
 * @property {(tag: string, attributes?: Object, children?: Array|string) => HTMLElement} createElement - 创建DOM元素
 * @property {(css: string) => void} addCSS - 添加CSS样式
 * @property {() => void} removeCSS - 移除CSS样式
 * @property {(message: string, type?: string, duration?: number) => void} showNotification - 显示通知
 * @property {(commandId: string, handler: Function) => void} registerCommand - 注册命令
 * @property {(commandId: string) => void} unregisterCommand - 取消注册命令
 */

/**
 * 插件信息接口
 * @typedef {Object} PluginInfo
 * @property {string} id - 插件唯一标识符
 * @property {PluginConfig} config - 插件配置信息
 * @property {boolean} enabled - 是否启用状态
 * @property {boolean} loaded - 是否已加载到内存
 * @property {Object} [instance] - 插件实例对象（如果已加载）
 * @property {string} [error] - 错误信息（如果加载失败）
 * @property {Date} [loadTime] - 加载时间
 */

/**
 * 设置项配置
 * @typedef {Object} SettingItemConfig
 * @property {'toggle'|'select'|'input'|'button'|'slider'|'color'} type - 设置项类型
 * @property {string} id - 设置项唯一标识
 * @property {string} label - 显示标签
 * @property {string} [description] - 详细描述
 * @property {any} [value] - 默认值
 * @property {Array<{value: any, label: string}>} [options] - 选项列表（select类型）
 * @property {string} [buttonText] - 按钮文本（button类型）
 * @property {number} [min] - 最小值（slider类型）
 * @property {number} [max] - 最大值（slider类型）
 * @property {number} [step] - 步长（slider类型）
 * @property {string} [placeholder] - 占位符文本（input类型）
 * @property {(value: any) => void} [onChange] - 值变化回调
 * @property {() => void} [onClick] - 点击回调（button类型）
 * @property {boolean} [disabled] - 是否禁用
 */

/**
 * 设置部分配置
 * @typedef {Object} SettingsSectionConfig
 * @property {string} id - 部分唯一标识
 * @property {string} title - 部分标题
 * @property {string} [description] - 部分描述
 * @property {SettingItemConfig[]} items - 设置项列表
 * @property {number} [order] - 显示顺序
 */

/**
 * 右键菜单项配置
 * @typedef {Object} ContextMenuItemConfig
 * @property {string} id - 菜单项唯一标识
 * @property {string} label - 显示标签
 * @property {string} [icon] - 图标（emoji或CSS类名）
 * @property {string[]} [contexts] - 显示上下文 ['track', 'album', 'artist', 'playlist']
 * @property {boolean} [separator] - 是否为分隔符
 * @property {(context: MenuContext) => void} onClick - 点击回调
 * @property {(context: MenuContext) => boolean} [visible] - 可见性判断函数
 * @property {(context: MenuContext) => boolean} [enabled] - 启用状态判断函数
 */

/**
 * 右键菜单上下文
 * @typedef {Object} MenuContext
 * @property {string} type - 上下文类型 'track'|'album'|'artist'|'playlist'
 * @property {Track|Album|Artist|Object} [item] - 被右键点击的项目
 * @property {number} [index] - 项目在列表中的索引
 * @property {Array} [selection] - 选中的项目列表
 * @property {HTMLElement} [element] - 触发右键的DOM元素
 */
