/**
 * 应用主类
 * 负责应用的初始化、启动和生命周期管理
 */

import {app} from 'electron';
import {ServiceContainer} from './ServiceContainer';
import {WindowManager} from './WindowManager';
import {ConfigManager} from './ConfigManager';
import {BaseController} from '../decorators/IpcHandler';

/**
 * 性能计时器
 */
class PerformanceTimer {
    private marks = new Map<string, number>();

    mark(name: string): void {
        this.marks.set(name, Date.now());
    }

    measure(name: string, startMark: string): number {
        const start = this.marks.get(startMark);
        if (!start) return 0;
        const duration = Date.now() - start;
        console.log(`⏱️ ${name}: ${duration}ms`);
        return duration;
    }

    getStats(): Record<string, number> {
        const stats: Record<string, number> = {};
        const entries = Array.from(this.marks.entries());
        for (let i = 1; i < entries.length; i++) {
            const [name, time] = entries[i];
            const [prevName, prevTime] = entries[i - 1];
            stats[`${prevName}->${name}`] = time - prevTime;
        }
        return stats;
    }
}

/**
 * 应用类
 */
export class Application {
    private container: ServiceContainer;
    private windowManager: WindowManager;
    private configManager: ConfigManager;
    private controllers: BaseController[] = [];
    private isInitialized = false;
    private perfTimer = new PerformanceTimer();

    constructor() {
        this.container = new ServiceContainer();
        this.configManager = new ConfigManager();
        this.windowManager = new WindowManager();
    }

    /**
     * 启动应用
     */
    async start(): Promise<void> {
        if (this.isInitialized) {
            console.warn('⚠️ 应用已经初始化');
            return;
        }

        this.perfTimer.mark('start');
        console.log('🚀 应用启动中...');

        try {
            // 1. 应用配置
            this.applyConfiguration();
            this.perfTimer.mark('config');

            // 2. 初始化核心服务
            // 仅注册，不实例化
            await this.initializeCoreServices();
            this.perfTimer.mark('services');

            // 3. 注册关键控制器（仅窗口创建必需的）
            await this.registerCriticalControllers();
            this.perfTimer.mark('critical-controllers');

            // 4. 创建主窗口
            // 优先显示界面
            await this.windowManager.createMainWindow();
            this.perfTimer.mark('window');

            this.isInitialized = true;

            const windowTime = this.perfTimer.measure('窗口显示总耗时', 'start');
            console.log('✅ 应用窗口已显示');
            console.log(`📊 启动性能: ${windowTime}ms`);

            // 5. 后台注册其余控制器
            this.registerNonCriticalControllers().catch(e => console.error('❌ 非关键控制器注册失败:', e));

            // 6. 后台初始化重型服务
            this.initializeHeavyServices().catch(e => console.error('❌ 后台服务初始化失败:', e));

            // 7. 启动自动扫描调度器
            this.startAutoScanner().catch(e => console.error('❌ 自动扫描调度器启动失败:', e));
        } catch (error) {
            console.error('❌ 应用启动失败:', error);
            throw error;
        }
    }

    private async startAutoScanner(): Promise<void> {
        try {
            const scheduler = await this.container.get<any>('autoScanScheduler');
            const networkFileAdapter = await this.container.get<any>('networkFileAdapter');
            const {parseMetadata} = await import('../utils/metadata');

            const settingsLoader = async () => {
                const config = await this.configManager.loadConfig('music-folders-settings');
                return config || {
                    musicFolders: [],
                    autoScanEnabled: false,
                    scanFrequency: 'on_startup',
                    lastScanTime: 0
                };
            };

            const scanHandler = async (folders: string[]) => {
                for (const folder of folders) {
                    const isNetwork = networkFileAdapter.isNetworkPath(folder);
                    // 简化扫描：依赖 LibraryController 的扫描逻辑
                    console.log(`🔍 AutoScan: 扫描文件夹 ${folder} (${isNetwork ? '网络' : '本地'})`);
                }
                void parseMetadata; // keep import used
            };

            scheduler.initialize(scanHandler, settingsLoader);
            await scheduler.start();
        } catch (error) {
            console.warn('⚠️ 自动扫描调度器启动失败:', error);
        }
    }

    /**
     * 应用配置
     */
    private applyConfiguration(): void {
        console.log('🔧 应用配置...');

        // 硬件加速设置
        const hardwareAcceleration = this.configManager.loadHardwareAccelerationSettings();
        if (!hardwareAcceleration) {
            console.log('🔧 禁用硬件加速');
            app.disableHardwareAcceleration();
        } else {
            console.log('✅ 硬件加速已启用');
        }

        // GC 标志
        app.commandLine.appendSwitch('js-flags', '--expose-gc');
    }

    /**
     * 初始化核心服务（仅注册，不实例化）
     */
    private async initializeCoreServices(): Promise<void> {
        console.log('📦 注册核心服务...');

        // 注册核心服务
        // 立即注册
        this.container.register('windowManager', () => this.windowManager);
        this.container.register('configManager', () => this.configManager);

        // 注册网络服务
        // 延迟实例化
        const {initializeGlobalDriveRegistry} = await import('../services/network/DriveRegistry');
        this.container.register('driveRegistry', async () => {
            return initializeGlobalDriveRegistry();
        });

        const {NetworkDriveManager} = await import('../services/network/NetworkDriveManager');
        this.container.register('networkDriveManager', async () => {
            const manager = new NetworkDriveManager();
            await manager.initialize();
            return manager;
        });

        const {NetworkFileAdapter} = await import('../services/network/NetworkFileAdapter');
        this.container.register('networkFileAdapter', async () => {
            const manager = await this.container.get<InstanceType<typeof NetworkDriveManager>>('networkDriveManager');
            return new NetworkFileAdapter(manager);
        });

        // 注册音乐库服务
        // 延迟加载缓存
        const {LibraryCacheManager} = await import('../services/library/LibraryCacheManager');
        this.container.register('libraryCacheManager', async () => {
            const adapter = await this.container.get<InstanceType<typeof NetworkFileAdapter>>('networkFileAdapter');
            const manager = new LibraryCacheManager(adapter);

            // 不在这里加载缓存，延迟到后台，因此注释
            // await manager.loadCache();

            return manager;
        });

        // 注册元数据处理器（按需初始化）
        const {MetadataHandler} = await import('../services/library/MetadataHandler');
        this.container.register('metadataHandler', async () => {
            const handler = new MetadataHandler();

            // 不在这里初始化 Python 进程，首次使用时再初始化，因此注释
            // await handler.initialize();

            return handler;
        });

        const {AutoScanScheduler} = await import('../services/library/AutoScanScheduler');
        this.container.register('autoScanScheduler', () => new AutoScanScheduler());

        const {ExtensionInstaller} = await import('../services/extensions/ExtensionInstaller');
        this.container.register('extensionInstaller', () => new ExtensionInstaller());

        console.log(`✅ 核心服务注册完成 (${this.container.getStats().registered} 个)`);
    }

    /**
     * 后台初始化重型服务
     */
    private async initializeHeavyServices(): Promise<void> {
        console.log('🔄 加载音乐库缓存...');
        try {
            // 加载音乐库缓存（可能很慢）
            const libraryCacheManager = await this.container.get<any>('libraryCacheManager');
            await libraryCacheManager.loadCache();
            console.log('✅ 音乐库缓存加载完成');

            this.windowManager.sendToMainWindow('library:updated', libraryCacheManager.getAllTracks());
        } catch (error) {
            console.error('❌ 重型服务初始化失败:', error);
        }
    }

    /**
     * 注册关键控制器（窗口创建前必需）
     */
    private async registerCriticalControllers(): Promise<void> {
        console.log('🎮 注册关键控制器...');

        // 加载关键控制器模块
        const {WindowController} = await import('../controllers/WindowController');
        const {AppController} = await import('../controllers/AppController');
        const {DialogController} = await import('../controllers/DialogController');
        const {AudioController} = await import('../controllers/AudioController');
        const {NativeAudioController} = await import('../controllers/NativeAudioController');
        const {parseMetadata} = await import('../utils/metadata');

        // 获取必需的服务（轻量级）
        const networkFileAdapter = await this.container.get<any>('networkFileAdapter');

        const boundParseMetadata = (filePath: string) =>
            parseMetadata(filePath, networkFileAdapter.isNetworkPath(filePath) ? networkFileAdapter : null, {skipCover: true});

        // 尝试加载原生音频模块
        let nativeAudioModule: any = null;
        try {
            nativeAudioModule = require('../NativeAudio.node');
        } catch {
            console.warn('⚠️ 原生音频模块未找到，NativeAudio功能不可用');
        }

        const criticalControllers = [
            new WindowController(this.windowManager),
            new AppController(this.windowManager),
            new DialogController(this.windowManager),
            new AudioController(boundParseMetadata),
            new NativeAudioController(nativeAudioModule, this.windowManager, networkFileAdapter)
        ];

        for (const controller of criticalControllers) {
            controller.register();
            this.controllers.push(controller);
        }

        console.log(`✅ 关键控制器注册完成 (${criticalControllers.length} 个)`);
    }

    /**
     * 注册非关键控制器（窗口显示后后台加载）
     */
    private async registerNonCriticalControllers(): Promise<void> {
        const startTime = Date.now();
        console.log('🔄 后台注册非关键控制器...');

        // 动态加载控制器模块
        const [
            {DesktopLyricsController},
            {NetworkController},
            {LibraryController},
            {SystemController},
            {SettingsController},
            {MemoryController},
            {UserDataController},
            {HardwareAccelerationController},
            {GlobalShortcutsController},
            {ExtensionsController},
            {CoversController},
            {LyricsController},
            {TrayController},
            {HttpServerController},
            {parseMetadata}
        ] = await Promise.all([
            import('../controllers/DesktopLyricsController'),
            import('../controllers/NetworkController'),
            import('../controllers/LibraryController'),
            import('../controllers/SystemController'),
            import('../controllers/SettingsController'),
            import('../controllers/MemoryController'),
            import('../controllers/UserDataController'),
            import('../controllers/HardwareAccelerationController'),
            import('../controllers/GlobalShortcutsController'),
            import('../controllers/ExtensionsController'),
            import('../controllers/CoversController'),
            import('../controllers/LyricsController'),
            import('../controllers/TrayController'),
            import('../controllers/HttpServerController'),
            import('../utils/metadata')
        ]);

        // 获取服务（按需实例化）
        const networkDriveManager = await this.container.get<any>('networkDriveManager');
        const networkFileAdapter = await this.container.get<any>('networkFileAdapter');
        const libraryCacheManager = await this.container.get<any>('libraryCacheManager');
        const metadataHandler = await this.container.get<any>('metadataHandler');
        const extensionInstaller = await this.container.get<any>('extensionInstaller');

        // 获取已注册的 AudioController
        const audioController = this.controllers.find(c => c.constructor.name === 'AudioController') as any;

        const nonCriticalControllers = [
            new DesktopLyricsController(this.windowManager),
            new NetworkController(networkDriveManager, networkFileAdapter, this.windowManager),
            new LibraryController(
                libraryCacheManager, metadataHandler, networkDriveManager,
                networkFileAdapter, this.windowManager, parseMetadata, audioController.state
            ),
            new SystemController(),
            new SettingsController(),
            new MemoryController(),
            new UserDataController(),
            new HardwareAccelerationController(),
            new GlobalShortcutsController(this.windowManager),
            new ExtensionsController(extensionInstaller, this.windowManager),
            new CoversController(),
            new LyricsController(networkFileAdapter),
            (() => {
                const trayCtrl = new TrayController(this.windowManager);
                this.windowManager.setTraySettingsGetter(() => trayCtrl.getSettings());
                return trayCtrl;
            })(),
            new HttpServerController()
        ];

        for (const controller of nonCriticalControllers) {
            controller.register();
            this.controllers.push(controller);
        }

        const duration = Date.now() - startTime;
        console.log(`✅ 非关键控制器注册完成 (${nonCriticalControllers.length} 个, ${duration}ms)`);
    }

    /**
     * 停止应用
     */
    async stop(): Promise<void> {
        console.log('🛑 应用关闭中...');

        try {
            // 停止自动扫描
            if (this.container.isInstantiated('autoScanScheduler')) {
                const scheduler = this.container.getSync<any>('autoScanScheduler');
                scheduler.stop();
            }

            // 保存缓存
            if (this.container.isInstantiated('libraryCacheManager')) {
                await this.container.getSync<any>('libraryCacheManager').saveCache();
            }

            // 清理网络磁盘
            if (this.container.isInstantiated('networkDriveManager')) {
                this.container.getSync<any>('networkDriveManager').cleanup();
            }

            // 注销所有控制器
            for (const controller of this.controllers) {
                controller.unregister();
            }

            // 关闭所有窗口
            this.windowManager.closeAllWindows();

            console.log('✅ 应用已关闭');
        } catch (error) {
            console.error('❌ 应用关闭失败:', error);
        }
    }

    /**
     * 创建主窗口
     */
    async createMainWindow(): Promise<void> {
        await this.windowManager.createMainWindow();
    }
}
