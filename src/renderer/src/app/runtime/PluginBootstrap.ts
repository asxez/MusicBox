import {ExtensionService} from "@extensions/core/ExtensionService";
import {InstantiationService, ServiceCollection} from "@extensions/core/Instantiation";
import {ActivationEvents} from "@extensions/core/ExtensionsRegistry";
import {pluginManagerService} from "@/features/extensions/service";
import type {
    AppReadyEventDetail,
    MusicBoxApp as LegacyMusicBoxApp,
    MusicBoxPluginHost
} from '@extensions/core/types';
import type {PluginBootstrapHost} from './AppRuntimePorts';
import type {ComponentMap} from './components/ComponentTypes';

interface PluginBootstrapOptions {
    app: PluginBootstrapHost;
    legacyApp?: LegacyMusicBoxApp;
    legacyComponents?: ComponentMap;
}

export class PluginBootstrap {
    private readonly app: PluginBootstrapHost;
    private readonly legacyApp?: LegacyMusicBoxApp;
    private readonly legacyComponents?: ComponentMap;

    constructor({app, legacyApp, legacyComponents}: PluginBootstrapOptions) {
        this.app = app;
        this.legacyApp = legacyApp;
        this.legacyComponents = legacyComponents;
    }

    async initializePluginSystem(): Promise<void> {
        try {
            console.log('🔌 App: 开始初始化插件系统');

            if (typeof ExtensionService === 'undefined') {
                console.error('❌ App: ExtensionService 未定义，插件系统核心模块可能未加载');
                return;
            }

            const services = new ServiceCollection();
            const instantiationService = new InstantiationService(services);
            const extensionService = instantiationService.createInstance(ExtensionService);

            await extensionService.initialize();

            pluginManagerService.bindExtensionService(extensionService);

            console.log('✅ App: 扩展服务初始化成功');

            await extensionService.activateByEvent(ActivationEvents.ON_START_UP);

            console.log('✅ App: 插件系统初始化完成');
        } catch (error) {
            console.error('❌ App: 插件系统初始化失败:', error);
        }
    }

    schedulePluginSystemInitialization(): void {
        const startPluginSystem = async () => {
            await this.initializePluginSystem();
            this.notifyPluginSystemReady();
        };

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(() => {
                startPluginSystem().catch((error) => {
                    console.error('❌ App: 延迟初始化插件系统失败:', error);
                });
            }, {timeout: 2000});
            return;
        }

        setTimeout(() => {
            startPluginSystem().catch((error) => {
                console.error('❌ App: 延迟初始化插件系统失败:', error);
            });
        }, 300);
    }

    notifyPluginSystemReady(): void {
        const app = this.app;
        const pluginHost = this.createPluginReadyHost();

        try {
            const detail: AppReadyEventDetail = {
                pluginHost,
                host: pluginHost,
                app: this.legacyApp ?? app as unknown as LegacyMusicBoxApp,
                components: this.legacyComponents,
                isInitialized: app.isInitialized
            };

            document.dispatchEvent(new CustomEvent<AppReadyEventDetail>('appReady', {detail}));

            console.log('✅ App: 应用就绪事件已触发');
        } catch (error) {
            console.error('❌ App: 通知插件系统失败:', error);
        }
    }

    private createPluginReadyHost(): MusicBoxPluginHost {
        const app = this.app;

        return {
            get isInitialized() {
                return app.isInitialized;
            },
            getCurrentView: () => app.currentView,
            navigateToView: (viewId: string) => app.navigateToView(viewId),
            on: (event, handler) => app.on(event, handler),
            off: (event, handler) => app.off(event, handler),
            emit: (event, ...args) => app.emit(event, ...args),
            removeAllListeners: (event) => app.removeAllListeners(event)
        };
    }
}

export {};
