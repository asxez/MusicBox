/**
 * 插件测试工具
 * 提供插件功能的自动化测试和验证
 */

class PluginTester {
    constructor() {
        this.testResults = new Map();
        this.isRunning = false;
    }

    // 运行所有测试
    async runAllTests() {
        if (this.isRunning) {
            console.warn('🧪 PluginTester: 测试已在运行中');
            return;
        }

        this.isRunning = true;
        this.testResults.clear();
        
        console.log('🧪 PluginTester: 开始运行所有测试...');

        try {
            // 测试插件系统核心功能
            await this.testPluginSystemCore();
            
            // 测试插件管理器
            await this.testPluginManager();
            
            // 测试插件加载器
            await this.testPluginLoader();
            
            // 测试插件API
            await this.testPluginAPI();
            
            // 测试示例插件
            await this.testExamplePlugins();
            
            // 测试开发工具
            await this.testDevTools();
            
            // 生成测试报告
            this.generateTestReport();
            
        } catch (error) {
            console.error('🧪 PluginTester: 测试运行失败:', error);
        } finally {
            this.isRunning = false;
        }
    }

    // 测试插件系统核心功能
    async testPluginSystemCore() {
        const testName = 'PluginSystemCore';
        console.log(`🧪 测试: ${testName}`);
        
        const tests = [
            {
                name: '插件系统初始化',
                test: () => !!window.plugins && !!window.pluginManager
            },
            {
                name: '插件管理器可用',
                test: () => window.pluginManager?.isInitialized === true
            },
            {
                name: '插件加载器可用',
                test: () => !!window.pluginLoader
            },
            {
                name: '插件API可用',
                test: () => !!window.pluginAPI
            },
            {
                name: '插件基类可用',
                test: () => !!window.PluginBase
            },
            {
                name: '开发工具可用',
                test: () => !!window.pluginDevTools
            }
        ];

        const results = [];
        for (const test of tests) {
            try {
                const passed = await test.test();
                results.push({ name: test.name, passed, error: null });
                console.log(`  ${passed ? '✅' : '❌'} ${test.name}`);
            } catch (error) {
                results.push({ name: test.name, passed: false, error: error.message });
                console.log(`  ❌ ${test.name}: ${error.message}`);
            }
        }

        this.testResults.set(testName, results);
    }

    // 测试插件管理器
    async testPluginManager() {
        const testName = 'PluginManager';
        console.log(`🧪 测试: ${testName}`);
        
        const manager = window.pluginManager;
        const tests = [
            {
                name: '获取插件列表',
                test: () => Array.isArray(manager.getAllPlugins())
            },
            {
                name: '插件配置管理',
                test: () => manager.pluginConfigs instanceof Map
            },
            {
                name: '插件状态管理',
                test: () => manager.pluginStates instanceof Map
            },
            {
                name: '事件发射器功能',
                test: () => typeof manager.emit === 'function'
            }
        ];

        const results = await this.runTestSuite(tests);
        this.testResults.set(testName, results);
    }

    // 测试插件加载器
    async testPluginLoader() {
        const testName = 'PluginLoader';
        console.log(`🧪 测试: ${testName}`);
        
        const loader = window.pluginLoader;
        const tests = [
            {
                name: '加载器实例存在',
                test: () => !!loader
            },
            {
                name: '脚本加载功能',
                test: () => typeof loader.loadPluginScript === 'function'
            },
            {
                name: '脚本卸载功能',
                test: () => typeof loader.unloadPluginScript === 'function'
            },
            {
                name: '热重载功能',
                test: () => typeof loader.reloadPluginScript === 'function'
            }
        ];

        const results = await this.runTestSuite(tests);
        this.testResults.set(testName, results);
    }

    // 测试插件API
    async testPluginAPI() {
        const testName = 'PluginAPI';
        console.log(`🧪 测试: ${testName}`);
        
        const api = window.pluginAPI;
        const tests = [
            {
                name: 'API实例存在',
                test: () => !!api
            },
            {
                name: '获取所有API',
                test: () => {
                    const apis = api.getAllAPIs();
                    return typeof apis === 'object' && apis.player && apis.library;
                }
            },
            {
                name: '创建插件上下文',
                test: () => {
                    const context = api.createPluginContext('test');
                    return context && context.player && context.library;
                }
            },
            {
                name: 'API扩展功能',
                test: () => typeof api.extendAPI === 'function'
            }
        ];

        const results = await this.runTestSuite(tests);
        this.testResults.set(testName, results);
    }

    // 测试示例插件
    async testExamplePlugins() {
        const testName = 'ExamplePlugins';
        console.log(`🧪 测试: ${testName}`);
        
        const tests = [
            {
                name: '基础插件模板',
                test: async () => {
                    const code = window.pluginDevServer?.getBasicTemplate();
                    return !!code && code.includes('PluginBase');
                }
            },
            {
                name: 'UI扩展模板',
                test: async () => {
                    const code = window.pluginDevServer?.getUITemplate();
                    return !!code && code.includes('addSidebarItem');
                }
            },
            {
                name: '音乐增强模板',
                test: async () => {
                    const code = window.pluginDevServer?.getMusicTemplate();
                    return !!code && code.includes('onTrackChanged');
                }
            }
        ];

        const results = await this.runTestSuite(tests);
        this.testResults.set(testName, results);
    }

    // 测试开发工具
    async testDevTools() {
        const testName = 'DevTools';
        console.log(`🧪 测试: ${testName}`);
        
        const devTools = window.pluginDevTools;
        const tests = [
            {
                name: '开发工具存在',
                test: () => !!devTools
            },
            {
                name: '开发模式切换',
                test: () => {
                    const wasEnabled = devTools.isEnabled;
                    devTools.enable();
                    const enabled = devTools.isEnabled;
                    if (!wasEnabled) devTools.disable();
                    return enabled;
                }
            },
            {
                name: '全局开发工具',
                test: () => {
                    devTools.enable();
                    const hasGlobalTools = !!window.pluginDev;
                    devTools.disable();
                    return hasGlobalTools;
                }
            }
        ];

        const results = await this.runTestSuite(tests);
        this.testResults.set(testName, results);
    }

    // 运行测试套件
    async runTestSuite(tests) {
        const results = [];
        
        for (const test of tests) {
            try {
                const passed = await test.test();
                results.push({ name: test.name, passed, error: null });
                console.log(`  ${passed ? '✅' : '❌'} ${test.name}`);
            } catch (error) {
                results.push({ name: test.name, passed: false, error: error.message });
                console.log(`  ❌ ${test.name}: ${error.message}`);
            }
        }
        
        return results;
    }

    // 生成测试报告
    generateTestReport() {
        console.log('\n🧪 =============== 插件系统测试报告 ===============');
        
        let totalTests = 0;
        let passedTests = 0;
        
        for (const [suiteName, results] of this.testResults) {
            const suiteTotal = results.length;
            const suitePassed = results.filter(r => r.passed).length;
            
            totalTests += suiteTotal;
            passedTests += suitePassed;
            
            console.log(`\n📋 ${suiteName}: ${suitePassed}/${suiteTotal} 通过`);
            
            results.forEach(result => {
                const status = result.passed ? '✅' : '❌';
                const error = result.error ? ` (${result.error})` : '';
                console.log(`  ${status} ${result.name}${error}`);
            });
        }
        
        const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;
        
        console.log(`\n📊 总体结果: ${passedTests}/${totalTests} 通过 (${successRate}%)`);
        
        if (successRate >= 90) {
            console.log('🎉 插件系统测试通过！');
        } else if (successRate >= 70) {
            console.log('⚠️ 插件系统基本可用，但有一些问题需要修复');
        } else {
            console.log('❌ 插件系统存在严重问题，需要修复');
        }
        console.log('===============================================\n');
        return {
            totalTests,
            passedTests,
            successRate,
            results: Object.fromEntries(this.testResults)
        };
    }

    // 测试特定插件
    async testPlugin(pluginId) {
        console.log(`🧪 测试插件: ${pluginId}`);
        
        const plugin = window.plugins?.get(pluginId);
        if (!plugin) {
            console.error(`❌ 插件不存在: ${pluginId}`);
            return false;
        }

        const tests = [
            {
                name: '插件实例有效',
                test: () => !!plugin
            },
            {
                name: '插件已激活',
                test: () => plugin.isActive === true
            },
            {
                name: '插件有ID',
                test: () => !!plugin.id
            },
            {
                name: '插件有名称',
                test: () => !!plugin.name
            },
            {
                name: '插件有版本',
                test: () => !!plugin.version
            },
            {
                name: '插件有上下文',
                test: () => !!plugin.context
            },
            {
                name: '插件有激活方法',
                test: () => typeof plugin.activate === 'function'
            },
            {
                name: '插件有停用方法',
                test: () => typeof plugin.deactivate === 'function'
            }
        ];

        const results = await this.runTestSuite(tests);
        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        console.log(`📊 插件 ${pluginId} 测试结果: ${passed}/${total} 通过`);
        return passed === total;
    }

    // 创建测试插件
    async createTestPlugin() {
        const testCode = `
            class TestPlugin extends PluginBase {
                constructor(context) {
                    super(context);
                    this.testData = {
                        created: Date.now(),
                        activations: 0,
                        commands: 0
                    };
                }
                
                async activate() {
                    await super.activate();
                    this.testData.activations++;
                    
                    // 注册测试命令
                    this.registerCommand('test', () => {
                        this.testData.commands++;
                        return 'Test command executed';
                    });
                    
                    // 添加测试样式
                    this.addStyle('.test-plugin { color: red; }');
                    
                    // 显示通知
                    this.showNotification('测试插件已激活', 'success');
                    
                    console.log('🧪 TestPlugin: 激活成功');
                }
                
                async deactivate() {
                    await super.deactivate();
                    console.log('🧪 TestPlugin: 停用成功');
                }
                
                getTestData() {
                    return this.testData;
                }
            }
            
            window.PluginClass = TestPlugin;
        `;

        try {
            const pluginId = `test-plugin-${Date.now()}`;
            await window.plugins?.dev?.create(pluginId, testCode);
            
            console.log(`🧪 PluginTester: 测试插件 ${pluginId} 创建成功`);
            return pluginId;
            
        } catch (error) {
            console.error('🧪 PluginTester: 创建测试插件失败:', error);
            throw error;
        }
    }

    // 运行插件功能测试
    async runPluginFunctionalTest(pluginId) {
        console.log(`🧪 运行插件功能测试: ${pluginId}`);
        
        const plugin = window.plugins?.get(pluginId);
        if (!plugin) {
            throw new Error(`插件不存在: ${pluginId}`);
        }

        const tests = [];

        // 测试基础功能
        if (typeof plugin.getTestData === 'function') {
            tests.push({
                name: '获取测试数据',
                test: async () => {
                    const data = plugin.getTestData();
                    return data && typeof data === 'object';
                }
            });
        }

        // 测试命令执行
        try {
            const commandResult = await window.pluginManager?.executeCommand(`${pluginId}.test`);
            tests.push({
                name: '命令执行',
                test: () => commandResult === 'Test command executed'
            });
        } catch (error) {
            tests.push({
                name: '命令执行',
                test: () => false,
                error: error.message
            });
        }

        // 测试存储功能
        tests.push({
            name: '存储功能',
            test: () => {
                plugin.setStorage('test', 'value');
                const value = plugin.getStorage('test');
                plugin.removeStorage('test');
                return value === 'value';
            }
        });

        // 测试通知功能
        tests.push({
            name: '通知功能',
            test: () => {
                try {
                    plugin.showNotification('测试通知', 'info');
                    return true;
                } catch (error) {
                    return false;
                }
            }
        });

        const results = await this.runTestSuite(tests);
        this.testResults.set(`Plugin_${pluginId}`, results);
        
        return results;
    }

    // 测试插件热重载
    async testHotReload() {
        console.log('🧪 测试插件热重载功能');
        
        try {
            // 创建测试插件
            const pluginId = await this.createTestPlugin();
            
            // 等待加载完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 验证插件已加载
            let plugin = window.plugins?.get(pluginId);
            if (!plugin) {
                throw new Error('测试插件未加载');
            }
            
            const originalActivations = plugin.getTestData().activations;
            
            // 执行热重载
            await window.plugins?.reload(pluginId);
            
            // 等待重载完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 验证重载后的插件
            plugin = window.plugins?.get(pluginId);
            if (!plugin) {
                throw new Error('热重载后插件丢失');
            }
            
            const newActivations = plugin.getTestData().activations;
            
            // 清理测试插件
            await window.plugins?.uninstall(pluginId);
            
            console.log('✅ 热重载测试通过');
            return newActivations > originalActivations;
            
        } catch (error) {
            console.error('❌ 热重载测试失败:', error);
            return false;
        }
    }

    // 性能测试
    async runPerformanceTest() {
        console.log('🧪 运行性能测试');
        
        const startTime = performance.now();
        
        // 创建多个测试插件
        const pluginIds = [];
        for (let i = 0; i < 5; i++) {
            try {
                const pluginId = await this.createTestPlugin();
                pluginIds.push(pluginId);
            } catch (error) {
                console.warn(`创建测试插件 ${i} 失败:`, error);
            }
        }
        
        const loadTime = performance.now() - startTime;
        
        // 测试插件操作性能
        const operationStartTime = performance.now();
        
        for (const pluginId of pluginIds) {
            try {
                await window.plugins?.disable(pluginId);
                await window.plugins?.enable(pluginId);
            } catch (error) {
                console.warn(`插件操作失败 ${pluginId}:`, error);
            }
        }
        
        const operationTime = performance.now() - operationStartTime;
        
        // 清理测试插件
        for (const pluginId of pluginIds) {
            try {
                await window.plugins?.uninstall(pluginId);
            } catch (error) {
                console.warn(`清理插件失败 ${pluginId}:`, error);
            }
        }
        
        const totalTime = performance.now() - startTime;
        
        const performanceResults = {
            pluginCount: pluginIds.length,
            loadTime: Math.round(loadTime),
            operationTime: Math.round(operationTime),
            totalTime: Math.round(totalTime),
            avgLoadTime: Math.round(loadTime / pluginIds.length),
            avgOperationTime: Math.round(operationTime / (pluginIds.length * 2))
        };
        
        console.log('📊 性能测试结果:', performanceResults);
        
        return performanceResults;
    }

    // 获取测试结果
    getTestResults() {
        return Object.fromEntries(this.testResults);
    }

    // 显示测试报告UI
    showTestReportUI() {
        const results = this.getTestResults();
        
        // 创建报告窗口
        const reportWindow = document.createElement('div', {
            className: 'test-report-window',
            innerHTML: `
                <div class="test-report-header">
                    <h3>🧪 插件系统测试报告</h3>
                    <button onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="test-report-content">
                    ${this.generateReportHTML(results)}
                </div>
            `
        });
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .test-report-window {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 600px;
                max-height: 80vh;
                background: var(--color-secondary-bg);
                border: 1px solid var(--color-border);
                border-radius: 12px;
                box-shadow: var(--shadow-large);
                z-index: 10000;
                overflow: hidden;
            }
            
            .test-report-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                background: var(--color-primary);
                color: white;
            }
            
            .test-report-content {
                padding: 16px;
                max-height: calc(80vh - 60px);
                overflow-y: auto;
            }
            
            .test-suite {
                margin-bottom: 20px;
                border: 1px solid var(--color-border);
                border-radius: 8px;
                overflow: hidden;
            }
            
            .test-suite-header {
                padding: 12px 16px;
                background: var(--color-body-bg);
                font-weight: 600;
                border-bottom: 1px solid var(--color-border);
            }
            
            .test-result {
                padding: 8px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--color-border);
            }
            
            .test-result:last-child {
                border-bottom: none;
            }
            
            .test-result.passed {
                background: rgba(46, 213, 115, 0.1);
            }
            
            .test-result.failed {
                background: rgba(255, 71, 87, 0.1);
            }
            
            .test-status {
                font-weight: 600;
            }
            
            .test-status.passed {
                color: var(--color-success);
            }
            
            .test-status.failed {
                color: var(--color-danger);
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(reportWindow);
    }

    // 生成报告HTML
    generateReportHTML(results) {
        let html = '';
        
        for (const [suiteName, suiteResults] of Object.entries(results)) {
            const passed = suiteResults.filter(r => r.passed).length;
            const total = suiteResults.length;
            
            html += `
                <div class="test-suite">
                    <div class="test-suite-header">
                        ${suiteName} (${passed}/${total})
                    </div>
                    ${suiteResults.map(result => `
                        <div class="test-result ${result.passed ? 'passed' : 'failed'}">
                            <span>${result.name}</span>
                            <span class="test-status ${result.passed ? 'passed' : 'failed'}">
                                ${result.passed ? '✅ 通过' : '❌ 失败'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        return html;
    }
}

window.PluginTester = PluginTester;
window.pluginTester = new PluginTester();

// 快捷测试方法
window.testPluginSystem = () => window.pluginTester.runAllTests();
window.testPlugin = (id) => window.pluginTester.testPlugin(id);

console.log('🧪 插件测试工具加载完成');
console.log('💡 使用 window.testPluginSystem() 运行完整测试');
console.log('💡 使用 window.testPlugin(id) 测试特定插件');
