/**
 * Core - 插件系统核心模块入口
 * 加载所有核心组件并初始化
 */

/**
 * 加载核心模块
 */
async function loadCoreModules() {
    const basePath = './js/plugin-system/core';

    const modules = [
        'Lifecycle.js',
        'Event.js',
        'Instantiation.js',
        'ExtensionsRegistry.js',
        'ExtensionActivator.js',
        'ExtensionService.js'
    ];

    for (const module of modules) {
        try {
            await loadScript(`${basePath}/${module}`);
            console.log(`✅ Core: 加载模块 ${module}`);
        } catch (error) {
            console.error(`❌ Core: 加载模块失败 ${module}:`, error);
            throw error;
        }
    }
}

/**
 * 加载脚本
 * @param {String} src
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * 初始化核心系统
 */
async function initializeCoreSystem() {
    try {
        console.log('🔌 Core: 开始初始化核心系统');

        // 创建服务集合
        const services = new ServiceCollection();

        // 创建实例化服务
        const instantiationService = new InstantiationService(services);

        // 创建扩展服务
        const extensionService = instantiationService.createInstance(ExtensionService);

        // 初始化扩展服务
        await extensionService.initialize();

        // 保存到全局
        window.extensionService = extensionService;
        window.instantiationService = instantiationService;

        console.log('✅ Core: 核心系统初始化完成');

        return {
            extensionService,
            instantiationService
        };

    } catch (error) {
        console.error('❌ Core: 核心系统初始化失败:', error);
        throw error;
    }
}

window.loadCoreModules = loadCoreModules;
window.initializeCoreSystem = initializeCoreSystem;
