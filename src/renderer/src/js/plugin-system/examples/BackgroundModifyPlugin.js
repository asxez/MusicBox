/**
 * 背景图管理插件
 */

class BackgroundModifyPlugin extends PluginBase {
    constructor(context) {
        super(context);

        this.metadata = {
            id: 'background-manager-plugin',
            name: '背景图修改器',
            version: '1.0.0',
            description: '可修改应用的背景图片，支持单张图片和文件夹模式',
            author: 'MusicBox-ASXE',
            permissions: ['settings', 'ui', 'storage', 'system'],
            category: '界面增强'
        };

        // 背景设置
        this.backgroundSettings = {
            enabled: false,
            mode: 'single', // 'single' | 'folder'
            singleImagePath: '',
            folderPath: '',
            opacity: 30, // 0-100
            switchMode: 'random', // 'random' | 'sequential'
            switchInterval: 30, // 秒
            supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
            currentImageIndex: 0,
            imageList: []
        };

        // 内部状态
        this.backgroundElement = null;
        this.switchTimer = null;
        this.isInitialized = false;
    }

    async activate() {
        await super.activate();

        try {
            this.loadSettings();
            this.addPluginStyles();
            await this.addBackgroundSettings();
            this.initializeBackgroundSystem();

            if (this.backgroundSettings.enabled) {
                await this.applyBackgroundSettings();
            }
            this.showNotification('背景图插件已激活', 'success');
        } catch (error) {
            this.showNotification('插件激活失败', 'error');
        }
    }

    async deactivate() {
        this.removeBackground();

        if (this.backgroundElement && this.backgroundElement.parentNode) {
            this.backgroundElement.parentNode.removeChild(this.backgroundElement);
            this.backgroundElement = null;
        }

        this.clearSwitchTimer();
        this.isInitialized = false;

        await super.deactivate();
        this.showNotification('背景图插件已停用', 'info');
    }

    // 加载设置
    loadSettings() {
        const saved = this.getStorage('backgroundSettings');
        if (saved) {
            this.backgroundSettings = {...this.backgroundSettings, ...saved};
        }
    }

    // 保存设置
    saveSettings() {
        this.setStorage('backgroundSettings', this.backgroundSettings);
    }

    addPluginStyles() {
        const css = `
            .background-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background-size: cover !important;
                background-position: center !important;
                background-repeat: no-repeat !important;
                pointer-events: none !important;
                z-index: -999 !important;
                transition: opacity 0.5s ease-in-out !important;
            }

            body, .app {
                background-color: transparent !important;
                background-image: none !important;
                background: transparent !important;
            }

            /* 强制覆盖主内容区域的背景，确保背景图可见 */
            .main-content {
                background: rgba(255, 255, 255, 0.05) !important;
                background-color: rgba(255, 255, 255, 0.05) !important;
                background-image: none !important;
                backdrop-filter: blur(10px) !important;
            }

            /* 暗色主题下的主内容区域 */
            [data-theme='dark'] .main-content {
                background: rgba(34, 34, 34, 0.05) !important;
                background-color: rgba(34, 34, 34, 0.05) !important;
                background-image: none !important;
            }

            /* 强制覆盖侧边栏的背景 */
            .sidebar {
                background: rgba(255, 255, 255, 0.15) !important;
                background-color: rgba(255, 255, 255, 0.15) !important;
                background-image: none !important;
                backdrop-filter: blur(15px) !important;
            }

            /* 暗色主题下的侧边栏 */
            [data-theme='dark'] .sidebar {
                background: rgba(34, 34, 34, 0.15) !important;
                background-color: rgba(34, 34, 34, 0.15) !important;
                background-image: none !important;
            }

            /* 强制覆盖所有可能遮挡背景的元素 */
            .track-list,
            .tracks-container,
            .modern-tracks-table,
            .playlist-page,
            .artist-page,
            .album-page {
                background: rgba(255, 255, 255, 0.05) !important;
                background-color: rgba(255, 255, 255, 0.05) !important;
                background-image: none !important;
            }

            /* 暗色主题下的内容容器 */
            [data-theme='dark'] .track-list,
            [data-theme='dark'] .tracks-container,
            [data-theme='dark'] .modern-tracks-table,
            [data-theme='dark'] .playlist-page,
            [data-theme='dark'] .artist-page,
            [data-theme='dark'] .album-page {
                background: rgba(34, 34, 34, 0.05) !important;
                background-color: rgba(34, 34, 34, 0.05) !important;
                background-image: none !important;
            }

            .app {
                grid-template-rows: 64px 1fr 64px !important;
            }

            @media (max-width: 768px) {
                .app {
                    grid-template-rows: 64px 1fr 64px !important;
                }
            }

            .plugin-settings-section {
                margin-top: var(--spacing-xl) !important;
                padding: var(--spacing-xl) !important;
                background: var(--color-surface) !important;
                border: 1px solid var(--color-border) !important;
                border-radius: var(--radius-lg) !important;
            }

            .plugin-section {
                background: var(--color-surface) !important;
                border: 1px solid var(--color-border) !important;
                border-radius: var(--radius-md) !important;
                margin-bottom: var(--spacing-lg) !important;
                padding: var(--spacing-lg) !important;
            }

            .plugin-setting-item .setting-item {
                background: var(--color-surface) !important;
                border: 1px solid var(--color-border) !important;
                border-radius: var(--radius-md) !important;
                padding: var(--spacing-md) !important;
                margin-bottom: var(--spacing-sm) !important;
            }

            .plugin-setting-item .btn {
                background: var(--color-primary) !important;
                color: white !important;
                border: none !important;
                border-radius: var(--radius-md) !important;
                padding: var(--spacing-sm) var(--spacing-lg) !important;
                cursor: pointer !important;
            }
            }
        `;

        return this.addStyle(css);
    }

    // 添加背景设置区域
    async addBackgroundSettings() {
        const sectionId = await this.addSettingsSection({
            id: 'background-settings',
            title: '背景设置',
            description: '管理应用的背景图片设置',
            order: 15,
            items: [
                {
                    type: 'toggle',
                    id: 'enabled',
                    label: '启用背景图片',
                    description: '开启或关闭背景图片功能',
                    value: this.backgroundSettings.enabled,
                    onChange: (value) => this.handleSettingChange('enabled', value)
                },
                {
                    type: 'select',
                    id: 'mode',
                    label: '背景模式',
                    description: '选择单张图片或文件夹模式',
                    value: this.backgroundSettings.mode,
                    options: [
                        {value: 'single', label: '单张图片'},
                        {value: 'folder', label: '图片文件夹'}
                    ],
                    onChange: (value) => this.handleSettingChange('mode', value)
                },
                {
                    type: 'button',
                    id: 'select-image',
                    label: '选择背景图片',
                    description: '选择单张背景图片文件',
                    buttonText: '选择图片',
                    onClick: () => this.selectImage()
                },
                {
                    type: 'button',
                    id: 'select-folder',
                    label: '选择图片文件夹',
                    description: '选择包含背景图片的文件夹',
                    buttonText: '选择文件夹',
                    onClick: () => this.selectFolder()
                },
                {
                    type: 'button',
                    id: 'clear-selection',
                    label: '清除选择',
                    description: '清除当前选择的图片或文件夹',
                    buttonText: '清除选择',
                    onClick: () => this.clearSelection()
                },
                {
                    type: 'slider',
                    id: 'opacity',
                    label: '背景透明度',
                    description: '调节背景图片的透明度 (0-100%)',
                    value: this.backgroundSettings.opacity,
                    min: 0,
                    max: 100,
                    step: 5,
                    onChange: (value) => this.handleSettingChange('opacity', value)
                },
                {
                    type: 'select',
                    id: 'switchMode',
                    label: '切换模式',
                    description: '文件夹模式下的图片切换方式',
                    value: this.backgroundSettings.switchMode,
                    options: [
                        {value: 'random', label: '随机切换'},
                        {value: 'sequential', label: '顺序轮播'}
                    ],
                    onChange: (value) => this.handleSettingChange('switchMode', value)
                },
                {
                    type: 'slider',
                    id: 'switchInterval',
                    label: '切换间隔',
                    description: '文件夹模式下的图片切换间隔 (秒)',
                    value: this.backgroundSettings.switchInterval,
                    min: 10,
                    max: 300,
                    step: 10,
                    onChange: (value) => this.handleSettingChange('switchInterval', value)
                },
                {
                    type: 'button',
                    id: 'next-image',
                    label: '下一张图片',
                    description: '手动切换到下一张背景图片',
                    buttonText: '下一张',
                    onClick: () => this.nextImage()
                },
                {
                    type: 'button',
                    id: 'prev-image',
                    label: '上一张图片',
                    description: '手动切换到上一张背景图片',
                    buttonText: '上一张',
                    onClick: () => this.prevImage()
                },
                {
                    type: 'button',
                    id: 'reset-background',
                    label: '重置背景设置',
                    description: '将所有背景设置恢复为默认值',
                    buttonText: '重置为默认',
                    onClick: () => this.resetToDefault()
                },

            ]
        });

        // 设置完成后，更新按钮状态
        setTimeout(() => {
            this.updateButtonStates();
        }, 100);

        return sectionId;
    }

    // 更新按钮状态
    updateButtonStates() {
        try {
            const isFolder = this.backgroundSettings.mode === 'folder';
            const hasSelection = isFolder ? this.backgroundSettings.folderPath : this.backgroundSettings.singleImagePath;
            const hasImages = this.backgroundSettings.imageList.length > 0;

            // 获取按钮元素
            const selectImageBtn = document.querySelector(`#${this.metadata.id}-background-settings-select-image`);
            const selectFolderBtn = document.querySelector(`#${this.metadata.id}-background-settings-select-folder`);
            const clearBtn = document.querySelector(`#${this.metadata.id}-background-settings-clear-selection`);
            const nextBtn = document.querySelector(`#${this.metadata.id}-background-settings-next-image`);
            const prevBtn = document.querySelector(`#${this.metadata.id}-background-settings-prev-image`);

            // 更新按钮可见性和状态
            if (selectImageBtn) {
                selectImageBtn.style.display = isFolder ? 'none' : 'inline-flex';
            }

            if (selectFolderBtn) {
                selectFolderBtn.style.display = isFolder ? 'inline-flex' : 'none';
            }

            if (clearBtn) {
                clearBtn.style.display = hasSelection ? 'inline-flex' : 'none';
            }

            if (nextBtn) {
                nextBtn.style.display = (isFolder && hasImages) ? 'inline-flex' : 'none';
            }

            if (prevBtn) {
                prevBtn.style.display = (isFolder && hasImages) ? 'inline-flex' : 'none';
            }

            // 更新按钮文本以显示当前状态
            this.updateButtonTexts();

        } catch (error) {
            console.error('更新按钮状态失败:', error);
        }
    }

    // 更新按钮文本
    updateButtonTexts() {
        try {
            const isFolder = this.backgroundSettings.mode === 'folder';
            const currentPath = isFolder ? this.backgroundSettings.folderPath : this.backgroundSettings.singleImagePath;

            // 更新选择按钮文本
            const selectImageBtn = document.querySelector(`#${this.metadata.id}-background-settings-select-image`);
            const selectFolderBtn = document.querySelector(`#${this.metadata.id}-background-settings-select-folder`);

            if (selectImageBtn && !isFolder) {
                selectImageBtn.textContent = currentPath ? `已选择: ${this.getFileName(currentPath)}` : '选择图片';
            }

            if (selectFolderBtn && isFolder) {
                if (currentPath) {
                    const imageCount = this.backgroundSettings.imageList.length;
                    selectFolderBtn.textContent = `已选择: ${this.getFileName(currentPath)} (${imageCount}张图片)`;
                } else {
                    selectFolderBtn.textContent = '选择文件夹';
                }
            }

            // 更新导航按钮文本
            const nextBtn = document.querySelector(`#${this.metadata.id}-background-settings-next-image`);
            const prevBtn = document.querySelector(`#${this.metadata.id}-background-settings-prev-image`);

            if (nextBtn && isFolder && this.backgroundSettings.imageList.length > 0) {
                const current = this.backgroundSettings.currentImageIndex + 1;
                const total = this.backgroundSettings.imageList.length;
                nextBtn.textContent = `下一张 (${current}/${total})`;
            }

            if (prevBtn && isFolder && this.backgroundSettings.imageList.length > 0) {
                const current = this.backgroundSettings.currentImageIndex + 1;
                const total = this.backgroundSettings.imageList.length;
                prevBtn.textContent = `上一张 (${current}/${total})`;
            }
        } catch (error) {
            console.error('更新按钮文本失败:', error);
        }
    }

    // 处理设置变更
    async handleSettingChange(key, value) {
        this.backgroundSettings[key] = value;
        this.saveSettings();

        // 根据设置变更执行相应操作
        switch (key) {
            case 'enabled':
                if (value) {
                    await this.applyBackgroundSettings();
                } else {
                    this.removeBackground();
                }
                break;

            case 'mode':
                // 模式切换时更新按钮状态
                setTimeout(() => {
                    this.updateButtonStates();
                }, 100);
                if (this.backgroundSettings.enabled) {
                    await this.applyBackgroundSettings();
                }
                break;

            case 'opacity':
                this.updateBackgroundOpacity();
                break;

            case 'switchMode':
            case 'switchInterval':
                if (this.backgroundSettings.enabled && this.backgroundSettings.mode === 'folder') {
                    this.setupSwitchTimer();
                }
                break;
        }

        // 更新按钮状态和文本
        setTimeout(() => {
            this.updateButtonStates();
        }, 50);
    }

    // 选择单张图片
    async selectImage() {
        try {
            const result = await this.context.electronAPI.dialog.showOpenDialog({
                title: '选择背景图片',
                filters: [
                    {name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']}
                ],
                properties: ['openFile']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                this.backgroundSettings.singleImagePath = result.filePaths[0];
                this.saveSettings();

                // 更新按钮状态
                setTimeout(() => {
                    this.updateButtonStates();
                }, 100);

                if (this.backgroundSettings.enabled) {
                    await this.applyBackgroundSettings();
                }

                this.showNotification('背景图片已选择', 'success');
            }
        } catch (error) {
            console.error('选择图片失败:', error);
            this.showNotification(`选择图片失败: ${error.message}`, 'error');
        }
    }

    // 选择文件夹
    async selectFolder() {
        try {
            const result = await this.context.electronAPI.dialog.showOpenDialog({
                title: '选择图片文件夹',
                properties: ['openDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                const folderPath = result.filePaths[0];
                await this.scanImageFolder(folderPath);

                if (this.backgroundSettings.imageList.length > 0) {
                    this.backgroundSettings.folderPath = folderPath;
                    this.backgroundSettings.currentImageIndex = 0;
                    this.saveSettings();

                    // 更新按钮状态
                    setTimeout(() => {
                        this.updateButtonStates();
                    }, 100);

                    if (this.backgroundSettings.enabled) {
                        await this.applyBackgroundSettings();
                    }

                    this.showNotification(`找到 ${this.backgroundSettings.imageList.length} 张图片`, 'success');
                } else {
                    this.showNotification('文件夹中没有找到支持的图片文件', 'warning');
                }
            }
        } catch (error) {
            console.error('选择文件夹失败:', error);
            this.showNotification(`选择文件夹失败: ${error.message}`, 'error');
        }
    }

    // 扫描图片文件夹
    async scanImageFolder(folderPath) {
        try {
            let files;
            try {
                files = await this.safeFileSystemCall('readdir', folderPath);
                files = this.safeAsyncResult(files);
            } catch (apiError) {
                console.error('文件系统API调用失败:', apiError);
                throw new Error(`文件系统API调用失败: ${apiError.message}`);
            }

            const imageFiles = files.filter(file => {
                const ext = this.getFileExtension(file).toLowerCase();
                return this.backgroundSettings.supportedFormats.includes(ext);
            });

            // 构建完整路径
            this.backgroundSettings.imageList = [];
            for (const file of imageFiles) {
                try {
                    let fullPath;
                    if (this.context.electronAPI.path && this.context.electronAPI.path.join) {
                        fullPath = await this.context.electronAPI.path.join(folderPath, file);
                    } else {
                        // 手动拼接路径
                        fullPath = await this.joinPath(folderPath, file);
                    }
                    this.backgroundSettings.imageList.push(fullPath);
                } catch (pathError) {
                    console.warn('路径拼接失败:', pathError);
                    // 使用手动拼接
                    const fullPath = await this.joinPath(folderPath, file);
                    this.backgroundSettings.imageList.push(fullPath);
                }
            }


        } catch (error) {
            console.error('扫描文件夹失败:', error);
            this.backgroundSettings.imageList = [];
            throw error;
        }
    }

    // 手动拼接路径（跨平台兼容）
    async joinPath(dir, file) {
        // 确保目录路径以正确的分隔符结尾
        const separator = await this.context.electronAPI.os.platform() === 'win32' ? '\\' : '/';
        const normalizedDir = dir.endsWith('/') || dir.endsWith('\\') ? dir.slice(0, -1) : dir;
        return normalizedDir + separator + file;
    }

    async validateImageFile(filePath) {
        const pathString = String(filePath || '');
        if (!pathString) {
            return false;
        }

        try {
            if (pathString.startsWith('http://') || pathString.startsWith('https://')) {
                return true;
            }

            try {
                await this.safeFileSystemCall('access', pathString);
                return true;
            } catch (error) {
                return false;
            }
        } catch (error) {
            return true;
        }
    }

    // 清除选择
    clearSelection() {
        if (this.backgroundSettings.mode === 'folder') {
            this.backgroundSettings.folderPath = '';
            this.backgroundSettings.imageList = [];
            this.backgroundSettings.currentImageIndex = 0;
        } else {
            this.backgroundSettings.singleImagePath = '';
        }

        this.saveSettings();
        this.removeBackground();

        // 更新按钮状态
        setTimeout(() => {
            this.updateButtonStates();
        }, 100);

        this.showNotification('背景选择已清除', 'info');
    }

    // 下一张图片
    nextImage() {
        if (this.backgroundSettings.imageList.length === 0) return;

        this.backgroundSettings.currentImageIndex =
            (this.backgroundSettings.currentImageIndex + 1) % this.backgroundSettings.imageList.length;
        this.saveSettings();

        // 更新按钮状态
        setTimeout(() => {
            this.updateButtonStates();
        }, 50);

        if (this.backgroundSettings.enabled) {
            this.applyCurrentBackground();
        }
    }

    // 上一张图片
    prevImage() {
        if (this.backgroundSettings.imageList.length === 0) return;

        this.backgroundSettings.currentImageIndex =
            (this.backgroundSettings.currentImageIndex - 1 + this.backgroundSettings.imageList.length) % this.backgroundSettings.imageList.length;
        this.saveSettings();

        // 更新按钮状态
        setTimeout(() => {
            this.updateButtonStates();
        }, 50);

        if (this.backgroundSettings.enabled) {
            this.applyCurrentBackground();
        }
    }

    // 重置为默认背景
    resetToDefault() {
        this.backgroundSettings = {
            enabled: false,
            mode: 'single',
            singleImagePath: '',
            folderPath: '',
            opacity: 30,
            switchMode: 'random',
            switchInterval: 30,
            supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
            currentImageIndex: 0,
            imageList: []
        };

        this.saveSettings();
        this.removeBackground();
        this.clearSwitchTimer();

        // 更新按钮状态
        setTimeout(() => {
            this.updateButtonStates();
        }, 100);

        this.showNotification('背景设置已重置', 'success');
    }


    initializeBackgroundSystem() {
        this.backgroundElement = document.createElement('div');
        this.backgroundElement.className = 'background-overlay';
        document.body.insertBefore(this.backgroundElement, document.body.firstChild);
        this.isInitialized = true;
    }

    // 应用背景设置
    async applyBackgroundSettings() {
        if (!this.isInitialized) {
            this.initializeBackgroundSystem();
        }

        const currentImage = this.getCurrentImagePath();
        if (!currentImage) {
            return;
        }

        try {
            // 应用背景图片
            await this.applyCurrentBackground();

            // 设置切换定时器（仅文件夹模式）
            if (this.backgroundSettings.mode === 'folder' && this.backgroundSettings.imageList.length > 1) {
                this.setupSwitchTimer();
            }
        } catch (error) {
            this.showNotification('应用背景设置失败', 'error');
        }
    }

    // 应用当前背景
    async applyCurrentBackground() {
        if (!this.backgroundElement) return;

        const currentImage = this.getCurrentImagePath();
        if (!currentImage) return;

        try {
            const imagePath = String(currentImage || '');

            // 验证图片文件是否存在
            const isValid = await this.validateImageFile(imagePath);
            if (!isValid) {
                this.showNotification('背景图片文件无法访问', 'warning');
                return;
            }

            // 正确处理文件路径，确保跨平台兼容性
            const imageUrl = await this.formatImageUrl(imagePath);
            this.backgroundElement.style.backgroundImage = `url("${imageUrl}")`;
            this.updateBackgroundOpacity();
        } catch (error) {
            this.showNotification('应用背景图片失败', 'error');
        }
    }

    async formatImageUrl(filePath) {
        if (!filePath) return '';

        try {
            if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
                return filePath;
            }

            let normalizedPath = filePath;

            if (await this.context.electronAPI.os.platform() === 'win32') {
                normalizedPath = normalizedPath.replace(/\\/g, '/');
                if (!normalizedPath.startsWith('file://')) {
                    normalizedPath = 'file:///' + normalizedPath;
                }
            } else {
                if (!normalizedPath.startsWith('file://')) {
                    normalizedPath = 'file://' + normalizedPath;
                }
            }

            normalizedPath = normalizedPath.replace(/[^a-zA-Z0-9:\/\-_.~]/g, (char) => {
                return encodeURIComponent(char);
            });

            return normalizedPath;
        } catch (error) {
            console.error('格式化图片URL失败:', error);
            return filePath;
        }
    }

    // 更新背景透明度
    updateBackgroundOpacity() {
        if (!this.backgroundElement) return;
        this.backgroundElement.style.opacity = this.backgroundSettings.opacity / 100;
    }

    // 移除背景
    removeBackground() {
        if (this.backgroundElement) {
            this.backgroundElement.style.backgroundImage = '';
            this.backgroundElement.style.opacity = '0';
        }
        this.clearSwitchTimer();
    }

    // 设置切换定时器
    setupSwitchTimer() {
        this.clearSwitchTimer();

        if (this.backgroundSettings.mode !== 'folder' || this.backgroundSettings.imageList.length <= 1) {
            return;
        }

        const interval = this.backgroundSettings.switchInterval * 1000;
        this.switchTimer = setInterval(() => {
            this.switchToNextImage();
        }, interval);

        console.log(`🔄 背景切换定时器已设置: ${this.backgroundSettings.switchInterval}秒`);
    }

    // 清除切换定时器
    clearSwitchTimer() {
        if (this.switchTimer) {
            clearInterval(this.switchTimer);
            this.switchTimer = null;
        }
    }

    // 切换到下一张图片
    switchToNextImage() {
        if (this.backgroundSettings.imageList.length <= 1) return;

        if (this.backgroundSettings.switchMode === 'random') {
            // 随机选择（避免重复当前图片）
            let newIndex;
            do {
                newIndex = Math.floor(Math.random() * this.backgroundSettings.imageList.length);
            } while (newIndex === this.backgroundSettings.currentImageIndex && this.backgroundSettings.imageList.length > 1);

            this.backgroundSettings.currentImageIndex = newIndex;
        } else {
            // 顺序切换
            this.backgroundSettings.currentImageIndex =
                (this.backgroundSettings.currentImageIndex + 1) % this.backgroundSettings.imageList.length;
        }

        this.saveSettings();
        this.applyCurrentBackground();
    }

    // 获取当前图片路径
    getCurrentImagePath() {
        if (this.backgroundSettings.mode === 'single') {
            return this.backgroundSettings.singleImagePath;
        } else {
            if (this.backgroundSettings.imageList.length > 0 &&
                this.backgroundSettings.currentImageIndex < this.backgroundSettings.imageList.length) {
                return this.backgroundSettings.imageList[this.backgroundSettings.currentImageIndex];
            }
        }
        return '';
    }

    // 获取文件名
    getFileName(filePath) {
        if (!filePath) return '';
        return filePath.split(/[/\\]/).pop() || filePath;
    }

    // 获取文件扩展名
    getFileExtension(fileName) {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot !== -1 ? fileName.substring(lastDot) : '';
    }

    // 添加样式
    addStyle(css) {
        try {
            const existingStyle = document.querySelector(`style[data-plugin="${this.metadata.id}"]`);
            if (existingStyle) {
                existingStyle.remove();
            }

            const style = document.createElement('style');
            style.textContent = css;
            style.setAttribute('data-plugin', this.metadata.id);
            style.setAttribute('data-plugin-name', this.metadata.name);

            document.head.appendChild(style);
            return style;
        } catch (error) {
            console.error('样式注入失败:', error);
            return null;
        }
    }

    // 创建元素
    createElement(tag, options = {}) {
        const element = document.createElement(tag);

        if (options.className) element.className = options.className;
        if (options.innerHTML) element.innerHTML = options.innerHTML;
        if (options.textContent) element.textContent = options.textContent;

        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }

        if (options.style) {
            Object.assign(element.style, options.style);
        }

        return element;
    }

    async safeFileSystemCall(operation, ...args) {
        try {
            const safeArgs = args.map(arg => {
                if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
                    return arg;
                } else {
                    return String(arg);
                }
            });

            if (!this.context.electronAPI.fs.fs || !this.context.electronAPI.fs.fs[operation]) {
                throw new Error(`API方法不可用: ${operation}`);
            }

            return await this.context.electronAPI.fs.fs[operation](...safeArgs);
        } catch (error) {
            const errorMessage = error && error.message ? error.message : String(error);
            console.error('文件系统API调用失败:', {
                operation,
                args: args.map(arg => String(arg)),
                error: errorMessage
            });
            throw new Error(`${operation}操作失败: ${errorMessage}`);
        }
    }

    safeAsyncResult(result) {
        try {
            if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean' || result === null || result === undefined) {
                return result;
            }

            if (Array.isArray(result)) {
                return result.map(item => String(item));
            }

            return String(result);
        } catch (error) {
            console.warn('处理异步结果时出错:', error);
            return String(result);
        }
    }
}

window.PluginClass = BackgroundModifyPlugin;
