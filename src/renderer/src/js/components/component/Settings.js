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

        // 关闭设置页面 (ESC键)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
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
}
