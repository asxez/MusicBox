/**
 * 快捷键配置管理器
 * 负责管理局内快捷键和全局快捷键的配置
 */

class ShortcutConfig {
    constructor() {
        this.config = this.loadConfig();
        this.defaultConfig = this.getDefaultConfig();
        this.isCollapsed = true;
        this.loadCollapseState(); // 加载保存的折叠状态
    }

    /**
     * 获取默认快捷键配置
     */
    getDefaultConfig() {
        return {
            // 是否启用全局快捷键
            enableGlobalShortcuts: false,

            // 局内快捷键配置
            localShortcuts: {
                playPause: {
                    id: 'playPause',
                    name: '播放/暂停',
                    description: '切换音乐播放状态',
                    key: 'Space',
                    enabled: true
                },
                previousTrack: {
                    id: 'previousTrack',
                    name: '上一首',
                    description: '播放上一首',
                    key: 'Ctrl+ArrowLeft',
                    enabled: true
                },
                nextTrack: {
                    id: 'nextTrack',
                    name: '下一首',
                    description: '播放下一首',
                    key: 'Ctrl+ArrowRight',
                    enabled: true
                },
                volumeUp: {
                    id: 'volumeUp',
                    name: '音量增加',
                    description: '增加音量 1%',
                    key: 'Ctrl+ArrowUp',
                    enabled: true
                },
                volumeDown: {
                    id: 'volumeDown',
                    name: '音量减少',
                    description: '减少音量 1%',
                    key: 'Ctrl+ArrowDown',
                    enabled: true
                },
                search: {
                    id: 'search',
                    name: '搜索',
                    description: '聚焦到搜索框',
                    key: 'Ctrl+F',
                    enabled: true
                },
                toggleLyrics: {
                    id: 'toggleLyrics',
                    name: '显示/隐藏歌词',
                    description: '切换歌词页面显示状态',
                    key: 'Ctrl+L',
                    enabled: true
                },
                toggleFullscreen: {
                    id: 'toggleFullscreen',
                    name: '全屏切换',
                    description: '切换歌词页面全屏状态',
                    key: 'F11',
                    enabled: true
                },
                exitLyrics: {
                    id: 'exitLyrics',
                    name: '退出歌词页面',
                    description: '关闭歌词页面或退出全屏',
                    key: 'Escape',
                    enabled: true
                },
                seekForward: {
                    id: 'seekForward',
                    name: '快进',
                    description: '快进3秒',
                    key: 'ArrowRight',
                    enabled: true
                },
                seekBackward: {
                    id: 'seekBackward',
                    name: '回退',
                    description: '回退3秒',
                    key: 'ArrowLeft',
                    enabled: true
                }
            },

            // 全局快捷键配置（在局内快捷键基础上加Alt修饰键）
            globalShortcuts: {
                playPause: {
                    id: 'playPause',
                    name: '播放/暂停',
                    description: '全局-切换音乐播放状态',
                    key: 'Alt+Space',
                    enabled: true
                },
                previousTrack: {
                    id: 'previousTrack',
                    name: '上一首',
                    description: '全局-播放上一首',
                    key: 'Alt+Ctrl+ArrowLeft',
                    enabled: true
                },
                nextTrack: {
                    id: 'nextTrack',
                    name: '下一首',
                    description: '全局-播放下一首',
                    key: 'Alt+Ctrl+ArrowRight',
                    enabled: true
                },
                volumeUp: {
                    id: 'volumeUp',
                    name: '音量增加',
                    description: '全局-增加音量 1%',
                    key: 'Alt+Ctrl+ArrowUp',
                    enabled: true
                },
                volumeDown: {
                    id: 'volumeDown',
                    name: '音量减少',
                    description: '全局-减少音量 1%',
                    key: 'Alt+Ctrl+ArrowDown',
                    enabled: true
                },
                toggleLyrics: {
                    id: 'toggleLyrics',
                    name: '显示/隐藏歌词',
                    description: '全局-切换歌词页面显示状态',
                    key: 'Alt+Ctrl+L',
                    enabled: true
                },
                seekForward: {
                    id: 'seekForward',
                    name: '快进',
                    description: '全局-快进3秒',
                    key: 'Alt+ArrowRight',
                    enabled: true
                },
                seekBackward: {
                    id: 'seekBackward',
                    name: '回退',
                    description: '全局-回退3秒',
                    key: 'Alt+ArrowLeft',
                    enabled: true
                }
            }
        };
    }

    loadConfig() {
        try {
            if (!window.cacheManager) {
                console.warn('CacheManager未加载，使用默认快捷键配置');
                return this.getDefaultConfig();
            }

            const saved = window.cacheManager.getLocalCache('musicbox-shortcuts');
            if (saved && typeof saved === 'object') {
                return this.mergeWithDefaults(saved);
            }
        } catch (error) {
            console.warn('加载快捷键配置失败:', error);
        }
        return this.getDefaultConfig();
    }

    /**
     * 将保存的配置与默认配置合并
     */
    mergeWithDefaults(savedConfig) {
        const defaultConfig = this.getDefaultConfig();

        // 深度合并配置
        const merged = {
            enableGlobalShortcuts: savedConfig.enableGlobalShortcuts ?? defaultConfig.enableGlobalShortcuts,
            localShortcuts: {...defaultConfig.localShortcuts},
            globalShortcuts: {...defaultConfig.globalShortcuts}
        };

        // 合并局内快捷键
        if (savedConfig.localShortcuts) {
            Object.keys(defaultConfig.localShortcuts).forEach(key => {
                if (savedConfig.localShortcuts[key]) {
                    merged.localShortcuts[key] = {
                        ...defaultConfig.localShortcuts[key],
                        ...savedConfig.localShortcuts[key]
                    };
                }
            });
        }

        // 合并全局快捷键
        if (savedConfig.globalShortcuts) {
            Object.keys(defaultConfig.globalShortcuts).forEach(key => {
                if (savedConfig.globalShortcuts[key]) {
                    merged.globalShortcuts[key] = {
                        ...defaultConfig.globalShortcuts[key],
                        ...savedConfig.globalShortcuts[key]
                    };
                }
            });
        }

        return merged;
    }

    /**
     * 保存配置到本地存储
     */
    saveConfig() {
        try {
            if (!window.cacheManager) {
                console.error('CacheManager未加载，无法保存快捷键配置');
                return false;
            }

            window.cacheManager.setLocalCache('musicbox-shortcuts', this.config);
            return true;
        } catch (error) {
            console.error('保存快捷键配置失败:', error);
            return false;
        }
    }

    /**
     * 获取当前配置
     */
    getConfig() {
        return this.config;
    }

    reloadConfig() {
        this.config = this.loadConfig();
        return this.config;
    }

    async initializeGlobalShortcuts() {
        if (!window.electronAPI || !window.electronAPI.globalShortcuts) {
            console.warn('全局快捷键API不可用');
            return;
        }

        try {
            await window.electronAPI.globalShortcuts.setEnabled(this.config.enableGlobalShortcuts);

            if (this.config.enableGlobalShortcuts) {
                const globalShortcuts = this.getEnabledGlobalShortcuts();
                await window.electronAPI.globalShortcuts.register(globalShortcuts);
            }

            window.electronAPI.globalShortcuts.onTriggered((_, shortcutId) => {
                this.handleGlobalShortcutTriggered(shortcutId);
            });
        } catch (error) {
            console.error('初始化全局快捷键失败:', error);
        }
    }

    /**
     * 处理全局快捷键触发
     */
    handleGlobalShortcutTriggered(shortcutId) {
        // 触发自定义事件，让应用处理快捷键操作
        const event = new CustomEvent('globalShortcutTriggered', {
            detail: {shortcutId}
        });
        window.dispatchEvent(event);
    }

    /**
     * 更新快捷键配置
     */
    async updateShortcut(type, id, key) {
        if (type === 'local' && this.config.localShortcuts[id]) {
            this.config.localShortcuts[id].key = key;
        } else if (type === 'global' && this.config.globalShortcuts[id]) {
            this.config.globalShortcuts[id].key = key;

            if (this.config.enableGlobalShortcuts && window.electronAPI && window.electronAPI.globalShortcuts) {
                try {
                    const globalShortcuts = this.getEnabledGlobalShortcuts();
                    await window.electronAPI.globalShortcuts.register(globalShortcuts);
                } catch (error) {
                    console.error('更新全局快捷键失败:', error);
                }
            }
        }
        return this.saveConfig();
    }

    /**
     * 启用/禁用全局快捷键
     */
    async setGlobalShortcutsEnabled(enabled) {
        this.config.enableGlobalShortcuts = enabled;

        // 通知主进程更新全局快捷键状态
        if (window.electronAPI && window.electronAPI.globalShortcuts) {
            try {
                await window.electronAPI.globalShortcuts.setEnabled(enabled);

                if (enabled) {
                    // 如果启用，注册当前的全局快捷键
                    const globalShortcuts = this.getEnabledGlobalShortcuts();
                    await window.electronAPI.globalShortcuts.register(globalShortcuts);
                } else {
                    // 如果禁用，取消注册所有全局快捷键
                    await window.electronAPI.globalShortcuts.unregister();
                }

            } catch (error) {
                console.error('设置全局快捷键状态失败:', error);
            }
        }

        return this.saveConfig();
    }

    /**
     * 启用/禁用特定快捷键
     */
    setShortcutEnabled(type, id, enabled) {
        if (type === 'local' && this.config.localShortcuts[id]) {
            this.config.localShortcuts[id].enabled = enabled;
        } else if (type === 'global' && this.config.globalShortcuts[id]) {
            this.config.globalShortcuts[id].enabled = enabled;
        }
        return this.saveConfig();
    }

    /**
     * 重置为默认配置
     */
    resetToDefaults() {
        this.config = this.getDefaultConfig();
        return this.saveConfig();
    }

    /**
     * 检查快捷键冲突
     */
    checkConflicts(_, id, newKey) {
        const conflicts = [];

        // 检查局内快捷键冲突
        Object.entries(this.config.localShortcuts).forEach(([key, shortcut]) => {
            if (key !== id && shortcut.key === newKey && shortcut.enabled) {
                conflicts.push({
                    type: 'local',
                    id: key,
                    name: shortcut.name,
                    key: shortcut.key
                });
            }
        });

        // 检查全局快捷键冲突
        Object.entries(this.config.globalShortcuts).forEach(([key, shortcut]) => {
            if (key !== id && shortcut.key === newKey && shortcut.enabled) {
                conflicts.push({
                    type: 'global',
                    id: key,
                    name: shortcut.name,
                    key: shortcut.key
                });
            }
        });

        return conflicts;
    }

    /**
     * 获取所有启用的局内快捷键
     */
    getEnabledLocalShortcuts() {
        const enabled = {};
        Object.entries(this.config.localShortcuts).forEach(([id, shortcut]) => {
            if (shortcut.enabled) {
                enabled[id] = shortcut;
            }
        });
        return enabled;
    }

    /**
     * 获取所有启用的全局快捷键
     */
    getEnabledGlobalShortcuts() {
        if (!this.config.enableGlobalShortcuts) {
            return {};
        }

        const enabled = {};
        Object.entries(this.config.globalShortcuts).forEach(([id, shortcut]) => {
            if (shortcut.enabled) {
                enabled[id] = shortcut;
            }
        });
        return enabled;
    }

    /**
     * 初始化快捷键配置折叠功能
     */
    initializeCollapsibleShortcuts() {
        const header = document.getElementById('shortcuts-header');
        const container = document.getElementById('shortcuts-container');
        const summary = document.getElementById('shortcuts-summary');
        if (!header || !container || !summary) {
            console.warn('🎹 快捷键折叠元素未找到:', {
                header: !!header,
                container: !!container,
                summary: !!summary
            });
            return;
        }

        // 加载折叠状态
        this.loadCollapseState();

        // 更新快捷键摘要
        this.updateShortcutsSummary();

        // 设置初始状态
        if (this.isCollapsed) {
            container.classList.remove('expanded');
            header.classList.remove('expanded');
        } else {
            container.classList.add('expanded');
            header.classList.add('expanded');
        }

        // 移除之前的事件监听器（如果存在）
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);

        // 绑定点击事件
        newHeader.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleShortcutsCollapse();
        });

        // 强制应用备用样式
        this.forceApplyCollapseStyles();

        // 延迟验证并应用备用方案
        setTimeout(() => {
            const container = document.getElementById('shortcuts-container');
            if (container) {
                const computedStyle = window.getComputedStyle(container);

                // 如果样式不正确，使用内联样式
                if (this.isCollapsed && computedStyle.maxHeight !== '0px') {
                    console.warn('🎹 检测到样式问题，使用内联样式强制折叠');
                    this.forceToggleWithInlineStyles(true);
                } else if (!this.isCollapsed && computedStyle.maxHeight === '0px') {
                    console.warn('🎹 检测到样式问题，使用内联样式强制展开');
                    this.forceToggleWithInlineStyles(false);
                }
            }
        }, 300);
    }

    /**
     * 切换快捷键配置的折叠状态
     */
    toggleShortcutsCollapse() {
        const header = document.getElementById('shortcuts-header');
        const container = document.getElementById('shortcuts-container');
        if (!header || !container) {
            console.warn('🎹 折叠切换失败：元素未找到');
            return;
        }

        this.isCollapsed = !this.isCollapsed;

        // 获取当前计算样式
        const beforeStyle = window.getComputedStyle(container);
        console.log('🎹 切换前计算样式:', {
            maxHeight: beforeStyle.maxHeight,
            opacity: beforeStyle.opacity,
            overflow: beforeStyle.overflow,
            transition: beforeStyle.transition
        });

        // 强制重绘以确保动画正常
        container.style.transition = 'none';
        container.offsetHeight; // 触发重绘
        container.style.transition = '';

        if (this.isCollapsed) {
            // 折叠
            container.classList.remove('expanded');
            header.classList.remove('expanded');

            // 如果CSS类切换不生效，使用内联样式
            setTimeout(() => {
                const afterStyle = window.getComputedStyle(container);
                console.log('🎹 折叠后计算样式:', {
                    maxHeight: afterStyle.maxHeight,
                    opacity: afterStyle.opacity
                });

                if (afterStyle.maxHeight !== '0px') {
                    console.warn('🎹 CSS类切换可能无效，使用内联样式');
                    container.style.maxHeight = '0px';
                    container.style.opacity = '0';
                    container.style.overflow = 'hidden';
                }
            }, 50);
        } else {
            // 展开
            container.classList.add('expanded');
            header.classList.add('expanded');

            // 如果CSS类切换不生效，使用内联样式
            setTimeout(() => {
                const afterStyle = window.getComputedStyle(container);
                console.log('🎹 展开后计算样式:', {
                    maxHeight: afterStyle.maxHeight,
                    opacity: afterStyle.opacity
                });

                if (afterStyle.maxHeight === '0px') {
                    console.warn('🎹 CSS类切换可能无效，使用内联样式');
                    container.style.maxHeight = '3000px';
                    container.style.opacity = '1';
                    container.style.overflow = 'hidden';
                }
            }, 50);
        }
        // 保存折叠状态
        this.saveCollapseState();
    }

    /**
     * 更新快捷键摘要信息
     */
    updateShortcutsSummary() {
        const summary = document.getElementById('shortcuts-summary');
        if (!summary) return;

        const localCount = Object.values(this.config.localShortcuts).filter(s => s.enabled).length;
        const globalCount = this.config.enableGlobalShortcuts ?
            Object.values(this.config.globalShortcuts).filter(s => s.enabled).length : 0;
        const totalCount = localCount + globalCount;

        let summaryText = `已配置 ${totalCount} 个快捷键`;
        if (globalCount > 0) {
            summaryText += ` (${localCount} 个应用内，${globalCount} 个全局)`;
        }

        summary.textContent = summaryText;
    }

    /**
     * 保存折叠状态
     */
    saveCollapseState() {
        window.cacheManager.setLocalCache('shortcuts-collapsed', this.isCollapsed);
    }

    /**
     * 加载折叠状态
     */
    loadCollapseState() {
        const saved = window.cacheManager.getLocalCache('shortcuts-collapsed');
        if (typeof saved === 'boolean') {
            this.isCollapsed = saved;
        }
    }

    /**
     * 刷新快捷键摘要
     */
    refreshSummary() {
        this.updateShortcutsSummary();
    }

    /**
     * 强制应用折叠样式
     */
    forceApplyCollapseStyles() {
        // 注入内联样式确保折叠功能工作
        const styleId = 'shortcuts-collapse-fallback-styles';
        let existingStyle = document.getElementById(styleId);

        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* 快捷键折叠功能备用样式 */
            .collapsible-item .collapsible-header {
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                border-radius: 8px !important;
                padding: 12px !important;
                margin: -12px !important;
                user-select: none !important;
            }

            .collapsible-item .collapsible-header:hover {
                background: rgba(51, 94, 234, 0.1) !important;
            }

            .collapsible-item .collapsible-header .collapse-icon {
                transition: transform 0.3s ease !important;
            }

            .collapsible-item .collapsible-header.expanded .collapse-icon {
                transform: rotate(180deg) !important;
            }

            .collapsible-item .collapsible-content {
                max-height: 0 !important;
                overflow: hidden !important;
                transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease !important;
                opacity: 0 !important;
                margin-top: 16px !important;
            }

            .collapsible-item .collapsible-content.expanded {
                max-height: 3000px !important;
                opacity: 1 !important;
            }

            #shortcuts-container.collapsible-content {
                background: var(--color-surface, #ffffff) !important;
                border: 1px solid var(--color-border, #e5e5e7) !important;
                border-radius: 12px !important;
                padding: 20px !important;
                box-sizing: border-box !important;
            }

            #shortcuts-container.collapsible-content:not(.expanded) {
                padding: 0 !important;
                border: none !important;
                background: transparent !important;
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * 使用内联样式强制折叠/展开
     */
    forceToggleWithInlineStyles(collapse) {
        const container = document.getElementById('shortcuts-container');
        const header = document.getElementById('shortcuts-header');
        if (!container || !header) return;

        if (collapse) {
            // 强制折叠
            container.style.cssText = `
                max-height: 0px !important;
                opacity: 0 !important;
                overflow: hidden !important;
                transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease !important;
                margin-top: 16px !important;
                padding: 0 !important;
                border: none !important;
                background: transparent !important;
            `;
            header.classList.remove('expanded');
        } else {
            // 强制展开
            container.style.cssText = `
                max-height: 3000px !important;
                opacity: 1 !important;
                overflow: hidden !important;
                transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease !important;
                margin-top: 16px !important;
                background: var(--color-surface, #ffffff) !important;
                border: 1px solid var(--color-border, #e5e5e7) !important;
                border-radius: 12px !important;
                padding: 20px !important;
                box-sizing: border-box !important;
            `;
            header.classList.add('expanded');
        }
    }
}

window.shortcutConfig = new ShortcutConfig();
