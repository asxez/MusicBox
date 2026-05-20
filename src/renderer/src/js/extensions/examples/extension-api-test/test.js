/**
 * API 测试扩展
 * 用于测试当前 sandbox extension host 已允许的模块化 API。
 */

function getExtensionAPI(context) {
    return context.api || createExtensionAPI(context);
}

async function activate(context) {
    console.log('🧪 API 测试扩展已激活');

    await testPlayerAPI(context);
    await testLibraryAPI(context);
    await testUIAPI(context);
    await testStorageAPI(context);
    await testSettingsAPI(context);
    await testCommandsAPI(context);
    await testEventsAPI(context);
    await testNavigationAPI(context);
    await testNetworkAPI(context);
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

async function testPlayerAPI(context) {
    console.group('🎵 测试 Player API');

    try {
        const {player} = getExtensionAPI(context);

        const state = await player.getState();
        console.log('播放状态:', state);

        const track = await player.getCurrentTrack();
        console.log('当前歌曲:', track);

        const volume = await player.getVolume();
        console.log('当前音量:', volume);

        const playlist = await player.getPlaylist();
        console.log('播放列表:', playlist.length, '首');

        const playMode = await player.getPlayMode();
        console.log('播放模式:', playMode);

        console.log('✅ Player API 测试通过');
    } catch (error) {
        console.error('❌ Player API 测试失败:', error);
    }

    console.groupEnd();
}

async function testLibraryAPI(context) {
    console.group('📚 测试 Library API');

    try {
        const {library} = getExtensionAPI(context);

        const tracks = await library.getAllTracks();
        console.log('音乐库歌曲数:', tracks.length);

        const searchResults = await library.searchTracks('test');
        console.log('搜索结果:', searchResults.length);

        const albums = await library.getAlbums();
        console.log('专辑数:', albums.length);

        const artists = await library.getArtists();
        console.log('艺术家数:', artists.length);

        const playlists = await library.getPlaylists();
        console.log('播放列表数:', playlists.length);

        console.log('✅ Library API 测试通过');
    } catch (error) {
        console.error('❌ Library API 测试失败:', error);
    }

    console.groupEnd();
}

async function testUIAPI(context) {
    console.group('🎨 测试 UI API');

    try {
        const {ui, settings} = getExtensionAPI(context);

        await ui.showInformationMessage('这是一条信息通知');

        const sectionDisposable = await ui.registerSettingsSection('extensionApiTest', 'API 测试扩展', {
            order: 460
        });
        context.subscriptions.add(sectionDisposable);

        const pageDisposable = await ui.registerSettingsPageSchema('extensionApiTest', {
            items: [
                {
                    id: 'enabled',
                    type: 'toggle',
                    label: '测试开关',
                    description: '验证 sandbox 插件可以通过 schema 注册设置项',
                    value: await settings.get('extensionApiTest.enabled', true),
                    async onChange(value) {
                        await settings.set('extensionApiTest.enabled', value);
                    }
                },
                {
                    id: 'mode',
                    type: 'select',
                    label: '测试模式',
                    description: '验证可序列化 select contribution',
                    value: await settings.get('extensionApiTest.mode', 'basic'),
                    options: [
                        {value: 'basic', label: '基础'},
                        {value: 'advanced', label: '高级'}
                    ],
                    async onChange(value) {
                        await settings.set('extensionApiTest.mode', value);
                    }
                },
                {
                    id: 'notify',
                    type: 'button',
                    label: '测试按钮',
                    description: '验证 schema 按钮回调会回到 sandbox 执行',
                    buttonText: '显示通知',
                    async onClick() {
                        await ui.showSuccessMessage('Schema 按钮回调执行成功');
                    }
                }
            ]
        });
        context.subscriptions.add(pageDisposable);

        console.log('✅ UI API 测试通过');
    } catch (error) {
        console.error('❌ UI API 测试失败:', error);
    }

    console.groupEnd();
}

async function testStorageAPI(context) {
    console.group('💾 测试 Storage API');

    try {
        const {storage} = getExtensionAPI(context);

        await storage.update('test-key', 'test-value');
        const value = await storage.get('test-key');
        console.log('存储的值:', value);

        const keys = await storage.keys();
        console.log('存储的键:', keys);

        console.log('✅ Storage API 测试通过');
    } catch (error) {
        console.error('❌ Storage API 测试失败:', error);
    }

    console.groupEnd();
}

async function testSettingsAPI(context) {
    console.group('⚙️ 测试 Settings API');

    try {
        const {settings} = getExtensionAPI(context);

        const value = await settings.get('test.setting', 'default');
        console.log('设置值:', value);

        await settings.set('test.setting', value);

        const keys = await settings.keys();
        console.log('设置键数:', keys.length);

        console.log('✅ Settings API 测试通过');
    } catch (error) {
        console.error('❌ Settings API 测试失败:', error);
    }

    console.groupEnd();
}

async function testCommandsAPI(context) {
    console.group('⌨️ 测试 Commands API');

    try {
        const {commands} = getExtensionAPI(context);

        const disposable = await commands.registerCommand('test.command', () => {
            console.log('测试命令已执行');
            return 'success';
        }, {
            title: '测试命令',
            category: '测试'
        });

        const hasCommand = await commands.hasCommand('test.command');
        console.log('命令是否存在:', hasCommand);

        const allCommands = await commands.getCommands();
        console.log('已注册命令数:', allCommands.length);

        const result = await commands.executeCommand('test.command');
        console.log('命令执行结果:', result);

        context.subscriptions.add(disposable);

        console.log('✅ Commands API 测试通过');
    } catch (error) {
        console.error('❌ Commands API 测试失败:', error);
    }

    console.groupEnd();
}

async function testEventsAPI(context) {
    console.group('📡 测试 Events API');

    try {
        const {events} = getExtensionAPI(context);

        const disposable = await events.on('test-event', (data) => {
            console.log('收到测试事件:', data);
        });

        await events.emit('test-event', {message: 'Hello'});
        context.subscriptions.add(disposable);

        console.log('✅ Events API 测试通过');
    } catch (error) {
        console.error('❌ Events API 测试失败:', error);
    }

    console.groupEnd();
}

async function testNavigationAPI(context) {
    console.group('🧭 测试 Navigation API');

    try {
        const {navigation} = getExtensionAPI(context);

        const currentView = await navigation.getCurrentView();
        console.log('当前视图:', currentView);

        console.log('✅ Navigation API 测试通过');
    } catch (error) {
        console.error('❌ Navigation API 测试失败:', error);
    }

    console.groupEnd();
}

async function testNetworkAPI(context) {
    console.group('🌐 测试 Network API');

    try {
        const {network} = getExtensionAPI(context);

        const data = await network.get('https://www.github.com/');
        console.log('网络请求成功:', data.length);

        console.log('✅ Network API 测试通过');
    } catch (error) {
        console.warn('网络请求失败（离线或权限未授予时这是正常的）:', error.message);
    }

    console.groupEnd();
}

async function testSystemAPI(context) {
    console.group('💻 测试 System API');

    try {
        const {system} = getExtensionAPI(context);

        const version = await system.getVersion();
        console.log('应用版本:', version);

        const platform = await system.getPlatform();
        console.log('平台:', platform);

        const os = await system.getOS();
        console.log('操作系统:', os);

        const userDataPath = await system.getUserDataPath();
        console.log('用户数据路径:', userDataPath);

        const language = await system.getLanguage();
        console.log('语言:', language);

        console.log('✅ System API 测试通过');
    } catch (error) {
        console.error('❌ System API 测试失败:', error);
    }

    console.groupEnd();
}
