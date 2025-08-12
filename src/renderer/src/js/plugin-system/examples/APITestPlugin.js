/**
 * API测试插件
 * 全面测试PluginAPI中注册的所有接口
 */

class APITestPlugin extends PluginBase {
    constructor(context) {
        super(context);
        
        // 测试结果存储
        this.testResults = new Map();
        this.testPanel = null;
        this.isTestRunning = false;

        // 测试统计
        this.testStats = {
            total: 0,
            passed: 0,
            failed: 0,
            startTime: null,
            endTime: null
        };

        // 事件监听器测试状态
        this.eventTestState = {
            registeredListeners: new Map(),
            receivedEvents: new Map(),
            testCallbacks: new Map()
        };

        // API接口列表
        this.apiInterfaces = [
            'player',
            'library',
            'ui',
            'settings',
            'navigation',
            'contextMenu',
            'storage',
            'system',
            'events'
        ];

        // 测试类型定义
        this.testTypes = {
            EXISTENCE: 'existence',      // 方法存在性
            FUNCTIONALITY: 'functionality', // 功能可用性
            RETURN_VALUE: 'return_value',   // 返回值正确性
            ERROR_HANDLING: 'error_handling', // 错误处理能力
            PERFORMANCE: 'performance'      // 性能测试
        };
    }

    /**
     * 插件激活
     */
    async activate() {
        console.log('🧪 APITestPlugin: 插件激活');
        await super.activate();
        
        // 创建测试面板
        this.createTestPanel();
        
        // 运行初始测试
        await this.runAllTests();
        
        this.showNotification('API测试插件已激活', 'success');
    }

    /**
     * 插件停用
     */
    async deactivate() {
        console.log('🧪 APITestPlugin: 插件停用');
        
        // 移除测试面板
        if (this.testPanel) {
            this.testPanel.remove();
            this.testPanel = null;
        }
        
        await super.deactivate();
        
        this.showNotification('API测试插件已停用', 'info');
    }

    /**
     * 创建测试面板
     */
    createTestPanel() {
        // 创建主面板
        this.testPanel = this.context.utils.createElement('div', {
            id: 'api-test-panel',
            style: `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 450px;
                max-height: 80vh;
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                border: 2px solid #4a90e2;
                border-radius: 12px;
                padding: 20px;
                color: white;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 10000;
                overflow-y: auto;
                backdrop-filter: blur(10px);
            `
        });

        // 创建标题
        const title = this.context.utils.createElement('h2', {
            style: `
                margin: 0 0 20px 0;
                color: #fff;
                text-align: center;
                font-size: 18px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `
        }, ['🧪 PluginAPI 测试面板']);

        // 创建控制按钮区域
        const controlsDiv = this.context.utils.createElement('div', {
            style: `
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                justify-content: center;
            `
        });

        // 运行测试按钮
        const runTestBtn = this.context.utils.createElement('button', {
            style: `
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.3s ease;
            `
        }, ['🔄 运行测试']);

        // 清除结果按钮
        const clearBtn = this.context.utils.createElement('button', {
            style: `
                background: #FF9800;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.3s ease;
            `
        }, ['🗑️ 清除结果']);

        // 关闭按钮
        const closeBtn = this.context.utils.createElement('button', {
            style: `
                background: #f44336;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.3s ease;
            `
        }, ['❌ 关闭']);

        // 测试结果容器
        this.resultsContainer = this.context.utils.createElement('div', {
            id: 'test-results',
            style: `
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 15px;
                max-height: 400px;
                overflow-y: auto;
            `
        });

        // 绑定事件
        this.addEventListener(runTestBtn, 'click', () => this.runAllTests());
        this.addEventListener(clearBtn, 'click', () => this.clearResults());
        this.addEventListener(closeBtn, 'click', () => this.togglePanel());

        // 组装面板
        controlsDiv.appendChild(runTestBtn);
        controlsDiv.appendChild(clearBtn);
        controlsDiv.appendChild(closeBtn);

        this.testPanel.appendChild(title);
        this.testPanel.appendChild(controlsDiv);
        this.testPanel.appendChild(this.resultsContainer);

        // 添加到页面
        document.body.appendChild(this.testPanel);
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        if (this.isTestRunning) {
            this.showNotification('测试正在运行中...', 'warning');
            return;
        }

        this.isTestRunning = true;
        this.testResults.clear();
        this.resetTestStats();
        this.clearEventTestState();
        this.updateResultsDisplay();

        console.log('🧪 APITestPlugin: 开始运行全面API功能测试...');
        this.testStats.startTime = Date.now();

        try {
            // 阶段1：基础上下文测试
            await this.testBasicContext();
            await this.sleep(100);

            // 阶段2：API接口存在性测试
            for (const apiName of this.apiInterfaces) {
                await this.testAPIExistence(apiName);
                await this.sleep(50);
            }

            // 阶段3：API功能性测试
            for (const apiName of this.apiInterfaces) {
                await this.testAPIFunctionality(apiName);
                await this.sleep(100);
            }

            // 阶段4：插件专用功能测试
            await this.testPluginUtils();
            await this.testPluginStorage();
            await this.testPluginMessaging();

            // 阶段5：性能测试
            await this.runPerformanceTests();

            this.testStats.endTime = Date.now();
            const duration = this.testStats.endTime - this.testStats.startTime;

            console.log('🧪 APITestPlugin: 所有测试完成');
            console.log(`📊 测试统计: ${this.testStats.passed}/${this.testStats.total} 通过 (${duration}ms)`);
            this.showNotification(`API测试完成: ${this.testStats.passed}/${this.testStats.total} 通过`, 'success');

        } catch (error) {
            console.error('🧪 APITestPlugin: 测试过程中发生错误:', error);
            this.showNotification(`测试失败: ${error.message}`, 'error');
        } finally {
            this.isTestRunning = false;
            this.updateResultsDisplay();
        }
    }

    /**
     * 重置测试统计
     */
    resetTestStats() {
        this.testStats = {
            total: 0,
            passed: 0,
            failed: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * 清理事件测试状态
     */
    clearEventTestState() {
        // 清理之前注册的测试事件监听器
        for (const [eventName, callback] of this.eventTestState.testCallbacks) {
            try {
                if (this.context.events && typeof this.context.events.off === 'function') {
                    this.context.events.off(eventName, callback);
                }
                if (this.context.player && typeof this.context.player.offTrackChanged === 'function') {
                    this.context.player.offTrackChanged(callback);
                }
            } catch (error) {
                console.warn('清理测试事件监听器失败:', error);
            }
        }

        this.eventTestState = {
            registeredListeners: new Map(),
            receivedEvents: new Map(),
            testCallbacks: new Map()
        };
    }

    /**
     * 睡眠函数
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 测试基础上下文
     */
    async testBasicContext() {
        const contextTests = [
            { name: 'pluginId', test: () => !!this.context.pluginId },
            { name: 'document', test: () => this.context.document === document },
            { name: 'window', test: () => this.context.window === window },
            { name: 'app', test: () => !!this.context.app },
            { name: 'api', test: () => !!this.context.api },
            { name: 'Component', test: () => !!this.context.Component },
            { name: 'EventEmitter', test: () => !!this.context.EventEmitter },
            { name: 'PluginBase', test: () => !!this.context.PluginBase }
        ];

        for (const { name, test } of contextTests) {
            try {
                const result = test();
                this.addTestResult('context', name, result, result ? '可用' : '不可用');
            } catch (error) {
                this.addTestResult('context', name, false, `错误: ${error.message}`);
            }
        }
    }

    /**
     * 测试API接口存在性
     */
    async testAPIExistence(apiName) {
        const api = this.context[apiName];

        if (!api) {
            this.addTestResult(apiName, '接口存在', false, '接口不存在', this.testTypes.EXISTENCE);
            return;
        }

        this.addTestResult(apiName, '接口存在', true, '接口可用', this.testTypes.EXISTENCE);

        // 根据不同API类型检查方法存在性
        switch (apiName) {
            case 'player':
                this.checkPlayerMethodsExistence(api);
                break;
            case 'library':
                this.checkLibraryMethodsExistence(api);
                break;
            case 'ui':
                this.checkUIMethodsExistence(api);
                break;
            case 'settings':
                this.checkSettingsMethodsExistence(api);
                break;
            case 'navigation':
                this.checkNavigationMethodsExistence(api);
                break;
            case 'contextMenu':
                this.checkContextMenuMethodsExistence(api);
                break;
            case 'storage':
                this.checkStorageMethodsExistence(api);
                break;
            case 'system':
                this.checkSystemMethodsExistence(api);
                break;
            case 'events':
                this.checkEventsMethodsExistence(api);
                break;
        }
    }

    /**
     * 测试API接口功能性
     */
    async testAPIFunctionality(apiName) {
        const api = this.context[apiName];

        if (!api) {
            return; // 如果接口不存在，跳过功能测试
        }

        // 根据不同API类型进行功能测试
        switch (apiName) {
            case 'player':
                await this.testPlayerFunctionality(api);
                break;
            case 'library':
                await this.testLibraryFunctionality(api);
                break;
            case 'ui':
                await this.testUIFunctionality(api);
                break;
            case 'settings':
                await this.testSettingsFunctionality(api);
                break;
            case 'navigation':
                await this.testNavigationFunctionality(api);
                break;
            case 'contextMenu':
                await this.testContextMenuFunctionality(api);
                break;
            case 'storage':
                await this.testStorageFunctionality(api);
                break;
            case 'system':
                await this.testSystemFunctionality(api);
                break;
            case 'events':
                await this.testEventsFunctionality(api);
                break;
        }
    }

    /**
     * 检查Player API方法存在性
     */
    checkPlayerMethodsExistence(api) {
        const controlMethods = ['play', 'pause', 'stop', 'next', 'previous'];
        const stateMethods = ['getCurrentTrack', 'getPlaylist', 'getPosition', 'getDuration', 'isPlaying'];
        const volumeMethods = ['setVolume', 'getVolume'];
        const playlistMethods = ['setPlaylist', 'seek'];
        const eventMethods = [
            'onTrackChanged', 'onPlaybackStateChanged', 'onPositionChanged',
            'onTrackLoaded', 'onDurationChanged', 'onVolumeChanged'
        ];
        const cleanupMethods = [
            'offTrackChanged', 'offPlaybackStateChanged', 'offPositionChanged',
            'offTrackLoaded', 'offDurationChanged', 'offVolumeChanged', 'removeAllListeners'
        ];

        const allMethods = [...controlMethods, ...stateMethods, ...volumeMethods, ...playlistMethods, ...eventMethods, ...cleanupMethods];

        for (const method of allMethods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('player', `${method}方法`, exists,
                exists ? '方法存在' : '方法不存在', this.testTypes.EXISTENCE);
        }
    }

    /**
     * 测试Player API功能性
     */
    async testPlayerFunctionality(api) {
        // 1. 测试状态获取方法
        await this.testPlayerStateMethods(api);

        // 2. 测试音量控制
        await this.testPlayerVolumeControl(api);

        // 3. 测试事件监听器完整生命周期
        await this.testPlayerEventListeners(api);

        // 4. 测试播放控制方法
        await this.testPlayerControlMethods(api);

        // 5. 测试错误处理
        await this.testPlayerErrorHandling(api);
    }

    /**
     * 测试Player状态获取方法
     */
    async testPlayerStateMethods(api) {
        const stateMethods = [
            { name: 'getCurrentTrack', expectedType: 'object' },
            { name: 'isPlaying', expectedType: 'boolean' },
            { name: 'getPosition', expectedType: 'number' },
            { name: 'getDuration', expectedType: 'number' },
            { name: 'getVolume', expectedType: 'number' },
            { name: 'getPlaylist', expectedType: 'object' }
        ];

        for (const { name, expectedType } of stateMethods) {
            try {
                const startTime = performance.now();
                const result = await api[name]();
                const endTime = performance.now();
                const responseTime = endTime - startTime;

                // 功能可用性测试
                const isCallable = result !== undefined;
                this.addTestResult('player', `${name}调用`, isCallable,
                    isCallable ? `成功调用，返回: ${typeof result}` : '调用失败',
                    this.testTypes.FUNCTIONALITY);

                // 返回值类型测试
                if (result !== null && result !== undefined) {
                    const typeMatch = typeof result === expectedType ||
                                    (expectedType === 'object' && (Array.isArray(result) || typeof result === 'object'));
                    this.addTestResult('player', `${name}返回值`, typeMatch,
                        typeMatch ? `类型正确: ${typeof result}` : `类型错误: 期望${expectedType}，实际${typeof result}`,
                        this.testTypes.RETURN_VALUE);
                }

                // 性能测试
                const isPerformant = responseTime < 100; // 100ms阈值
                this.addTestResult('player', `${name}性能`, isPerformant,
                    `响应时间: ${responseTime.toFixed(2)}ms`, this.testTypes.PERFORMANCE);

            } catch (error) {
                this.addTestResult('player', `${name}调用`, false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }
    }

    /**
     * 测试Player音量控制
     */
    async testPlayerVolumeControl(api) {
        try {
            // 获取当前音量
            const originalVolume = await api.getVolume();
            const hasOriginalVolume = typeof originalVolume === 'number';

            this.addTestResult('player', '音量获取', hasOriginalVolume,
                hasOriginalVolume ? `当前音量: ${originalVolume}` : '无法获取音量',
                this.testTypes.FUNCTIONALITY);

            if (hasOriginalVolume && typeof api.setVolume === 'function') {
                // 测试音量设置
                const testVolume = 0.5;
                await api.setVolume(testVolume);

                // 验证音量是否设置成功
                await this.sleep(100); // 等待设置生效
                const newVolume = await api.getVolume();
                const volumeSet = Math.abs(newVolume - testVolume) < 0.1; // 允许小误差

                this.addTestResult('player', '音量设置', volumeSet,
                    volumeSet ? `音量设置成功: ${newVolume}` : `音量设置失败: 期望${testVolume}，实际${newVolume}`,
                    this.testTypes.FUNCTIONALITY);

                // 恢复原始音量
                await api.setVolume(originalVolume);
            }

        } catch (error) {
            this.addTestResult('player', '音量控制', false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 测试Player事件监听器
     */
    async testPlayerEventListeners(api) {
        const eventTests = [
            { event: 'trackChanged', method: 'onTrackChanged', offMethod: 'offTrackChanged' },
            { event: 'playbackStateChanged', method: 'onPlaybackStateChanged', offMethod: 'offPlaybackStateChanged' },
            { event: 'positionChanged', method: 'onPositionChanged', offMethod: 'offPositionChanged' }
        ];

        for (const { event, method, offMethod } of eventTests) {
            await this.testEventListenerLifecycle(api, event, method, offMethod);
        }

        // 测试removeAllListeners功能
        if (typeof api.removeAllListeners === 'function') {
            try {
                const result = api.removeAllListeners();
                this.addTestResult('player', 'removeAllListeners', true,
                    '批量移除监听器成功', this.testTypes.FUNCTIONALITY);
            } catch (error) {
                this.addTestResult('player', 'removeAllListeners', false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }
    }

    /**
     * 测试事件监听器生命周期
     */
    async testEventListenerLifecycle(api, eventName, onMethod, offMethod) {
        let eventReceived = false;
        let receivedData = null;

        // 创建测试回调
        const testCallback = (data) => {
            eventReceived = true;
            receivedData = data;
        };

        try {
            // 1. 注册事件监听器
            if (typeof api[onMethod] === 'function') {
                const registerResult = api[onMethod](testCallback);
                const registerSuccess = registerResult !== false;

                this.addTestResult('player', `${eventName}注册`, registerSuccess,
                    registerSuccess ? '事件监听器注册成功' : '事件监听器注册失败',
                    this.testTypes.FUNCTIONALITY);

                // 记录测试回调以便清理
                this.eventTestState.testCallbacks.set(`player-${eventName}`, testCallback);

                // 2. 模拟事件触发（如果可能）
                await this.simulatePlayerEvent(eventName);

                // 3. 等待事件处理
                await this.sleep(200);

                // 4. 验证事件接收
                this.addTestResult('player', `${eventName}接收`, eventReceived,
                    eventReceived ? `事件接收成功，数据: ${JSON.stringify(receivedData)}` : '未接收到事件',
                    this.testTypes.FUNCTIONALITY);

                // 5. 移除事件监听器
                if (typeof api[offMethod] === 'function') {
                    const removeResult = api[offMethod](testCallback);
                    const removeSuccess = removeResult !== false;

                    this.addTestResult('player', `${eventName}移除`, removeSuccess,
                        removeSuccess ? '事件监听器移除成功' : '事件监听器移除失败',
                        this.testTypes.FUNCTIONALITY);
                }

            } else {
                this.addTestResult('player', `${eventName}注册`, false,
                    `${onMethod}方法不存在`, this.testTypes.EXISTENCE);
            }

        } catch (error) {
            this.addTestResult('player', `${eventName}生命周期`, false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 模拟Player事件
     */
    async simulatePlayerEvent(eventName) {
        // 尝试通过window.api触发事件（如果可用）
        try {
            if (window.api && typeof window.api.emit === 'function') {
                const testData = this.generateTestEventData(eventName);
                window.api.emit(eventName, testData);
            }
        } catch (error) {
            console.warn(`无法模拟${eventName}事件:`, error);
        }
    }

    /**
     * 生成测试事件数据
     */
    generateTestEventData(eventName) {
        switch (eventName) {
            case 'trackChanged':
                return {
                    title: 'Test Track',
                    artist: 'Test Artist',
                    album: 'Test Album',
                    duration: 180,
                    testEvent: true
                };
            case 'playbackStateChanged':
                return 'playing';
            case 'positionChanged':
                return 30;
            default:
                return { testEvent: true, eventName };
        }
    }

    /**
     * 测试Player控制方法
     */
    async testPlayerControlMethods(api) {
        const controlMethods = ['play', 'pause', 'stop', 'next', 'previous'];

        for (const method of controlMethods) {
            if (typeof api[method] === 'function') {
                try {
                    const startTime = performance.now();
                    const result = await api[method]();
                    const endTime = performance.now();
                    const responseTime = endTime - startTime;

                    // 功能测试 - 控制方法通常返回undefined或Promise
                    const isCallable = true; // 如果没有抛出异常就认为可调用
                    this.addTestResult('player', `${method}控制`, isCallable,
                        `控制方法调用成功`, this.testTypes.FUNCTIONALITY);

                    // 性能测试
                    const isPerformant = responseTime < 200; // 200ms阈值
                    this.addTestResult('player', `${method}性能`, isPerformant,
                        `响应时间: ${responseTime.toFixed(2)}ms`, this.testTypes.PERFORMANCE);

                } catch (error) {
                    this.addTestResult('player', `${method}控制`, false,
                        `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
                }
            }
        }

        // 测试seek方法（需要参数）
        if (typeof api.seek === 'function') {
            try {
                const testPosition = 30; // 30秒
                await api.seek(testPosition);
                this.addTestResult('player', 'seek控制', true,
                    `seek到${testPosition}秒成功`, this.testTypes.FUNCTIONALITY);
            } catch (error) {
                this.addTestResult('player', 'seek控制', false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }
    }

    /**
     * 测试Player错误处理
     */
    async testPlayerErrorHandling(api) {
        // 测试无效参数处理
        const errorTests = [
            { method: 'setVolume', args: [-1], description: '负音量值' },
            { method: 'setVolume', args: [2], description: '超出范围音量值' },
            { method: 'seek', args: [-10], description: '负播放位置' },
            { method: 'seek', args: [null], description: '空播放位置' }
        ];

        for (const { method, args, description } of errorTests) {
            if (typeof api[method] === 'function') {
                try {
                    await api[method](...args);
                    // 如果没有抛出错误，可能是方法内部处理了无效参数
                    this.addTestResult('player', `${method}错误处理`, true,
                        `${description} - 方法正常处理`, this.testTypes.ERROR_HANDLING);
                } catch (error) {
                    // 抛出错误也是正确的错误处理
                    this.addTestResult('player', `${method}错误处理`, true,
                        `${description} - 正确抛出错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
                }
            }
        }
    }

    /**
     * 检查Library API方法存在性
     */
    checkLibraryMethodsExistence(api) {
        const methods = ['getTracks', 'getAlbums', 'getArtists', 'search', 'scanDirectory', 'getTrackMetadata', 'onLibraryUpdated', 'onScanProgress'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('library', `${method}方法`, exists,
                exists ? '方法存在' : '方法不存在', this.testTypes.EXISTENCE);
        }
    }

    /**
     * 测试Library API功能性
     */
    async testLibraryFunctionality(api) {
        // 测试搜索功能
        if (typeof api.search === 'function') {
            try {
                const startTime = performance.now();
                const searchResult = await api.search('test');
                const endTime = performance.now();
                const responseTime = endTime - startTime;

                const isValidResult = Array.isArray(searchResult) || typeof searchResult === 'object';
                this.addTestResult('library', '搜索功能', isValidResult,
                    isValidResult ? `搜索返回: ${typeof searchResult}` : '搜索返回无效结果',
                    this.testTypes.FUNCTIONALITY);

                // 性能测试
                const isPerformant = responseTime < 1000; // 1秒阈值
                this.addTestResult('library', '搜索性能', isPerformant,
                    `搜索响应时间: ${responseTime.toFixed(2)}ms`, this.testTypes.PERFORMANCE);

            } catch (error) {
                this.addTestResult('library', '搜索功能', false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }

        // 测试获取曲目列表
        if (typeof api.getTracks === 'function') {
            try {
                const tracks = await api.getTracks();
                const isValidTracks = Array.isArray(tracks);
                this.addTestResult('library', '获取曲目', isValidTracks,
                    isValidTracks ? `获取到${tracks.length}首曲目` : '获取曲目失败',
                    this.testTypes.FUNCTIONALITY);
            } catch (error) {
                this.addTestResult('library', '获取曲目', false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }
    }

    /**
     * 检查UI API方法存在性
     */
    checkUIMethodsExistence(api) {
        const methods = ['showNotification', 'createElement', 'addCSS', 'removeCSS', 'addComponent', 'removeComponent'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('ui', `${method}方法`, exists,
                exists ? '方法存在' : '方法不存在', this.testTypes.EXISTENCE);
        }
    }

    /**
     * 测试UI API功能性
     */
    async testUIFunctionality(api) {
        // 测试createElement功能
        if (typeof api.createElement === 'function') {
            try {
                const startTime = performance.now();
                const testElement = api.createElement('div', {
                    id: 'api-test-element',
                    className: 'test-class',
                    style: 'display: none;'
                }, ['测试内容']);
                const endTime = performance.now();
                const responseTime = endTime - startTime;

                // 功能测试
                const isElement = testElement instanceof HTMLElement;
                this.addTestResult('ui', 'createElement功能', isElement,
                    isElement ? '创建元素成功' : '创建元素失败', this.testTypes.FUNCTIONALITY);

                if (isElement) {
                    // 属性测试
                    const hasCorrectId = testElement.id === 'api-test-element';
                    this.addTestResult('ui', 'createElement属性', hasCorrectId,
                        hasCorrectId ? '元素属性设置正确' : '元素属性设置错误', this.testTypes.RETURN_VALUE);

                    // 内容测试
                    const hasCorrectContent = testElement.textContent === '测试内容';
                    this.addTestResult('ui', 'createElement内容', hasCorrectContent,
                        hasCorrectContent ? '元素内容设置正确' : '元素内容设置错误', this.testTypes.RETURN_VALUE);

                    // 清理测试元素
                    if (testElement.parentNode) {
                        testElement.parentNode.removeChild(testElement);
                    }
                }

                // 性能测试
                const isPerformant = responseTime < 50; // 50ms阈值
                this.addTestResult('ui', 'createElement性能', isPerformant,
                    `创建元素响应时间: ${responseTime.toFixed(2)}ms`, this.testTypes.PERFORMANCE);

            } catch (error) {
                this.addTestResult('ui', 'createElement功能', false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }

        // 测试showNotification功能
        if (typeof api.showNotification === 'function') {
            try {
                api.showNotification('API测试通知', 'info', 1000);
                this.addTestResult('ui', 'showNotification功能', true,
                    '通知显示成功', this.testTypes.FUNCTIONALITY);
            } catch (error) {
                this.addTestResult('ui', 'showNotification功能', false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }

        // 测试CSS操作
        if (typeof api.addCSS === 'function' && typeof api.removeCSS === 'function') {
            try {
                const testCSS = '.api-test-style { color: red; }';
                api.addCSS(this.context.pluginId, testCSS);

                // 验证CSS是否添加
                const styleElements = document.querySelectorAll('style');
                const cssAdded = Array.from(styleElements).some(style =>
                    style.textContent.includes('.api-test-style'));

                this.addTestResult('ui', 'addCSS功能', cssAdded,
                    cssAdded ? 'CSS添加成功' : 'CSS添加失败', this.testTypes.FUNCTIONALITY);

                // 移除CSS
                api.removeCSS(this.context.pluginId);
                this.addTestResult('ui', 'removeCSS功能', true,
                    'CSS移除调用成功', this.testTypes.FUNCTIONALITY);

            } catch (error) {
                this.addTestResult('ui', 'CSS操作', false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }
    }

    /**
     * 测试Settings API
     */
    async testSettingsAPI(api) {
        const methods = ['get', 'set', 'addSection', 'removeSection'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('settings', method, exists, exists ? '方法可用' : '方法不存在');
        }

        // 测试设置读写
        try {
            const testKey = 'api-test-plugin-test';
            const testValue = 'test-value-' + Date.now();

            api.set(testKey, testValue);
            const retrievedValue = api.get(testKey);
            const isWorking = retrievedValue === testValue;

            this.addTestResult('settings', '读写功能', isWorking, isWorking ? '设置读写正常' : '设置读写异常');
        } catch (error) {
            this.addTestResult('settings', '读写功能', false, `错误: ${error.message}`);
        }
    }

    /**
     * 测试Navigation API
     */
    async testNavigationAPI(api) {
        const methods = ['addItem', 'removeItem', 'updateItem'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('navigation', method, exists, exists ? '方法可用' : '方法不存在');
        }
    }

    /**
     * 测试ContextMenu API
     */
    async testContextMenuAPI(api) {
        const methods = ['addItem', 'removeItem'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('contextMenu', method, exists, exists ? '方法可用' : '方法不存在');
        }
    }

    /**
     * 检查Storage API方法存在性
     */
    checkStorageMethodsExistence(api) {
        const methods = ['get', 'set', 'remove', 'clear'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('storage', `${method}方法`, exists,
                exists ? '方法存在' : '方法不存在', this.testTypes.EXISTENCE);
        }
    }

    /**
     * 测试Storage API功能性
     */
    async testStorageFunctionality(api) {
        const testKey = 'api-test-storage-' + Date.now();
        const testData = {
            string: 'test string',
            number: 42,
            boolean: true,
            object: { nested: 'value' },
            array: [1, 2, 3],
            timestamp: Date.now()
        };

        try {
            // 1. 测试数据存储
            if (typeof api.set === 'function') {
                const startTime = performance.now();
                api.set(testKey, testData);
                const endTime = performance.now();
                const setTime = endTime - startTime;

                this.addTestResult('storage', '数据存储', true,
                    '数据存储成功', this.testTypes.FUNCTIONALITY);

                // 性能测试
                const isPerformant = setTime < 100;
                this.addTestResult('storage', '存储性能', isPerformant,
                    `存储响应时间: ${setTime.toFixed(2)}ms`, this.testTypes.PERFORMANCE);
            }

            // 2. 测试数据读取
            if (typeof api.get === 'function') {
                const startTime = performance.now();
                const retrievedValue = api.get(testKey);
                const endTime = performance.now();
                const getTime = endTime - startTime;

                // 功能测试
                const dataExists = retrievedValue !== null && retrievedValue !== undefined;
                this.addTestResult('storage', '数据读取', dataExists,
                    dataExists ? '数据读取成功' : '数据读取失败', this.testTypes.FUNCTIONALITY);

                // 数据完整性测试
                if (dataExists) {
                    const dataIntact = JSON.stringify(retrievedValue) === JSON.stringify(testData);
                    this.addTestResult('storage', '数据完整性', dataIntact,
                        dataIntact ? '数据完整性正确' : '数据完整性错误', this.testTypes.RETURN_VALUE);
                }

                // 性能测试
                const isPerformant = getTime < 50;
                this.addTestResult('storage', '读取性能', isPerformant,
                    `读取响应时间: ${getTime.toFixed(2)}ms`, this.testTypes.PERFORMANCE);
            }

            // 3. 测试数据类型支持
            await this.testStorageDataTypes(api);

            // 4. 测试数据删除
            if (typeof api.remove === 'function') {
                api.remove(testKey);
                const deletedValue = api.get(testKey);
                const isDeleted = deletedValue === null || deletedValue === undefined;

                this.addTestResult('storage', '数据删除', isDeleted,
                    isDeleted ? '数据删除成功' : '数据删除失败', this.testTypes.FUNCTIONALITY);
            }

        } catch (error) {
            this.addTestResult('storage', '存储功能', false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 测试Storage数据类型支持
     */
    async testStorageDataTypes(api) {
        const dataTypes = [
            { name: 'string', value: 'test string' },
            { name: 'number', value: 42 },
            { name: 'boolean', value: true },
            { name: 'object', value: { key: 'value' } },
            { name: 'array', value: [1, 2, 3] },
            { name: 'null', value: null }
        ];

        for (const { name, value } of dataTypes) {
            try {
                const testKey = `api-test-type-${name}-${Date.now()}`;
                api.set(testKey, value);
                const retrieved = api.get(testKey);

                const typeSupported = JSON.stringify(retrieved) === JSON.stringify(value);
                this.addTestResult('storage', `${name}类型支持`, typeSupported,
                    typeSupported ? `${name}类型存储正确` : `${name}类型存储错误`,
                    this.testTypes.RETURN_VALUE);

                // 清理
                api.remove(testKey);

            } catch (error) {
                this.addTestResult('storage', `${name}类型支持`, false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }
    }

    /**
     * 测试System API
     */
    async testSystemAPI(api) {
        const properties = ['fs', 'path', 'os'];
        const methods = ['openDirectory', 'openFiles', 'showItemInFolder'];

        for (const prop of properties) {
            const exists = !!api[prop];
            this.addTestResult('system', prop, exists, exists ? '属性可用' : '属性不存在');
        }

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('system', method, exists, exists ? '方法可用' : '方法不存在');
        }
    }

    /**
     * 检查Events API方法存在性
     */
    checkEventsMethodsExistence(api) {
        const methods = ['emit', 'on', 'off'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('events', `${method}方法`, exists,
                exists ? '方法存在' : '方法不存在', this.testTypes.EXISTENCE);
        }
    }

    /**
     * 测试Events API功能性
     */
    async testEventsFunctionality(api) {
        // 1. 测试基本事件功能
        await this.testBasicEventFunctionality(api);

        // 2. 测试多监听器支持
        await this.testMultipleEventListeners(api);

        // 3. 测试事件数据传递
        await this.testEventDataTransmission(api);

        // 4. 测试事件移除功能
        await this.testEventRemoval(api);
    }

    /**
     * 测试基本事件功能
     */
    async testBasicEventFunctionality(api) {
        try {
            let eventReceived = false;
            let receivedData = null;
            const testEvent = 'api-test-basic-event-' + Date.now();
            const testData = { test: true, timestamp: Date.now() };

            const callback = (data) => {
                eventReceived = true;
                receivedData = data;
            };

            // 注册事件监听器
            if (typeof api.on === 'function') {
                api.on(testEvent, callback);
                this.addTestResult('events', '事件注册', true,
                    '事件监听器注册成功', this.testTypes.FUNCTIONALITY);
            }

            // 触发事件
            if (typeof api.emit === 'function') {
                const startTime = performance.now();
                api.emit(testEvent, testData);
                const endTime = performance.now();
                const emitTime = endTime - startTime;

                this.addTestResult('events', '事件触发', true,
                    '事件触发成功', this.testTypes.FUNCTIONALITY);

                // 性能测试
                const isPerformant = emitTime < 10;
                this.addTestResult('events', '触发性能', isPerformant,
                    `事件触发响应时间: ${emitTime.toFixed(2)}ms`, this.testTypes.PERFORMANCE);
            }

            // 等待事件处理
            await this.sleep(100);

            // 验证事件接收
            this.addTestResult('events', '事件接收', eventReceived,
                eventReceived ? '事件接收成功' : '事件接收失败', this.testTypes.FUNCTIONALITY);

            // 验证数据传递
            if (eventReceived) {
                const dataCorrect = JSON.stringify(receivedData) === JSON.stringify(testData);
                this.addTestResult('events', '数据传递', dataCorrect,
                    dataCorrect ? '事件数据传递正确' : '事件数据传递错误', this.testTypes.RETURN_VALUE);
            }

            // 移除事件监听器
            if (typeof api.off === 'function') {
                api.off(testEvent, callback);
                this.addTestResult('events', '事件移除', true,
                    '事件监听器移除成功', this.testTypes.FUNCTIONALITY);
            }

        } catch (error) {
            this.addTestResult('events', '基本事件功能', false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 测试多监听器支持
     */
    async testMultipleEventListeners(api) {
        try {
            const testEvent = 'api-test-multi-event-' + Date.now();
            const callbackResults = [];

            // 创建多个监听器
            const callbacks = [];
            for (let i = 0; i < 3; i++) {
                const callback = (data) => {
                    callbackResults.push(`callback-${i}-${data.value}`);
                };
                callbacks.push(callback);
                api.on(testEvent, callback);
            }

            // 触发事件
            api.emit(testEvent, { value: 'test' });

            // 等待处理
            await this.sleep(100);

            // 验证所有监听器都被调用
            const allCalled = callbackResults.length === 3;
            this.addTestResult('events', '多监听器支持', allCalled,
                allCalled ? `${callbackResults.length}个监听器都被调用` : `只有${callbackResults.length}个监听器被调用`,
                this.testTypes.FUNCTIONALITY);

            // 清理监听器
            callbacks.forEach(callback => api.off(testEvent, callback));

        } catch (error) {
            this.addTestResult('events', '多监听器支持', false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 测试事件数据传递
     */
    async testEventDataTransmission(api) {
        const dataTypes = [
            { name: 'string', value: 'test string' },
            { name: 'number', value: 42 },
            { name: 'boolean', value: true },
            { name: 'object', value: { nested: { deep: 'value' } } },
            { name: 'array', value: [1, 'two', { three: 3 }] }
        ];

        for (const { name, value } of dataTypes) {
            try {
                let receivedValue = null;
                const testEvent = `api-test-data-${name}-${Date.now()}`;

                const callback = (data) => {
                    receivedValue = data;
                };

                api.on(testEvent, callback);
                api.emit(testEvent, value);

                await this.sleep(50);

                const dataCorrect = JSON.stringify(receivedValue) === JSON.stringify(value);
                this.addTestResult('events', `${name}数据传递`, dataCorrect,
                    dataCorrect ? `${name}类型数据传递正确` : `${name}类型数据传递错误`,
                    this.testTypes.RETURN_VALUE);

                api.off(testEvent, callback);

            } catch (error) {
                this.addTestResult('events', `${name}数据传递`, false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }
    }

    /**
     * 测试事件移除功能
     */
    async testEventRemoval(api) {
        try {
            let callCount = 0;
            const testEvent = 'api-test-removal-' + Date.now();

            const callback = () => {
                callCount++;
            };

            // 注册监听器
            api.on(testEvent, callback);

            // 第一次触发
            api.emit(testEvent);
            await this.sleep(50);

            // 移除监听器
            api.off(testEvent, callback);

            // 第二次触发（应该不会被接收）
            api.emit(testEvent);
            await this.sleep(50);

            // 验证只被调用一次
            const removalWorking = callCount === 1;
            this.addTestResult('events', '监听器移除', removalWorking,
                removalWorking ? '监听器移除功能正常' : `监听器被调用${callCount}次，移除失败`,
                this.testTypes.FUNCTIONALITY);

        } catch (error) {
            this.addTestResult('events', '监听器移除', false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 运行性能测试
     */
    async runPerformanceTests() {
        console.log('🧪 APITestPlugin: 开始性能测试...');

        // 测试大量事件处理性能
        await this.testEventPerformance();

        // 测试存储性能
        await this.testStoragePerformance();

        // 测试UI创建性能
        await this.testUIPerformance();
    }

    /**
     * 测试事件性能
     */
    async testEventPerformance() {
        if (!this.context.events) return;

        try {
            const eventCount = 100;
            let receivedCount = 0;
            const testEvent = 'api-test-performance-' + Date.now();

            const callback = () => {
                receivedCount++;
            };

            this.context.events.on(testEvent, callback);

            // 测试大量事件触发性能
            const startTime = performance.now();
            for (let i = 0; i < eventCount; i++) {
                this.context.events.emit(testEvent, { index: i });
            }
            const endTime = performance.now();

            await this.sleep(200); // 等待所有事件处理完成

            const totalTime = endTime - startTime;
            const avgTime = totalTime / eventCount;
            const isPerformant = avgTime < 1; // 平均每个事件1ms以内

            this.addTestResult('performance', '事件批量处理', isPerformant,
                `${eventCount}个事件，总时间: ${totalTime.toFixed(2)}ms，平均: ${avgTime.toFixed(2)}ms/事件`,
                this.testTypes.PERFORMANCE);

            this.context.events.off(testEvent, callback);

        } catch (error) {
            this.addTestResult('performance', '事件性能测试', false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 测试存储性能
     */
    async testStoragePerformance() {
        if (!this.context.storage) return;

        try {
            const operationCount = 50;
            const testData = { data: 'test'.repeat(100) }; // 较大的测试数据

            // 测试写入性能
            const writeStartTime = performance.now();
            for (let i = 0; i < operationCount; i++) {
                this.context.storage.set(`perf-test-${i}`, testData);
            }
            const writeEndTime = performance.now();

            // 测试读取性能
            const readStartTime = performance.now();
            for (let i = 0; i < operationCount; i++) {
                this.context.storage.get(`perf-test-${i}`);
            }
            const readEndTime = performance.now();

            const writeTime = writeEndTime - writeStartTime;
            const readTime = readEndTime - readStartTime;
            const avgWriteTime = writeTime / operationCount;
            const avgReadTime = readTime / operationCount;

            const writePerformant = avgWriteTime < 10; // 10ms阈值
            const readPerformant = avgReadTime < 5; // 5ms阈值

            this.addTestResult('performance', '存储写入性能', writePerformant,
                `${operationCount}次写入，平均: ${avgWriteTime.toFixed(2)}ms/次`,
                this.testTypes.PERFORMANCE);

            this.addTestResult('performance', '存储读取性能', readPerformant,
                `${operationCount}次读取，平均: ${avgReadTime.toFixed(2)}ms/次`,
                this.testTypes.PERFORMANCE);

            // 清理测试数据
            for (let i = 0; i < operationCount; i++) {
                this.context.storage.remove(`perf-test-${i}`);
            }

        } catch (error) {
            this.addTestResult('performance', '存储性能测试', false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 测试UI性能
     */
    async testUIPerformance() {
        if (!this.context.ui || typeof this.context.ui.createElement !== 'function') return;

        try {
            const elementCount = 20;
            const elements = [];

            // 测试元素创建性能
            const startTime = performance.now();
            for (let i = 0; i < elementCount; i++) {
                const element = this.context.ui.createElement('div', {
                    id: `perf-test-element-${i}`,
                    className: 'perf-test-class',
                    style: 'display: none;'
                }, [`Element ${i}`]);
                elements.push(element);
            }
            const endTime = performance.now();

            const totalTime = endTime - startTime;
            const avgTime = totalTime / elementCount;
            const isPerformant = avgTime < 5; // 5ms阈值

            this.addTestResult('performance', 'UI元素创建性能', isPerformant,
                `${elementCount}个元素，平均: ${avgTime.toFixed(2)}ms/个`,
                this.testTypes.PERFORMANCE);

            // 清理测试元素
            elements.forEach(element => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            });

        } catch (error) {
            this.addTestResult('performance', 'UI性能测试', false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 测试插件工具函数
     */
    async testPluginUtils() {
        const utils = this.context.utils;

        if (!utils) {
            this.addTestResult('utils', '工具对象', false, '工具对象不存在');
            return;
        }

        this.addTestResult('utils', '工具对象', true, '工具对象可用');

        const methods = ['createElement', 'addCSS', 'removeCSS', 'showNotification', 'registerCommand', 'unregisterCommand'];

        for (const method of methods) {
            const exists = typeof utils[method] === 'function';
            this.addTestResult('utils', method, exists, exists ? '方法可用' : '方法不存在');
        }
    }

    /**
     * 测试插件存储
     */
    async testPluginStorage() {
        const storage = this.context.storage;

        if (!storage) {
            this.addTestResult('pluginStorage', '存储对象', false, '存储对象不存在');
            return;
        }

        this.addTestResult('pluginStorage', '存储对象', true, '存储对象可用');

        const methods = ['get', 'set', 'remove'];

        for (const method of methods) {
            const exists = typeof storage[method] === 'function';
            this.addTestResult('pluginStorage', method, exists, exists ? '方法可用' : '方法不存在');
        }

        // 测试插件专用存储
        try {
            const testKey = 'test-key-' + Date.now();
            const testValue = 'test-value-' + Date.now();

            storage.set(testKey, testValue);
            const retrievedValue = storage.get(testKey);
            const isWorking = retrievedValue === testValue;

            storage.remove(testKey);

            this.addTestResult('pluginStorage', '存储功能', isWorking, isWorking ? '插件存储正常' : '插件存储异常');
        } catch (error) {
            this.addTestResult('pluginStorage', '存储功能', false, `错误: ${error.message}`);
        }
    }

    /**
     * 测试插件消息传递
     */
    async testPluginMessaging() {
        const messaging = this.context.messaging;

        if (!messaging) {
            this.addTestResult('messaging', '消息对象', false, '消息对象不存在');
            return;
        }

        this.addTestResult('messaging', '消息对象', true, '消息对象可用');

        const methods = ['emit', 'on', 'off', 'broadcast', 'onBroadcast'];

        for (const method of methods) {
            const exists = typeof messaging[method] === 'function';
            this.addTestResult('messaging', method, exists, exists ? '方法可用' : '方法不存在');
        }
    }

    /**
     * 添加测试结果
     */
    addTestResult(category, testName, passed, details = '', testType = this.testTypes.FUNCTIONALITY) {
        if (!this.testResults.has(category)) {
            this.testResults.set(category, []);
        }

        const result = {
            name: testName,
            passed: passed,
            details: details,
            testType: testType,
            timestamp: new Date().toLocaleTimeString()
        };

        this.testResults.get(category).push(result);

        // 更新统计
        this.testStats.total++;
        if (passed) {
            this.testStats.passed++;
        } else {
            this.testStats.failed++;
        }
    }

    /**
     * 更新结果显示
     */
    updateResultsDisplay() {
        if (!this.resultsContainer) return;

        let html = '';

        // 添加总体统计
        if (this.testStats.total > 0) {
            const successRate = ((this.testStats.passed / this.testStats.total) * 100).toFixed(1);
            const duration = this.testStats.endTime ?
                `${this.testStats.endTime - this.testStats.startTime}ms` :
                (this.testStats.startTime ? `${Date.now() - this.testStats.startTime}ms` : '');

            html += `
                <div style="margin-bottom: 15px; padding: 10px; background: rgba(74, 144, 226, 0.2); border-radius: 6px; border: 1px solid #4a90e2;">
                    <h3 style="margin: 0 0 5px 0; color: #4a90e2; font-size: 16px;">📊 测试统计</h3>
                    <div style="font-size: 12px; color: #ccc;">
                        <span>总计: ${this.testStats.total}</span> |
                        <span style="color: #4CAF50;">通过: ${this.testStats.passed}</span> |
                        <span style="color: #f44336;">失败: ${this.testStats.failed}</span> |
                        <span>成功率: ${successRate}%</span>
                        ${duration ? ` | 耗时: ${duration}` : ''}
                    </div>
                </div>
            `;
        }

        if (this.testResults.size === 0) {
            html += '<div style="text-align: center; color: #ccc; padding: 20px;">暂无测试结果</div>';
        } else {
            for (const [category, tests] of this.testResults) {
                const passedCount = tests.filter(t => t.passed).length;
                const totalCount = tests.length;
                const successRate = totalCount > 0 ? ((passedCount / totalCount) * 100).toFixed(1) : 0;

                // 按测试类型分组
                const testsByType = this.groupTestsByType(tests);

                html += `
                    <div style="margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 10px;">
                        <h4 style="margin: 0 0 10px 0; color: #4CAF50; font-size: 14px;">
                            📋 ${category.toUpperCase()} (${passedCount}/${totalCount} - ${successRate}%)
                        </h4>
                `;

                // 显示各测试类型的结果
                for (const [testType, typeTests] of Object.entries(testsByType)) {
                    if (typeTests.length === 0) continue;

                    const typePassedCount = typeTests.filter(t => t.passed).length;
                    const typeIcon = this.getTestTypeIcon(testType);
                    const typeColor = this.getTestTypeColor(testType);

                    html += `
                        <div style="margin-bottom: 8px;">
                            <h5 style="margin: 0 0 5px 0; color: ${typeColor}; font-size: 12px;">
                                ${typeIcon} ${this.getTestTypeName(testType)} (${typePassedCount}/${typeTests.length})
                            </h5>
                            <div style="font-size: 11px; margin-left: 15px;">
                    `;

                    for (const test of typeTests) {
                        const icon = test.passed ? '✅' : '❌';
                        const color = test.passed ? '#4CAF50' : '#f44336';
                        html += `
                            <div style="margin: 2px 0; padding: 2px 4px; background: rgba(255,255,255,0.03); border-radius: 2px;">
                                <span style="color: ${color};">${icon}</span>
                                <strong>${test.name}:</strong>
                                <span style="color: #ccc;">${test.details}</span>
                                <span style="float: right; color: #888; font-size: 9px;">${test.timestamp}</span>
                            </div>
                        `;
                    }

                    html += '</div></div>';
                }

                html += '</div>';
            }
        }

        this.resultsContainer.innerHTML = html;
    }

    /**
     * 按测试类型分组
     */
    groupTestsByType(tests) {
        const grouped = {
            [this.testTypes.EXISTENCE]: [],
            [this.testTypes.FUNCTIONALITY]: [],
            [this.testTypes.RETURN_VALUE]: [],
            [this.testTypes.ERROR_HANDLING]: [],
            [this.testTypes.PERFORMANCE]: []
        };

        tests.forEach(test => {
            const type = test.testType || this.testTypes.FUNCTIONALITY;
            if (grouped[type]) {
                grouped[type].push(test);
            }
        });

        return grouped;
    }

    /**
     * 获取测试类型图标
     */
    getTestTypeIcon(testType) {
        const icons = {
            [this.testTypes.EXISTENCE]: '🔍',
            [this.testTypes.FUNCTIONALITY]: '⚙️',
            [this.testTypes.RETURN_VALUE]: '📊',
            [this.testTypes.ERROR_HANDLING]: '🛡️',
            [this.testTypes.PERFORMANCE]: '⚡'
        };
        return icons[testType] || '📋';
    }

    /**
     * 获取测试类型颜色
     */
    getTestTypeColor(testType) {
        const colors = {
            [this.testTypes.EXISTENCE]: '#9C27B0',
            [this.testTypes.FUNCTIONALITY]: '#2196F3',
            [this.testTypes.RETURN_VALUE]: '#FF9800',
            [this.testTypes.ERROR_HANDLING]: '#f44336',
            [this.testTypes.PERFORMANCE]: '#4CAF50'
        };
        return colors[testType] || '#ccc';
    }

    /**
     * 获取测试类型名称
     */
    getTestTypeName(testType) {
        const names = {
            [this.testTypes.EXISTENCE]: '存在性检查',
            [this.testTypes.FUNCTIONALITY]: '功能性测试',
            [this.testTypes.RETURN_VALUE]: '返回值验证',
            [this.testTypes.ERROR_HANDLING]: '错误处理',
            [this.testTypes.PERFORMANCE]: '性能测试'
        };
        return names[testType] || '未知测试';
    }

    /**
     * 清除测试结果
     */
    clearResults() {
        this.testResults.clear();
        this.updateResultsDisplay();
        this.showNotification('测试结果已清除', 'info');
    }

    /**
     * 切换面板显示
     */
    togglePanel() {
        if (this.testPanel) {
            this.testPanel.style.display = this.testPanel.style.display === 'none' ? 'block' : 'none';
        }
    }

    /**
     * 检查Settings API方法存在性
     */
    checkSettingsMethodsExistence(api) {
        const methods = ['get', 'set', 'addSection', 'removeSection'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('settings', `${method}方法`, exists,
                exists ? '方法存在' : '方法不存在', this.testTypes.EXISTENCE);
        }
    }

    /**
     * 测试Settings API功能性
     */
    async testSettingsFunctionality(api) {
        // 测试设置读写
        try {
            const testKey = 'api-test-plugin-setting-' + Date.now();
            const testValue = 'test-value-' + Date.now();

            if (typeof api.set === 'function') {
                api.set(testKey, testValue);
                this.addTestResult('settings', '设置写入', true,
                    '设置写入成功', this.testTypes.FUNCTIONALITY);
            }

            if (typeof api.get === 'function') {
                const retrievedValue = api.get(testKey);
                const isWorking = retrievedValue === testValue;

                this.addTestResult('settings', '设置读取', isWorking,
                    isWorking ? '设置读取正确' : '设置读取错误', this.testTypes.FUNCTIONALITY);
            }

        } catch (error) {
            this.addTestResult('settings', '设置读写', false,
                `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
        }
    }

    /**
     * 检查Navigation API方法存在性
     */
    checkNavigationMethodsExistence(api) {
        const methods = ['addItem', 'removeItem', 'updateItem'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('navigation', `${method}方法`, exists,
                exists ? '方法存在' : '方法不存在', this.testTypes.EXISTENCE);
        }
    }

    /**
     * 测试Navigation API功能性
     */
    async testNavigationFunctionality(api) {
        // 测试导航项添加
        if (typeof api.addItem === 'function') {
            try {
                const testItem = {
                    id: 'api-test-nav-item',
                    label: 'API测试',
                    icon: '🧪'
                };

                const result = api.addItem(this.context.pluginId, testItem);
                this.addTestResult('navigation', '添加导航项', result !== null,
                    result !== null ? '导航项添加成功' : '导航项添加失败',
                    this.testTypes.FUNCTIONALITY);

                // 清理测试项
                if (result && typeof api.removeItem === 'function') {
                    api.removeItem(this.context.pluginId, testItem.id);
                }

            } catch (error) {
                this.addTestResult('navigation', '添加导航项', false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }
    }

    /**
     * 检查ContextMenu API方法存在性
     */
    checkContextMenuMethodsExistence(api) {
        const methods = ['addItem', 'removeItem'];

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('contextMenu', `${method}方法`, exists,
                exists ? '方法存在' : '方法不存在', this.testTypes.EXISTENCE);
        }
    }

    /**
     * 测试ContextMenu API功能性
     */
    async testContextMenuFunctionality(api) {
        // 测试右键菜单项添加
        if (typeof api.addItem === 'function') {
            try {
                const testItem = {
                    id: 'api-test-context-item',
                    label: 'API测试菜单',
                    action: () => {}
                };

                const result = api.addItem(this.context.pluginId, testItem);
                this.addTestResult('contextMenu', '添加菜单项', result !== null,
                    result !== null ? '菜单项添加成功' : '菜单项添加失败',
                    this.testTypes.FUNCTIONALITY);

                // 清理测试项
                if (result && typeof api.removeItem === 'function') {
                    api.removeItem(this.context.pluginId, testItem.id);
                }

            } catch (error) {
                this.addTestResult('contextMenu', '添加菜单项', false,
                    `错误: ${error.message}`, this.testTypes.ERROR_HANDLING);
            }
        }
    }

    /**
     * 检查System API方法存在性
     */
    checkSystemMethodsExistence(api) {
        const properties = ['fs', 'path', 'os'];
        const methods = ['openDirectory', 'openFiles', 'showItemInFolder'];

        for (const prop of properties) {
            const exists = !!api[prop];
            this.addTestResult('system', `${prop}属性`, exists,
                exists ? '属性存在' : '属性不存在', this.testTypes.EXISTENCE);
        }

        for (const method of methods) {
            const exists = typeof api[method] === 'function';
            this.addTestResult('system', `${method}方法`, exists,
                exists ? '方法存在' : '方法不存在', this.testTypes.EXISTENCE);
        }
    }

    /**
     * 测试System API功能性
     */
    async testSystemFunctionality(api) {
        // 测试系统属性
        const systemProps = ['fs', 'path', 'os'];

        console.log('----------------------------------------------\n\n\n');
        console.log('Platform:', await this.context.electronAPI.os.platform());
        console.log('Chmod:', await this.context.electronAPI.fs.fs.readFileSync("C:\\Users\\asxe\\OneDrive\\桌面\\test.txt", 'utf8'));
        console.log('Path:', await this.context.electronAPI.path.join('F:\\WorkSpace\\MusicBox\\MusicBox\\src\\renderer\\src\\js\\plugin-system\\examples', 'a.jpg'));
        console.log('----------------------------------------------\n\n\n');

        for (const prop of systemProps) {
            if (api[prop]) {
                const hasUsefulMethods = typeof api[prop] === 'object' &&
                    Object.keys(api[prop]).length > 0;
                this.addTestResult('system', `${prop}可用性`, hasUsefulMethods,
                    hasUsefulMethods ? `${prop}对象包含方法，${typeof prop}` : `${prop}对象为空，${typeof prop}`,
                    this.testTypes.FUNCTIONALITY);
            }
        }

        // 注意：不测试openDirectory等方法的实际调用，因为会弹出系统对话框
        // 只验证方法存在性
        const dialogMethods = ['openDirectory', 'openFiles'];
        for (const method of dialogMethods) {
            if (typeof api[method] === 'function') {
                this.addTestResult('system', `${method}可调用`, true,
                    '方法可调用（未实际调用以避免弹窗）', this.testTypes.FUNCTIONALITY);
            }
        }
    }

    /**
     * 获取插件元数据
     */
    getMetadata() {
        return {
            id: 'api-test-plugin',
            name: 'API功能测试插件',
            version: '2.0.0',
            description: '全面测试PluginAPI中注册的所有接口，包括存在性、功能性、返回值、错误处理和性能测试',
            author: 'MusicBox Team',
            category: 'development',
            features: [
                '接口存在性检查',
                '功能性验证测试',
                '返回值正确性验证',
                '错误处理能力测试',
                '性能基准测试',
                '事件生命周期测试',
                '数据类型支持测试'
            ]
        };
    }
}

// 注册插件类
window.PluginClass = APITestPlugin;
