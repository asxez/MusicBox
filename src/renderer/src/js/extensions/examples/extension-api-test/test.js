/**
 * API 测试扩展
 * 用于测试新的模块化 API 系统
 */

function getExtensionAPI(context) {
    return context.api || createExtensionAPI(context);
}


async function activate(context) {
    console.log('🧪 API 测试扩展已激活');

    // 测试 Player API
    testPlayerAPI(context);

    // 测试 Library API
    testLibraryAPI(context);

    // 测试 UI API
    testUIAPI(context);

    // 测试 Storage API
    testStorageAPI(context);

    // 测试 Settings API
    testSettingsAPI(context);

    // 测试 Commands API
    testCommandsAPI(context);

    // 测试 Events API
    testEventsAPI(context);

    // 测试 Views API
    testViewsAPI(context);

    // 测试 Diagnostics API
    testDiagnosticsAPI(context);

    // 测试 Tasks API
    testTasksAPI(context);

    // 测试 Navigation API
    testNavigationAPI(context);

    // 测试 Network API
    testNetworkAPI(context);

    // 测试 System API（异步）
    await testSystemAPI(context);

    console.log('✅ API 测试扩展测试完成');
}

function deactivate() {
    console.log('🧪 API 测试扩展已停用');
}

window.extensionApiTestExtension = {
    activate,
    deactivate
};

// ========== 测试函数 ==========

function testPlayerAPI(context) {
    console.group('🎵 测试 Player API');

    try {
        const {player} = getExtensionAPI(context);

        // 测试获取状态
        const state = player.getState();
        console.log('播放状态:', state);

        // 测试获取当前歌曲
        const track = player.getCurrentTrack();
        console.log('当前歌曲:', track);

        // 测试获取音量
        const volume = player.getVolume();
        console.log('当前音量:', volume);

        // 测试获取播放列表
        const playlist = player.getPlaylist();
        console.log('播放列表:', playlist.length, '首');

        // 测试获取播放模式
        const playMode = player.getPlayMode();
        console.log('播放模式:', playMode);

        console.log('✅ Player API 测试通过');
    } catch (error) {
        console.error('❌ Player API 测试失败:', error);
    }

    console.groupEnd();
}

function testLibraryAPI(context) {
    console.group('📚 测试 Library API');

    try {
        const {library} = getExtensionAPI(context);

        // 测试获取所有歌曲
        const tracks = library.getAllTracks();
        console.log('音乐库歌曲数:', tracks.length);

        // 测试搜索
        const searchResults = library.searchTracks('test');
        console.log('搜索结果:', searchResults.length);

        // 测试获取专辑
        const albums = library.getAlbums();
        console.log('专辑数:', albums.length);

        // 测试获取艺术家
        const artists = library.getArtists();
        console.log('艺术家数:', artists.length);

        // 测试获取播放列表
        const playlists = library.getPlaylists();
        console.log('播放列表数:', playlists.length);

        console.log('✅ Library API 测试通过');
    } catch (error) {
        console.error('❌ Library API 测试失败:', error);
    }

    console.groupEnd();
}

function testUIAPI(context) {
    console.group('🎨 测试 UI API');

    try {
        const {ui} = getExtensionAPI(context);

        // 测试通知
        ui.showInformationMessage('这是一条信息通知');

        // 测试创建状态栏项
        const statusBarItem = ui.createStatusBarItem('test-status', {
            text: '测试状态栏',
            alignment: 'left'
        });
        console.log('状态栏项已创建:', statusBarItem.id);

        console.log('✅ UI API 测试通过');
    } catch (error) {
        console.error('❌ UI API 测试失败:', error);
    }

    console.groupEnd();
}

function testStorageAPI(context) {
    console.group('💾 测试 Storage API');

    try {
        const {storage} = getExtensionAPI(context);

        // 测试存储和读取
        storage.update('test-key', 'test-value').then(() => {
            const value = storage.get('test-key');
            console.log('存储的值:', value);

            // 测试获取所有键
            const keys = storage.keys();
            console.log('存储的键:', keys);

            console.log('✅ Storage API 测试通过');
        });
    } catch (error) {
        console.error('❌ Storage API 测试失败:', error);
    }

    console.groupEnd();
}

function testSettingsAPI(context) {
    console.group('⚙️ 测试 Settings API');

    try {
        const {settings} = getExtensionAPI(context);

        // 测试获取设置
        const value = settings.get('test.setting', 'default');
        console.log('设置值:', value);

        // 测试获取所有键
        const keys = settings.keys();
        console.log('设置键数:', keys.length);

        console.log('✅ Settings API 测试通过');
    } catch (error) {
        console.error('❌ Settings API 测试失败:', error);
    }

    console.groupEnd();
}

function testCommandsAPI(context) {
    console.group('⌨️ 测试 Commands API');

    try {
        const {commands} = getExtensionAPI(context);

        // 测试注册命令
        const disposable = commands.registerCommand('test.command', () => {
            console.log('测试命令已执行');
            return 'success';
        }, {
            title: '测试命令',
            category: '测试'
        });

        // 测试检查命令是否存在
        const hasCommand = commands.hasCommand('test.command');
        console.log('命令是否存在:', hasCommand);

        // 测试获取所有命令
        const allCommands = commands.getCommands();
        console.log('已注册命令数:', allCommands.length);

        // 测试执行命令
        commands.executeCommand('test.command').then(result => {
            console.log('命令执行结果:', result);
        });

        // 清理
        context.subscriptions.add(disposable);

        console.log('✅ Commands API 测试通过');
    } catch (error) {
        console.error('❌ Commands API 测试失败:', error);
    }

    console.groupEnd();
}

function testEventsAPI(context) {
    console.group('📡 测试 Events API');

    try {
        const {events} = getExtensionAPI(context);

        // 测试监听事件
        const disposable = events.on('test-event', (data) => {
            console.log('收到测试事件:', data);
        });

        // 测试触发事件
        events.emit('test-event', {message: 'Hello'});

        // 清理
        context.subscriptions.add(disposable);

        console.log('✅ Events API 测试通过');
    } catch (error) {
        console.error('❌ Events API 测试失败:', error);
    }

    console.groupEnd();
}

function testViewsAPI(context) {
    console.group('👁️ 测试 Views API');

    try {
        const {views} = getExtensionAPI(context);

        // 测试注册视图
        const disposable = views.registerView('test.view', {
            render() {
                return '<div>测试视图</div>';
            }
        });

        // 测试获取所有视图
        const allViews = views.getViews();
        console.log('已注册视图数:', allViews.length);

        // 清理
        context.subscriptions.add(disposable);

        console.log('✅ Views API 测试通过');
    } catch (error) {
        console.error('❌ Views API 测试失败:', error);
    }

    console.groupEnd();
}

function testDiagnosticsAPI(context) {
    console.group('🔍 测试 Diagnostics API');

    try {
        const {diagnostics} = getExtensionAPI(context);

        // 测试创建诊断集合
        const collection = diagnostics.createDiagnosticCollection('test');

        // 测试设置诊断
        collection.set('file:///test.js', [
            {
                range: {start: {line: 0, character: 0}, end: {line: 0, character: 10}},
                message: '测试错误',
                severity: 0
            }
        ]);

        // 测试获取诊断
        const diags = collection.get('file:///test.js');
        console.log('诊断数:', diags.length);

        // 测试获取诊断总数
        const count = collection.getCount();
        console.log('诊断总数:', count);

        // 清理
        context.subscriptions.add(collection);

        console.log('✅ Diagnostics API 测试通过');
    } catch (error) {
        console.error('❌ Diagnostics API 测试失败:', error);
    }

    console.groupEnd();
}

function testTasksAPI(context) {
    console.group('📋 测试 Tasks API');

    try {
        const {tasks} = getExtensionAPI(context);

        // 测试创建任务
        const task = tasks.createTask('测试任务', async (progress, token) => {
            progress.report({message: '开始处理...'});

            for (let i = 0; i <= 100; i += 10) {
                if (token.isCancellationRequested) {
                    break;
                }
                progress.report({increment: 10, message: `处理中 ${i}%`});
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return '任务完成';
        });

        // 测试执行任务
        task.execute().then(result => {
            console.log('任务结果:', result);
        }).catch(error => {
            console.error('任务失败:', error);
        });

        // 测试获取所有任务
        const allTasks = tasks.getTasks();
        console.log('任务数:', allTasks.length);

        // 清理
        context.subscriptions.add(task);

        console.log('✅ Tasks API 测试通过');
    } catch (error) {
        console.error('❌ Tasks API 测试失败:', error);
    }

    console.groupEnd();
}

function testNavigationAPI(context) {
    console.group('🧭 测试 Navigation API');

    try {
        const {navigation} = getExtensionAPI(context);

        // 测试获取当前视图
        const currentView = navigation.getCurrentView();
        console.log('当前视图:', currentView);

        // 测试获取历史
        const history = navigation.getHistory();
        console.log('导航历史:', history);

        console.log('✅ Navigation API 测试通过');
    } catch (error) {
        console.error('❌ Navigation API 测试失败:', error);
    }

    console.groupEnd();
}

function testNetworkAPI(context) {
    console.group('🌐 测试 Network API');

    try {
        const {network} = getExtensionAPI(context);

        // 测试 GET 请求（使用公共 API）
        network.get('https://www.github.com/').then(data => {
            console.log('网络请求成功:', data);
        }).catch(error => {
            console.warn('网络请求失败（这是正常的）:', error.message);
        });

        console.log('✅ Network API 测试通过');
    } catch (error) {
        console.error('❌ Network API 测试失败:', error);
    }

    console.groupEnd();
}

async function testSystemAPI(context) {
    console.group('💻 测试 System API');

    try {
        const {system} = getExtensionAPI(context);

        // 测试获取版本（异步）
        const version = await system.getVersion();
        console.log('应用版本:', version);

        // 测试获取平台（异步）
        const platform = await system.getPlatform();
        console.log('平台:', platform);

        // 测试获取操作系统（异步）
        const os = await system.getOS();
        console.log('操作系统:', os);

        // 测试获取用户数据路径（异步）
        const userDataPath = await system.getUserDataPath();
        console.log('用户数据路径:', userDataPath);

        // 测试获取语言（同步）
        const language = system.getLanguage();
        console.log('语言:', language);

        // 测试是否开发模式（同步）
        const isDev = system.isDevelopment();
        console.log('开发模式:', isDev);

        console.log('✅ System API 测试通过');
    } catch (error) {
        console.error('❌ System API 测试失败:', error);
    }

    console.groupEnd();
}

