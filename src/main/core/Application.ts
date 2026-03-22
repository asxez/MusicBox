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
 * 应用类
 */
export class Application {
    private container: ServiceContainer;
    private windowManager: WindowManager;
    private configManager: ConfigManager;
    private controllers: BaseController[] = [];
    private isInitialized = false;

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

        console.log('🚀 应用启动中...');

        try {
            // 1. 应用配置
            this.applyConfiguration();

            // 2. 初始化服务
            await this.initializeServices();

            // 3. 注册控制器
            await this.registerControllers();

            // 4. 创建主窗口
            await this.windowManager.createMainWindow();

            this.isInitialized = true;
            console.log('✅ 应用启动完成');

            // 5. 启动自动扫描调度器（窗口创建后）
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
     * 初始化服务
     * 注册所有服务到容器中
     */
    private async initializeServices(): Promise<void> {
        console.log('📦 初始化服务...');

        // 注册核心服务
        this.container.register('windowManager', () => this.windowManager);
        this.container.register('configManager', () => this.configManager);

        // 注册网络服务
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
        const {LibraryCacheManager} = await import('../services/library/LibraryCacheManager');
        this.container.register('libraryCacheManager', async () => {
            const adapter = await this.container.get<InstanceType<typeof NetworkFileAdapter>>('networkFileAdapter');
            const manager = new LibraryCacheManager(adapter);
            await manager.loadCache();
            return manager;
        });

        const {MetadataHandler} = await import('../services/library/MetadataHandler');
        this.container.register('metadataHandler', async () => {
            const handler = new MetadataHandler();
            await handler.initialize();
            return handler;
        });

        const {AutoScanScheduler} = await import('../services/library/AutoScanScheduler');
        this.container.register('autoScanScheduler', () => new AutoScanScheduler());

        const {ExtensionInstaller} = await import('../services/extensions/ExtensionInstaller');
        this.container.register('extensionInstaller', () => new ExtensionInstaller());

        console.log(`✅ 服务注册完成 (${this.container.getStats().registered} 个)`);
    }

    /**
     * 注册控制器
     * 创建并注册所有 IPC 控制器
     */
    private async registerControllers(): Promise<void> {
        console.log('🎮 注册控制器...');

        const {AudioController} = await import('../controllers/AudioController');
        const {WindowController} = await import('../controllers/WindowController');
        const {DesktopLyricsController} = await import('../controllers/DesktopLyricsController');
        const {NetworkController} = await import('../controllers/NetworkController');
        const {LibraryController} = await import('../controllers/LibraryController');
        const {AppController} = await import('../controllers/AppController');
        const {DialogController} = await import('../controllers/DialogController');
        const {SystemController} = await import('../controllers/SystemController');
        const {SettingsController} = await import('../controllers/SettingsController');
        const {MemoryController} = await import('../controllers/MemoryController');
        const {UserDataController} = await import('../controllers/UserDataController');
        const {HardwareAccelerationController} = await import('../controllers/HardwareAccelerationController');
        const {GlobalShortcutsController} = await import('../controllers/GlobalShortcutsController');
        const {ExtensionsController} = await import('../controllers/ExtensionsController');
        const {CoversController} = await import('../controllers/CoversController');
        const {LyricsController} = await import('../controllers/LyricsController');
        const {TrayController} = await import('../controllers/TrayController');
        const {HttpServerController} = await import('../controllers/HttpServerController');
        const {NativeAudioController} = await import('../controllers/NativeAudioController');

        const networkDriveManager = await this.container.get<any>('networkDriveManager');
        const networkFileAdapter = await this.container.get<any>('networkFileAdapter');
        const libraryCacheManager = await this.container.get<any>('libraryCacheManager');
        const metadataHandler = await this.container.get<any>('metadataHandler');
        const extensionInstaller = await this.container.get<any>('extensionInstaller');

        const {parseMetadata} = await import('../utils/metadata');

        // 尝试加载原生音频模块（可能不存在）
        let nativeAudioModule: any = null;
        try {
            nativeAudioModule = require('../NativeAudio.node');
        } catch {
            console.warn('⚠️ 原生音频模块未找到，NativeAudio功能不可用');
        }

        const audioController = new AudioController(parseMetadata);

        this.controllers = [
            audioController,
            new WindowController(this.windowManager),
            new DesktopLyricsController(this.windowManager),
            new NetworkController(networkDriveManager, networkFileAdapter, this.windowManager),
            new LibraryController(
                libraryCacheManager, metadataHandler, networkDriveManager,
                networkFileAdapter, this.windowManager, parseMetadata, audioController.state
            ),
            new AppController(this.windowManager),
            new DialogController(this.windowManager),
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
            new HttpServerController(),
            new NativeAudioController(nativeAudioModule, this.windowManager, networkFileAdapter),
        ];

        for (const controller of this.controllers) {
            controller.register();
        }

        console.log(`✅ 控制器注册完成 (${this.controllers.length} 个)`);
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
