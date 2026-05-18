import {ExtensionService} from "@extensions/core/ExtensionService";
import {InstantiationService, ServiceCollection} from "@extensions/core/Instantiation";
import {ActivationEvents} from "@extensions/core/ExtensionsRegistry";
import {pluginManagerService} from "@services/plugins/PluginManagerService";
import type {AppEventEmitterPort, PluginBootstrapHost} from './AppRuntimePorts';

interface PluginBootstrapOptions {
    app: PluginBootstrapHost & AppEventEmitterPort;
}

export class PluginBootstrap {
    private readonly app: PluginBootstrapHost & AppEventEmitterPort;

    constructor({app}: PluginBootstrapOptions) {
        this.app = app;
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

        try {
            document.dispatchEvent(new CustomEvent('appReady', {
                detail: {
                    app,
                    components: app.components,
                    isInitialized: app.isInitialized
                }
            }));

            console.log('✅ App: 应用就绪事件已触发');
        } catch (error) {
            console.error('❌ App: 通知插件系统失败:', error);
        }
    }
}

export {};
