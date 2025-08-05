/**
 * 设置组件
 */

class Settings extends EventEmitter {
    constructor(element) {
        super();
        this.element = element;
        this.isVisible = false;
        this.settings = this.loadSettings();

        this.setupElements();
        this.setupEventListeners();
        this.initializeSettings();

        console.log('🎵 Settings: 组件初始化完成');
    }

    setupElements() {
        this.page = this.element;

        // 关闭按钮
        this.closeBtn = this.element.querySelector('#settings-close-btn');

        // 设置控件元素
        this.languageSelect = this.element.querySelector('#language-select');
        this.autoplayToggle = this.element.querySelector('#autoplay-toggle');
        this.rememberPositionToggle = this.element.querySelector('#remember-position-toggle');
        this.desktopLyricsToggle = this.element.querySelector('#desktop-lyrics-toggle');
        this.statisticsToggle = this.element.querySelector('#statistics-toggle');
        this.recentPlayToggle = this.element.querySelector('#recent-play-toggle');
        this.artistsPageToggle = this.element.querySelector('#artists-page-toggle');
        this.showTrackCoversToggle = this.element.querySelector('#show-track-covers-toggle');
        this.autoScanToggle = this.element.querySelector('#auto-scan-toggle');
        this.selectFolderBtn = this.element.querySelector('#select-folder-btn');
        this.selectLyricsFolderBtn = this.element.querySelector('#select-lyrics-folder-btn');
        this.lyricsFolderPath = this.element.querySelector('#lyrics-folder-path');
        this.selectCoverCacheFolderBtn = this.element.querySelector('#select-cover-cache-folder-btn');
        this.coverCacheFolderPath = this.element.querySelector('#cover-cache-folder-path');
        this.checkUpdatesBtn = this.element.querySelector('#check-updates-btn');

        // 缓存管理元素
        this.viewCacheStatsBtn = this.element.querySelector('#view-cache-stats-btn');
        this.validateCacheBtn = this.element.querySelector('#validate-cache-btn');
        this.clearCacheBtn = this.element.querySelector('#clear-cache-btn');
        this.cacheStatsDescription = this.element.querySelector('#cache-stats-description');

        // 内嵌歌词测试元素
        this.testEmbeddedLyricsBtn = this.element.querySelector('#test-embedded-lyrics-btn');

        // 快捷键配置元素
        this.globalShortcutsToggle = this.element.querySelector('#global-shortcuts-toggle');
        this.shortcutsContainer = this.element.querySelector('#shortcuts-container');
        this.localShortcutsList = this.element.querySelector('#local-shortcuts-list');
        this.globalShortcutsList = this.element.querySelector('#global-shortcuts-list');
        this.globalShortcutsGroup = this.element.querySelector('#global-shortcuts-group');
        this.resetShortcutsBtn = this.element.querySelector('#reset-shortcuts-btn');

        // 网络磁盘配置元素
        this.networkDriveToggle = this.element.querySelector('#network-drive-toggle');
        this.networkDriveConfig = this.element.querySelector('#network-drive-config');
        this.addNetworkDriveBtn = this.element.querySelector('#add-network-drive-btn');
        this.refreshDrivesBtn = this.element.querySelector('#refresh-drives-btn');
        this.mountedDrivesList = this.element.querySelector('#mounted-drives-list');

        // 调试：检查网络磁盘元素是否正确找到
        console.log('🔍 Settings: 网络磁盘元素检查:', {
            networkDriveToggle: !!this.networkDriveToggle,
            networkDriveConfig: !!this.networkDriveConfig,
            addNetworkDriveBtn: !!this.addNetworkDriveBtn,
            refreshDrivesBtn: !!this.refreshDrivesBtn,
            mountedDrivesList: !!this.mountedDrivesList
        });

        // 网络磁盘模态框元素
        this.networkDriveModal = document.querySelector('#network-drive-modal');
        this.networkDriveForm = document.querySelector('#network-drive-form');
        this.networkDriveModalClose = document.querySelector('#network-drive-modal-close');
        this.networkDriveCancel = document.querySelector('#network-drive-cancel');
        this.networkDriveConfirm = document.querySelector('#network-drive-confirm');
        this.testConnectionBtn = document.querySelector('#test-connection-btn');

        // 表单元素
        this.driveNameInput = document.querySelector('#drive-name');
        this.driveProtocolSelect = document.querySelector('#drive-protocol');
        this.driveUsernameInput = document.querySelector('#drive-username');
        this.drivePasswordInput = document.querySelector('#drive-password');

        // SMB配置元素
        this.smbConfig = document.querySelector('#smb-config');
        this.smbHostInput = document.querySelector('#smb-host');
        this.smbShareInput = document.querySelector('#smb-share');
        this.smbDomainInput = document.querySelector('#smb-domain');

        // WebDAV配置元素
        this.webdavConfig = document.querySelector('#webdav-config');
        this.webdavUrlInput = document.querySelector('#webdav-url');

        // 连接测试结果
        this.connectionTestResult = document.querySelector('#connection-test-result');

        // 调试：检查模态框元素是否正确找到
        console.log('🔍 Settings: 模态框元素检查:', {
            networkDriveModal: !!this.networkDriveModal,
            networkDriveForm: !!this.networkDriveForm,
            networkDriveModalClose: !!this.networkDriveModalClose,
            networkDriveCancel: !!this.networkDriveCancel,
            networkDriveConfirm: !!this.networkDriveConfirm,
            testConnectionBtn: !!this.testConnectionBtn,
            driveNameInput: !!this.driveNameInput,
            driveProtocolSelect: !!this.driveProtocolSelect
        });
    }

    setupEventListeners() {
        // 关闭按钮事件
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        // 语言设置
        this.languageSelect.addEventListener('change', (e) => {
            this.updateSetting('language', e.target.value);
            this.emit('languageChanged', e.target.value);
        });

        // 各种开关设置
        this.autoplayToggle.addEventListener('change', (e) => {
            this.updateSetting('autoplay', e.target.checked);
        });

        this.rememberPositionToggle.addEventListener('change', (e) => {
            this.updateSetting('rememberPosition', e.target.checked);
        });

        // 桌面歌词设置 - 控制按钮显示/隐藏
        this.desktopLyricsToggle.addEventListener('change', async (e) => {
            this.updateSetting('desktopLyrics', e.target.checked);

            // 通知主界面更新按钮显示状态
            this.emit('desktopLyricsEnabled', e.target.checked);

            // 如果禁用功能，同时隐藏已打开的桌面歌词窗口
            if (!e.target.checked) {
                try {
                    await api.hideDesktopLyrics();
                } catch (error) {
                    console.error('❌ Settings: 隐藏桌面歌词失败:', error);
                }
            }
            console.log(`🎵 Settings: 桌面歌词功能${e.target.checked ? '启用' : '禁用'}`);
        });

        // 艺术家页设置 - 控制侧边栏艺术家按钮显示/隐藏
        this.statisticsToggle.addEventListener('change', (e) => {
            this.updateSetting('statistics', e.target.checked);

            // 通知主界面更新侧边栏按钮显示状态
            this.emit('statisticsEnabled', e.target.checked);
            console.log(`📊 Settings: 统计信息功能${e.target.checked ? '启用' : '禁用'}`);
        });

        // 统计信息设置 - 控制侧边栏统计按钮显示/隐藏
        this.statisticsToggle.addEventListener('change', (e) => {
            this.updateSetting('statistics', e.target.checked);

            // 通知主界面更新侧边栏按钮显示状态
            this.emit('statisticsEnabled', e.target.checked);
            console.log(`📊 Settings: 统计信息功能${e.target.checked ? '启用' : '禁用'}`);
        });

        // 最近播放设置 - 控制侧边栏最近播放按钮显示/隐藏
        this.recentPlayToggle.addEventListener('change', (e) => {
            this.updateSetting('recentPlay', e.target.checked);

            // 通知主界面更新侧边栏按钮显示状态
            this.emit('recentPlayEnabled', e.target.checked);
            console.log(`🕒 Settings: 最近播放功能${e.target.checked ? '启用' : '禁用'}`);
        });

        // 艺术家页面设置 - 控制侧边栏艺术家按钮显示/隐藏
        this.artistsPageToggle.addEventListener('change', (e) => {
            this.updateSetting('artistsPage', e.target.checked);

            // 通知主界面更新侧边栏按钮显示状态
            this.emit('artistsPageEnabled', e.target.checked);
            console.log(`🎨 Settings: 艺术家页面功能${e.target.checked ? '启用' : '禁用'}`);
        });

        // 歌曲封面显示设置 - 控制歌曲列表中封面的显示/隐藏
        this.showTrackCoversToggle.addEventListener('change', (e) => {
            this.updateSetting('showTrackCovers', e.target.checked);

            // 通知主界面更新歌曲列表封面显示状态
            this.emit('showTrackCoversEnabled', e.target.checked);
            console.log(`🖼️ Settings: 歌曲封面显示功能${e.target.checked ? '启用' : '禁用'}`);
        });

        this.autoScanToggle.addEventListener('change', (e) => {
            this.updateSetting('autoScan', e.target.checked);
        });

        // 按钮事件
        this.selectFolderBtn.addEventListener('click', () => {
            this.emit('selectMusicFolder');
        });

        this.selectLyricsFolderBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.selectFolder();
                if (result && result.filePaths && result.filePaths.length > 0) {
                    const selectedPath = result.filePaths[0];
                    this.updateSetting('lyricsDirectory', selectedPath);
                    this.lyricsFolderPath.textContent = selectedPath;
                    this.lyricsFolderPath.classList.add('selected');

                    // 更新本地歌词管理器
                    if (window.localLyricsManager) {
                        window.localLyricsManager.setLyricsDirectory(selectedPath);
                    }

                    console.log(`✅ Settings: 本地歌词目录已设置为 ${selectedPath}`);
                }
            } catch (error) {
                console.error('❌ Settings: 选择歌词目录失败:', error);
            }
        });

        this.selectCoverCacheFolderBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.selectFolder();
                if (result && result.filePaths && result.filePaths.length > 0) {
                    const selectedPath = result.filePaths[0];
                    this.updateSetting('coverCacheDirectory', selectedPath);
                    this.coverCacheFolderPath.textContent = selectedPath;
                    this.coverCacheFolderPath.classList.add('selected');

                    // 更新本地封面管理器
                    if (window.localCoverManager) {
                        window.localCoverManager.setCoverDirectory(selectedPath);
                    }

                    console.log(`✅ Settings: 封面缓存目录已设置为 ${selectedPath}`);
                }
            } catch (error) {
                console.error('❌ Settings: 选择封面缓存目录失败:', error);
            }
        });

        this.checkUpdatesBtn.addEventListener('click', () => {
            this.emit('checkUpdates');
        });

        // 缓存管理按钮事件
        this.viewCacheStatsBtn.addEventListener('click', async () => {
            await this.showCacheStatistics();
        });

        this.validateCacheBtn.addEventListener('click', async () => {
            await this.validateCache();
        });

        this.clearCacheBtn.addEventListener('click', async () => {
            await this.clearCache();
        });

        // 内嵌歌词测试事件监听器
        this.testEmbeddedLyricsBtn.addEventListener('click', async () => {
            await this.testEmbeddedLyrics();
        });

        // 快捷键配置事件监听器
        this.setupShortcutEventListeners();

        // 网络磁盘事件监听器
        this.setupNetworkDriveEventListeners();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    // 设置网络磁盘事件监听器
    setupNetworkDriveEventListeners() {
        // 网络磁盘功能开关
        this.networkDriveToggle.addEventListener('change', (e) => {
            this.updateSetting('networkDriveEnabled', e.target.checked);
            this.toggleNetworkDriveConfig(e.target.checked);
            console.log(`🌐 Settings: 网络磁盘功能${e.target.checked ? '启用' : '禁用'}`);
        });

        // 添加网络磁盘按钮
        if (this.addNetworkDriveBtn) {
            this.addNetworkDriveBtn.addEventListener('click', () => {
                console.log('🖱️ Settings: 点击添加网络磁盘按钮');
                this.showNetworkDriveModal();
            });
            console.log('✅ Settings: 添加网络磁盘按钮事件监听器已绑定');
        } else {
            console.error('❌ Settings: 找不到添加网络磁盘按钮元素');
        }

        // 刷新磁盘状态按钮
        this.refreshDrivesBtn.addEventListener('click', async () => {
            await this.refreshNetworkDrivesStatus();
        });

        // 模态框关闭事件
        if (this.networkDriveModalClose) {
            this.networkDriveModalClose.addEventListener('click', () => {
                console.log('🖱️ Settings: 点击关闭模态框按钮');
                this.hideNetworkDriveModal();
            });
            console.log('✅ Settings: 模态框关闭按钮事件监听器已绑定');
        } else {
            console.error('❌ Settings: 找不到模态框关闭按钮元素');
        }

        if (this.networkDriveCancel) {
            this.networkDriveCancel.addEventListener('click', () => {
                console.log('🖱️ Settings: 点击取消按钮');
                this.hideNetworkDriveModal();
            });
            console.log('✅ Settings: 取消按钮事件监听器已绑定');
        } else {
            console.error('❌ Settings: 找不到取消按钮元素');
        }

        // 点击模态框背景关闭
        if (this.networkDriveModal) {
            this.networkDriveModal.addEventListener('click', (e) => {
                if (e.target === this.networkDriveModal) {
                    console.log('🖱️ Settings: 点击模态框背景');
                    this.hideNetworkDriveModal();
                }
            });
            console.log('✅ Settings: 模态框背景点击事件监听器已绑定');
        }

        // 协议选择事件
        if (this.driveProtocolSelect) {
            this.driveProtocolSelect.addEventListener('change', (e) => {
                console.log('🖱️ Settings: 协议选择改变:', e.target.value);
                this.toggleProtocolConfig(e.target.value);
            });
            console.log('✅ Settings: 协议选择事件监听器已绑定');
        } else {
            console.error('❌ Settings: 找不到协议选择元素');
        }

        // 测试连接按钮
        if (this.testConnectionBtn) {
            this.testConnectionBtn.addEventListener('click', async () => {
                console.log('🖱️ Settings: 点击测试连接按钮');
                await this.testNetworkConnection();
            });
            console.log('✅ Settings: 测试连接按钮事件监听器已绑定');
        } else {
            console.error('❌ Settings: 找不到测试连接按钮元素');
        }

        // 表单提交事件
        if (this.networkDriveForm) {
            this.networkDriveForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('📝 Settings: 提交网络磁盘表单');
                await this.addNetworkDrive();
            });
            console.log('✅ Settings: 表单提交事件监听器已绑定');
        } else {
            console.error('❌ Settings: 找不到网络磁盘表单元素');
        }

        // 监听网络磁盘事件
        if (window.electronAPI && window.electronAPI.networkDrive) {
            window.electronAPI.networkDrive.onConnected(async (event, driveId, config) => {
                console.log(`🔗 网络磁盘已连接: ${config.displayName}`);
                await this.refreshMountedDrivesList();
            });

            window.electronAPI.networkDrive.onDisconnected(async (event, driveId, config) => {
                console.log(`🔌 网络磁盘已断开: ${config.displayName}`);
                await this.refreshMountedDrivesList();
            });

            window.electronAPI.networkDrive.onError((event, driveId, error) => {
                console.error(`❌ 网络磁盘错误: ${driveId} - ${error}`);
                this.showNotification(`网络磁盘错误: ${error}`, 'error');
            });
            console.log('✅ Settings: 网络磁盘事件监听器已设置');
        } else {
            console.warn('⚠️ Settings: 网络磁盘API不可用');
        }

        // 检查网络磁盘功能是否完全可用
        this.checkNetworkDriveAvailability();
    }

    async show() {
        this.isVisible = true;
        this.page.style.display = 'block';

        // 隐藏其他页面元素
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';

        // 使用 requestAnimationFrame 确保动画正常播放
        requestAnimationFrame(() => {
            this.page.classList.add('show');
        });

        // 加载缓存统计信息
        await this.showCacheStatistics();
        console.log('🎵 Settings: 显示设置页面');
    }

    hide() {
        this.isVisible = false;
        this.page.classList.remove('show');
        this.page.classList.add('hiding');

        // 等待动画完成后隐藏页面
        setTimeout(() => {
            if (!this.isVisible) {
                this.page.style.display = 'none';
                this.page.classList.remove('hiding');

                // 恢复其他页面元素
                document.getElementById('sidebar').style.display = 'block';
                document.getElementById('main-content').style.display = 'block';
            }
        }, 300);

        console.log('🎵 Settings: 隐藏设置页面');
    }

    async toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            await this.show();
        }
    }

    // 初始化设置值
    initializeSettings() {
        this.languageSelect.value = this.settings.language || 'zh-CN';
        this.autoplayToggle.checked = this.settings.autoplay || false;
        this.rememberPositionToggle.checked = this.settings.rememberPosition || false;
        this.desktopLyricsToggle.checked = this.settings.hasOwnProperty('desktopLyrics') ? this.settings.desktopLyrics : true;
        this.statisticsToggle.checked = this.settings.hasOwnProperty('statistics') ? this.settings.statistics : true;
        this.recentPlayToggle.checked = this.settings.hasOwnProperty('recentPlay') ? this.settings.recentPlay : true;
        this.artistsPageToggle.checked = this.settings.hasOwnProperty('artistsPage') ? this.settings.artistsPage : true;
        this.showTrackCoversToggle.checked = this.settings.hasOwnProperty('showTrackCovers') ? this.settings.showTrackCovers : true;
        this.autoScanToggle.checked = this.settings.autoScan || false;

        // 初始化本地歌词目录
        const lyricsDirectory = this.settings.lyricsDirectory;
        if (lyricsDirectory) {
            this.lyricsFolderPath.textContent = lyricsDirectory;
            this.lyricsFolderPath.classList.add('selected');

            // 设置本地歌词管理器
            if (window.localLyricsManager) {
                window.localLyricsManager.setLyricsDirectory(lyricsDirectory);
            }
        } else {
            this.lyricsFolderPath.textContent = '未选择';
            this.lyricsFolderPath.classList.remove('selected');
        }

        // 初始化封面缓存目录
        const coverCacheDirectory = this.settings.coverCacheDirectory;
        if (coverCacheDirectory) {
            this.coverCacheFolderPath.textContent = coverCacheDirectory;
            this.coverCacheFolderPath.classList.add('selected');

            // 设置本地封面管理器
            if (window.localCoverManager) {
                window.localCoverManager.setCoverDirectory(coverCacheDirectory);
            }
        } else {
            this.coverCacheFolderPath.textContent = '未选择';
            this.coverCacheFolderPath.classList.remove('selected');
        }

        // 初始化网络磁盘设置
        this.networkDriveToggle.checked = this.settings.hasOwnProperty('networkDriveEnabled') ? this.settings.networkDriveEnabled : false;
        this.toggleNetworkDriveConfig(this.networkDriveToggle.checked);

        // 加载已挂载的网络磁盘列表
        this.refreshMountedDrivesList();

        console.log('🎵 Settings: 设置值初始化完成', this.settings);

        // 初始化完成后，发出设置状态事件，确保相关组件同步
        setTimeout(() => {
            this.emit('desktopLyricsEnabled', this.desktopLyricsToggle.checked);
            this.emit('statisticsEnabled', this.statisticsToggle.checked);
            this.emit('recentPlayEnabled', this.recentPlayToggle.checked);
            this.emit('artistsPageEnabled', this.artistsPageToggle.checked);
            console.log(
                '🎵 Settings: 发出初始状态事件 - 桌面歌词:', this.desktopLyricsToggle.checked,
                '统计信息:', this.statisticsToggle.checked,
                '最近播放:', this.recentPlayToggle.checked,
                '艺术家页面:', this.artistsPageToggle.checked
            );
        }, 100);
    }

    // 加载设置
    loadSettings() {
        let settings = window.cacheManager.getLocalCache('musicbox-settings');
        if (settings === null)
            settings = {};
        return settings;
    }

    // 更新设置
    updateSetting(key, value) {
        this.settings[key] = value;
        window.cacheManager.setLocalCache('musicbox-settings', this.settings);
    }

    // 获取设置值
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    // 更新音乐文件夹路径显示
    updateMusicFolderPath(path) {
        this.updateSetting('musicDirectory', path);
        console.log(`✅ Settings: 音乐文件夹路径已更新为 ${path}`);
        // 这里可以添加UI更新逻辑，比如显示选中的路径
    }

    // 缓存管理方法
    async showCacheStatistics() {
        try {
            this.viewCacheStatsBtn.disabled = true;
            this.viewCacheStatsBtn.textContent = '获取中...';

            const stats = await api.getCacheStatistics();
            if (stats) {
                const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
                const cacheAgeDays = Math.floor(stats.cacheAge / (1000 * 60 * 60 * 24));

                this.cacheStatsDescription.textContent =
                    `缓存了 ${stats.totalTracks} 个音乐文件，总大小 ${totalSizeMB} MB，已扫描 ${stats.scannedDirectories} 个目录，缓存时间 ${cacheAgeDays} 天`;

                showToast(`缓存统计: ${stats.totalTracks} 个文件，${totalSizeMB} MB`, 'info');
            } else {
                showToast('获取缓存统计失败', 'error');
            }
        } catch (error) {
            console.error('获取缓存统计失败:', error);
            showToast('获取缓存统计失败', 'error');
        } finally {
            this.viewCacheStatsBtn.disabled = false;
            this.viewCacheStatsBtn.textContent = '查看统计';
        }
    }

    async validateCache() {
        try {
            this.validateCacheBtn.disabled = true;
            this.validateCacheBtn.textContent = '验证中...';
            showToast('开始验证缓存，请稍候...', 'info');

            const result = await api.validateCache();
            if (result) {
                const message = `缓存验证完成 - 有效: ${result.valid}, 无效: ${result.invalid}, 已修改: ${result.modified}`;
                showToast(message, 'success');
            } else {
                showToast('缓存验证失败', 'error');
            }
        } catch (error) {
            console.error('缓存验证失败:', error);
            showToast('缓存验证失败', 'error');
        } finally {
            this.validateCacheBtn.disabled = false;
            this.validateCacheBtn.textContent = '验证缓存';
        }
    }

    async clearCache() {
        if (!confirm('确定要清空所有缓存吗？这将删除所有已缓存的音乐文件信息，下次启动时需要重新扫描。')) {
            return;
        }

        try {
            this.clearCacheBtn.disabled = true;
            this.clearCacheBtn.textContent = '清空中...';

            const success = await api.clearCache();
            if (success) {
                showToast('缓存已清空', 'success');
                this.cacheStatsDescription.textContent = '缓存已清空';
            } else {
                showToast('清空缓存失败', 'error');
            }
        } catch (error) {
            console.error('清空缓存失败:', error);
            showToast('清空缓存失败', 'error');
        } finally {
            this.clearCacheBtn.disabled = false;
            this.clearCacheBtn.textContent = '清空缓存';
        }
    }

    // 内嵌歌词测试方法
    async testEmbeddedLyrics() {
        try {
            this.testEmbeddedLyricsBtn.disabled = true;
            this.testEmbeddedLyricsBtn.textContent = '选择文件...';

            const filePaths = await window.electronAPI.openFiles();
            if (!filePaths || filePaths.length === 0) {
                showToast('未选择文件', 'info');
                return;
            }

            const filePath = filePaths[0];
            this.testEmbeddedLyricsBtn.textContent = '检测中...';
            console.log(`🎵 测试内嵌歌词: ${filePath}`);
            if (!window.embeddedLyricsManager) {
                showToast('内嵌歌词管理器不可用', 'error');
                return;
            }

            const debugResult = await window.embeddedLyricsManager.debugEmbeddedLyrics(filePath);
            let reportLines = [
                `文件: ${filePath}`,
                `时间: ${new Date().toLocaleString()}`,
                ``,
                `=== 检测结果 ===`,
                `成功: ${debugResult.success ? '是' : '否'}`
            ];

            if (debugResult.success && debugResult.lyricsAnalysis) {
                const analysis = debugResult.lyricsAnalysis;
                reportLines.push(
                    ``,
                    `=== 歌词信息 ===`,
                    `类型: ${analysis.type}`,
                    `格式: ${analysis.format}`,
                    `语言: ${analysis.language || '未知'}`,
                    `描述: ${analysis.description || '无'}`,
                    `同步歌词: ${analysis.synchronized ? '是' : '否'}`,
                    `文本长度: ${analysis.textLength} 字符`,
                    `时间戳数量: ${analysis.timestampCount}`,
                    ``
                );

                if (analysis.textSample) {
                    reportLines.push(`=== 歌词预览 ===`, analysis.textSample, ``);
                }

                if (debugResult.conversionResult) {
                    const conv = debugResult.conversionResult;
                    reportLines.push(
                        `=== LRC转换 ===`,
                        `转换成功: ${conv.success ? '是' : '否'}`,
                        `LRC长度: ${conv.lrcLength} 字符`
                    );

                    if (conv.error) {
                        reportLines.push(`转换错误: ${conv.error}`);
                    }
                    if (conv.lrcSample) {
                        reportLines.push(``, `=== LRC预览 ===`, conv.lrcSample);
                    }
                }
                showToast('检测到内嵌歌词！', 'success');
            } else {
                reportLines.push(`错误: ${debugResult.error || '未知错误'}`);
                showToast('未检测到内嵌歌词', 'info');
            }

            // 显示详细报告
            const report = reportLines.join('\n');
            console.log('🔧 内嵌歌词测试报告:\n', report);
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: white; border: 1px solid #ccc; border-radius: 8px;
                padding: 20px; max-width: 80%; max-height: 80%; overflow: auto;
                z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                font-family: monospace; font-size: 12px; line-height: 1.4;
            `;

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '关闭';
            closeBtn.style.cssText = 'float: right; margin-bottom: 10px; padding: 5px 10px; color: red';
            closeBtn.onclick = () => document.body.removeChild(dialog);

            const content = document.createElement('pre');
            content.textContent = report;
            content.style.cssText = 'margin: 0; white-space: pre-wrap; word-wrap: break-word;';

            dialog.appendChild(closeBtn);
            dialog.appendChild(content);
            document.body.appendChild(dialog);
        } catch (error) {
            console.error('❌ 内嵌歌词测试失败:', error);
            showToast('内嵌歌词测试失败', 'error');
        } finally {
            this.testEmbeddedLyricsBtn.disabled = false;
            this.testEmbeddedLyricsBtn.textContent = '测试内嵌歌词';
        }
    }

    // 快捷键配置相关方法
    setupShortcutEventListeners() {
        // 全局快捷键开关
        this.globalShortcutsToggle.addEventListener('change', async (e) => {
            await this.toggleGlobalShortcuts(e.target.checked);
        });

        // 重置快捷键按钮
        this.resetShortcutsBtn.addEventListener('click', () => {
            this.showResetShortcutsDialog();
        });

        // 初始化快捷键配置
        this.initializeShortcuts();
    }

    initializeShortcuts() {
        if (!window.shortcutConfig) {
            console.warn('快捷键配置管理器未加载');
            return;
        }

        // 确保配置已正确加载
        if (window.cacheManager) {
            window.shortcutConfig.reloadConfig();
        }

        const config = window.shortcutConfig.getConfig();

        // 设置全局快捷键开关状态
        this.globalShortcutsToggle.checked = config.enableGlobalShortcuts;
        this.updateGlobalShortcutsVisibility(config.enableGlobalShortcuts);

        // 渲染快捷键列表
        this.renderShortcutsList('local', config.localShortcuts);
        this.renderShortcutsList('global', config.globalShortcuts);
        console.log('🎹 快捷键配置初始化完成');
    }

    renderShortcutsList(type, shortcuts) {
        const container = type === 'local' ? this.localShortcutsList : this.globalShortcutsList;
        if (!container) return;

        container.innerHTML = '';

        Object.entries(shortcuts).forEach(([id, shortcut]) => {
            const item = this.createShortcutItem(type, id, shortcut);
            container.appendChild(item);
        });
    }

    createShortcutItem(type, id, shortcut) {
        const item = document.createElement('div');
        item.className = 'shortcut-item';
        item.innerHTML = `
            <div class="shortcut-info">
                <div class="shortcut-name">${shortcut.name}</div>
                <div class="shortcut-description">${shortcut.description}</div>
            </div>
            <div class="shortcut-controls">
                <div class="shortcut-key ${shortcut.enabled ? '' : 'disabled'}"
                     data-type="${type}"
                     data-id="${id}"
                     title="点击修改快捷键">
                    ${this.formatShortcutKey(shortcut.key)}
                </div>
                <div class="shortcut-toggle">
                    <div class="toggle-switch">
                        <input type="checkbox"
                               id="shortcut-${type}-${id}"
                               class="toggle-input"
                               ${shortcut.enabled ? 'checked' : ''}
                               data-type="${type}"
                               data-id="${id}">
                        <label for="shortcut-${type}-${id}" class="toggle-label"></label>
                    </div>
                </div>
            </div>
        `;

        // 添加事件监听器
        const keyElement = item.querySelector('.shortcut-key');
        const toggleElement = item.querySelector('.toggle-input');

        keyElement.addEventListener('click', () => {
            if (shortcut.enabled) {
                this.startRecordingShortcut(type, id, keyElement);
            }
        });

        toggleElement.addEventListener('change', (e) => {
            this.toggleShortcut(type, id, e.target.checked);
        });

        return item;
    }

    formatShortcutKey(key) {
        if (!key) return '未设置';
        return key
            .replace(/Ctrl/g, 'Ctrl')
            .replace(/Alt/g, 'Alt')
            .replace(/Shift/g, 'Shift')
            .replace(/Cmd/g, '⌘')
            .replace(/ArrowUp/g, '↑')
            .replace(/ArrowDown/g, '↓')
            .replace(/ArrowLeft/g, '←')
            .replace(/ArrowRight/g, '→')
            .replace(/Space/g, '空格');
    }

    startRecordingShortcut(type, id, element) {
        if (!window.shortcutRecorder) {
            console.warn('快捷键录制器未加载');
            return;
        }

        // 开始录制
        window.shortcutRecorder.startRecording(element);

        // 监听录制结果
        const handleRecorded = async (shortcutString) => {
            await this.handleShortcutRecorded(type, id, shortcutString, element);
            window.shortcutRecorder.off('shortcutRecorded', handleRecorded);
        };

        window.shortcutRecorder.on('shortcutRecorded', handleRecorded);
    }

    async handleShortcutRecorded(type, id, shortcutString, element) {
        // 检查冲突
        const conflicts = window.shortcutConfig.checkConflicts(type, id, shortcutString);
        if (conflicts.length > 0) {
            this.showShortcutConflict(conflicts, shortcutString, async () => {
                // 用户确认覆盖
                await this.updateShortcut(type, id, shortcutString, element);
            });
        } else {
            await this.updateShortcut(type, id, shortcutString, element);
        }
    }

    async updateShortcut(type, id, shortcutString, element) {
        try {
            const success = await window.shortcutConfig.updateShortcut(type, id, shortcutString);
            if (success) {
                element.textContent = this.formatShortcutKey(shortcutString);
                showToast('快捷键已更新', 'success');

                // 通知应用更新快捷键
                this.emit('shortcutsUpdated');
            } else {
                showToast('快捷键更新失败', 'error');
            }
        } catch (error) {
            console.error('❌ 更新快捷键失败:', error);
            showToast('快捷键更新失败', 'error');
        }
    }

    toggleShortcut(type, id, enabled) {
        const success = window.shortcutConfig.setShortcutEnabled(type, id, enabled);

        if (success) {
            // 更新UI
            const keyElement = document.querySelector(`[data-type="${type}"][data-id="${id}"].shortcut-key`);
            if (keyElement) {
                if (enabled) {
                    keyElement.classList.remove('disabled');
                } else {
                    keyElement.classList.add('disabled');
                }
            }

            showToast(enabled ? '快捷键已启用' : '快捷键已禁用', 'success');
            this.emit('shortcutsUpdated');
        } else {
            showToast('快捷键状态更新失败', 'error');
        }
    }

    async toggleGlobalShortcuts(enabled) {
        try {
            const success = await window.shortcutConfig.setGlobalShortcutsEnabled(enabled);
            if (success) {
                this.updateGlobalShortcutsVisibility(enabled);
                showToast(enabled ? '全局快捷键已启用' : '全局快捷键已禁用', 'success');
                this.emit('shortcutsUpdated');
            } else {
                showToast('全局快捷键设置失败', 'error');
                // 恢复开关状态
                this.globalShortcutsToggle.checked = !enabled;
            }
        } catch (error) {
            console.error('❌ 切换全局快捷键失败:', error);
            showToast('全局快捷键设置失败', 'error');
            // 恢复开关状态
            this.globalShortcutsToggle.checked = !enabled;
        }
    }

    updateGlobalShortcutsVisibility(visible) {
        if (this.globalShortcutsGroup) {
            if (visible) {
                this.globalShortcutsGroup.classList.remove('hidden');
            } else {
                this.globalShortcutsGroup.classList.add('hidden');
            }
        }
    }

    showShortcutConflict(conflicts, newShortcut, onConfirm) {
        const conflictNames = conflicts.map(c => `${c.name} (${c.type === 'local' ? '应用内' : '全局'})`).join('、');
        const message = `快捷键 "${this.formatShortcutKey(newShortcut)}" 与以下快捷键冲突：\n${conflictNames}\n\n是否要覆盖现有快捷键？`;
        if (confirm(message)) {
            onConfirm();
        }
    }

    showResetShortcutsDialog() {
        const message = '确定要将所有快捷键重置为默认设置吗？\n\n此操作将清除您的所有自定义快捷键配置。';
        if (confirm(message)) {
            this.resetShortcuts();
        }
    }

    resetShortcuts() {
        const success = window.shortcutConfig.resetToDefaults();
        if (success) {
            // 重新初始化快捷键配置
            this.initializeShortcuts();
            showToast('快捷键已重置为默认设置', 'success');
            this.emit('shortcutsUpdated');
        } else {
            showToast('重置快捷键失败', 'error');
        }
    }

    // 网络磁盘相关方法
    // 检查网络磁盘功能可用性
    checkNetworkDriveAvailability() {
        const requiredElements = [
            'networkDriveToggle',
            'networkDriveConfig',
            'addNetworkDriveBtn',
            'networkDriveModal',
            'networkDriveForm'
        ];

        const missingElements = requiredElements.filter(elementName => !this[elementName]);

        if (missingElements.length > 0) {
            console.error('❌ Settings: 网络磁盘功能不完整，缺少元素:', missingElements);
            // 禁用网络磁盘功能
            if (this.networkDriveToggle) {
                this.networkDriveToggle.disabled = true;
                this.networkDriveToggle.title = '网络磁盘功能不可用：缺少必要元素';
            }
            return false;
        } else {
            console.log('✅ Settings: 网络磁盘功能完全可用');
            return true;
        }
    }

    // 切换网络磁盘配置区域显示
    toggleNetworkDriveConfig(enabled) {
        if (enabled) {
            this.networkDriveConfig.style.display = 'block';
        } else {
            this.networkDriveConfig.style.display = 'none';
        }
    }

    // 显示网络磁盘配置模态框
    showNetworkDriveModal() {
        console.log('🔧 Settings: 显示网络磁盘配置模态框');

        if (!this.networkDriveModal) {
            console.error('❌ Settings: 网络磁盘模态框元素不存在');
            return;
        }

        console.log('🔧 Settings: 重置表单');
        this.resetNetworkDriveForm();

        console.log('🔧 Settings: 显示模态框');
        this.networkDriveModal.style.display = 'flex';

        if (this.driveNameInput) {
            console.log('🔧 Settings: 聚焦到名称输入框');
            this.driveNameInput.focus();
        } else {
            console.warn('⚠️ Settings: 名称输入框元素不存在');
        }
        console.log('✅ Settings: 网络磁盘模态框已显示');
    }

    // 隐藏网络磁盘配置模态框
    hideNetworkDriveModal() {
        this.networkDriveModal.style.display = 'none';
        this.resetNetworkDriveForm();
    }

    // 重置网络磁盘表单
    resetNetworkDriveForm() {
        this.networkDriveForm.reset();
        this.toggleProtocolConfig('');
        this.hideConnectionTestResult();
    }

    // 切换协议配置显示
    toggleProtocolConfig(protocol) {
        this.smbConfig.style.display = protocol === 'smb' ? 'block' : 'none';
        this.webdavConfig.style.display = protocol === 'webdav' ? 'block' : 'none';
    }

    // 测试网络连接
    async testNetworkConnection() {
        const config = this.getNetworkDriveConfig();
        if (!config) {
            this.showConnectionTestResult(false, '请填写完整的配置信息');
            return;
        }

        this.showConnectionTestResult(null, '正在测试连接...');
        this.testConnectionBtn.disabled = true;

        try {
            await window.electronAPI.networkDrive.testConnection(config);
            this.showConnectionTestResult(true, '连接测试成功！');
        } catch (error) {
            this.showConnectionTestResult(false, `连接测试失败: ${error.message}`);
        } finally {
            this.testConnectionBtn.disabled = false;
        }
    }

    // 获取网络磁盘配置
    getNetworkDriveConfig() {
        const protocol = this.driveProtocolSelect.value;
        const name = this.driveNameInput.value.trim();
        const username = this.driveUsernameInput.value.trim();
        const password = this.drivePasswordInput.value;

        if (!protocol || !name || !username || !password) {
            return null;
        }

        const config = {
            id: `drive_${Date.now()}`,
            type: protocol,
            displayName: name,
            username: username,
            password: password
        };

        if (protocol === 'smb') {
            const host = this.smbHostInput.value.trim();
            const share = this.smbShareInput.value.trim();
            const domain = this.smbDomainInput.value.trim();

            if (!host || !share) {
                return null;
            }

            config.host = host;
            config.share = share;
            config.domain = domain || 'WORKGROUP';
        } else if (protocol === 'webdav') {
            const url = this.webdavUrlInput.value.trim();
            if (!url) {
                return null;
            }
            config.url = url;
        }
        return config;
    }

    // 显示连接测试结果
    showConnectionTestResult(success, message) {
        const resultElement = this.connectionTestResult;
        const statusElement = resultElement.querySelector('.test-status');
        const messageElement = resultElement.querySelector('.test-message');

        resultElement.style.display = 'block';
        messageElement.textContent = message;

        if (success === null) {
            // 测试中
            statusElement.className = 'test-status testing';
            statusElement.textContent = '⏳';
        } else if (success) {
            // 成功
            statusElement.className = 'test-status success';
            statusElement.textContent = '✅';
        } else {
            // 失败
            statusElement.className = 'test-status error';
            statusElement.textContent = '❌';
        }
    }

    // 隐藏连接测试结果
    hideConnectionTestResult() {
        this.connectionTestResult.style.display = 'none';
    }

    // 添加网络磁盘
    async addNetworkDrive() {
        const config = this.getNetworkDriveConfig();
        if (!config) {
            this.showConnectionTestResult(false, '请填写完整的配置信息');
            return;
        }

        this.networkDriveConfirm.disabled = true;
        this.networkDriveConfirm.textContent = '添加中...';

        try {
            let success = false;
            if (config.type === 'smb') {
                success = await window.electronAPI.networkDrive.mountSMB(config);
            } else if (config.type === 'webdav') {
                success = await window.electronAPI.networkDrive.mountWebDAV(config);
            }

            if (success) {
                console.log(`✅ 网络磁盘添加成功: ${config.displayName}`);
                this.hideNetworkDriveModal();
                await this.refreshMountedDrivesList();
                this.showNotification(`网络磁盘 "${config.displayName}" 添加成功`, 'success');
            } else {
                this.showConnectionTestResult(false, '网络磁盘添加失败');
            }
        } catch (error) {
            console.error('❌ 添加网络磁盘失败:', error);
            this.showConnectionTestResult(false, `添加失败: ${error.message}`);
        } finally {
            this.networkDriveConfirm.disabled = false;
            this.networkDriveConfirm.textContent = '添加磁盘';
        }
    }

    // 刷新已挂载的磁盘列表
    async refreshMountedDrivesList() {
        try {
            const mountedDrives = await window.electronAPI.networkDrive.getMountedDrives();
            this.renderMountedDrivesList(mountedDrives);
        } catch (error) {
            console.error('❌ 获取挂载磁盘列表失败:', error);
        }
    }

    // 渲染已挂载的磁盘列表
    renderMountedDrivesList(drives) {
        const listElement = this.mountedDrivesList;

        if (!drives || drives.length === 0) {
            listElement.innerHTML = '<div class="no-drives-message">暂无已挂载的网络磁盘</div>';
            return;
        }

        listElement.innerHTML = drives.map(drive => {
            const statusClass = drive.connected ? 'connected' : 'disconnected';
            const statusText = drive.connected ? '已连接' : '已断开';
            const protocolText = drive.type === 'smb' ? 'SMB' : 'WebDAV';

            return `
                <div class="mounted-drive-item" data-drive-id="${drive.id}">
                    <div class="drive-info">
                        <div class="drive-name">${drive.config.displayName}</div>
                        <div class="drive-details">
                            <span class="drive-protocol">${protocolText}</span>
                            <span class="drive-status ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                    <div class="drive-actions">
                        <button class="btn btn-small btn-primary scan-drive-btn" data-drive-id="${drive.id}" ${!drive.connected ? 'disabled' : ''}>
                            扫描
                        </button>
                        <button class="btn btn-small btn-secondary unmount-drive-btn" data-drive-id="${drive.id}">
                            卸载
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 添加扫描按钮事件监听器
        listElement.querySelectorAll('.scan-drive-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const driveId = e.target.getAttribute('data-drive-id');
                await this.scanNetworkDrive(driveId);
            });
        });

        // 添加卸载按钮事件监听器
        listElement.querySelectorAll('.unmount-drive-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const driveId = e.target.getAttribute('data-drive-id');
                await this.unmountNetworkDrive(driveId);
            });
        });
    }

    // 扫描网络磁盘
    async scanNetworkDrive(driveId) {
        try {
            console.log(`🌐 开始扫描网络磁盘: ${driveId}`);
            this.showNotification('正在扫描网络磁盘...', 'info');

            const success = await window.electronAPI.library.scanNetworkDrive(driveId, '/');
            if (success) {
                console.log(`✅ 网络磁盘扫描成功: ${driveId}`);
                this.showNotification('网络磁盘扫描完成', 'success');

                // 通知其他组件刷新音乐库
                this.emit('libraryUpdated');
            } else {
                this.showNotification('网络磁盘扫描失败', 'error');
            }
        } catch (error) {
            console.error('❌ 扫描网络磁盘失败:', error);
            this.showNotification(`扫描失败: ${error.message}`, 'error');
        }
    }

    // 卸载网络磁盘
    async unmountNetworkDrive(driveId) {
        try {
            const success = await window.electronAPI.networkDrive.unmount(driveId);
            if (success) {
                console.log(`✅ 网络磁盘卸载成功: ${driveId}`);
                await this.refreshMountedDrivesList();
                this.showNotification('网络磁盘卸载成功', 'success');
            } else {
                this.showNotification('网络磁盘卸载失败', 'error');
            }
        } catch (error) {
            console.error('❌ 卸载网络磁盘失败:', error);
            this.showNotification(`卸载失败: ${error.message}`, 'error');
        }
    }

    // 刷新网络磁盘状态
    async refreshNetworkDrivesStatus() {
        try {
            console.log('🔄 刷新网络磁盘连接状态');
            this.refreshDrivesBtn.disabled = true;
            this.refreshDrivesBtn.textContent = '刷新中...';

            const success = await window.electronAPI.networkDrive.refreshConnections();
            if (success) {
                this.showNotification('网络磁盘状态刷新完成', 'success');
                // 刷新显示列表
                await this.refreshMountedDrivesList();
            } else {
                this.showNotification('刷新网络磁盘状态失败', 'error');
            }
        } catch (error) {
            console.error('❌ 刷新网络磁盘状态失败:', error);
            this.showNotification(`刷新失败: ${error.message}`, 'error');
        } finally {
            this.refreshDrivesBtn.disabled = false;
            this.refreshDrivesBtn.textContent = '刷新状态';
        }
    }

    // 显示通知消息
    showNotification(message, type = 'info') {
        showToast(message, type);
    }
}
