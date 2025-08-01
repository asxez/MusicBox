/**
 * 桌面歌词管理器
 * 负责桌面歌词窗口的显示、交互和数据同步
 */
class DesktopLyricsManager {
    constructor() {
        this.currentLyrics = [];
        this.currentIndex = -1;
        this.currentPosition = 0;
        this.isPlaying = false;
        this.currentTrack = null;
        
        // 状态变量
        this.isLocked = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };

        // 布局相关状态
        this.currentLayout = 'horizontal'; // 'horizontal' 或 'vertical'
        this.layoutCheckInterval = null;
        this.resizeObserver = null;
        this.isRestoringSize = false; // 标记是否正在恢复尺寸

        // 位置和尺寸记忆相关状态
        this.positionSaveTimer = null;
        this.lastSavedPosition = null;
        this.lastSavedSize = null;
        
        this.elements = {
            container: document.getElementById('lyricsContainer'),
            trackInfo: document.getElementById('trackInfo'),
            currentLyric: document.getElementById('currentLyric'),
            nextLyric: document.getElementById('nextLyric'),
            settingsBtn: document.getElementById('settingsBtn'),
            closeBtn: document.getElementById('closeBtn'),
            lockBtn: document.getElementById('lockBtn'),
            adjustmentPanel: document.getElementById('adjustmentPanel'),
            opacitySlider: document.getElementById('opacitySlider'),
            fontSizeSlider: document.getElementById('fontSizeSlider')
        };

        this.initializeEventListeners();
        this.setupElectronAPI();
        this.loadSettings();
        this.initializePositionMemory();
        this.initializeLayoutDetection();
    }

    initializeEventListeners() {
        // 控制按钮事件
        this.elements.closeBtn.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.desktopLyrics) {
                window.electronAPI.desktopLyrics.hide();
            }
        });

        this.elements.settingsBtn.addEventListener('click', () => {
            this.toggleAdjustmentPanel();
        });

        this.elements.lockBtn.addEventListener('click', () => {
            this.toggleLock();
        });

        // 调整面板滑块事件
        this.elements.opacitySlider.addEventListener('input', async (e) => {
            await this.setOpacity(parseFloat(e.target.value));
        });

        this.elements.fontSizeSlider.addEventListener('input', (e) => {
            this.setFontSize(parseInt(e.target.value));
        });

        // 拖拽功能（仅在未锁定时）
        this.elements.container.addEventListener('mousedown', (e) => {
            if (!this.isLocked && e.target === this.elements.container) {
                this.startDrag(e);
            }
        });

        // 全局鼠标事件
        document.addEventListener('mousemove', async (e) => {
            if (this.isDragging && !this.isLocked) {
                await this.handleDrag(e);
            }
        });

        document.addEventListener('mouseup', () => {
            this.stopDrag();
        });

        // 双击切换主题
        this.elements.container.addEventListener('dblclick', () => {
            this.cycleTheme();
        });

        // 右键菜单
        this.elements.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e);
        });

        // 点击外部关闭调整面板
        document.addEventListener('click', (e) => {
            if (!this.elements.adjustmentPanel.contains(e.target) &&
                !this.elements.settingsBtn.contains(e.target)) {
                this.hideAdjustmentPanel();
            }
        });

        // 窗口关闭时清理资源
        window.addEventListener('beforeunload', () => {
            this.destroyLayoutDetection();
            this.saveCurrentWindowState(); // 关闭前保存最后状态
        });
    }

    setupElectronAPI() {
        if (!window.electronAPI || !window.electronAPI.desktopLyrics) {
            console.warn('Electron API 不可用，使用模拟数据');
            this.setupMockData();
            return;
        }

        // 监听播放状态变化
        window.electronAPI.desktopLyrics.onPlaybackStateChanged((state) => {
            this.handlePlaybackStateChanged(state);
        });

        // 监听歌词更新
        window.electronAPI.desktopLyrics.onLyricsUpdated((lyricsData) => {
            this.handleLyricsUpdated(lyricsData);
        });

        // 监听播放进度变化
        window.electronAPI.desktopLyrics.onPositionChanged((position) => {
            this.handlePositionChanged(position);
        });

        // 监听歌曲变化
        window.electronAPI.desktopLyrics.onTrackChanged((trackInfo) => {
            this.handleTrackChanged(trackInfo);
        });
    }

    setupMockData() {
        // 模拟数据用于开发测试
        setTimeout(() => {
            this.handleTrackChanged({
                title: '测试歌曲',
                artist: '测试艺术家'
            });
            
            this.handleLyricsUpdated([
                { time: 0, content: '这是第一行歌词' },
                { time: 3, content: '这是第二行歌词' },
                { time: 6, content: '这是第三行歌词' },
                { time: 9, content: '这是第四行歌词' }
            ]);
        }, 1000);
    }

    handlePlaybackStateChanged(state) {
        this.isPlaying = state.isPlaying;
        console.log('播放状态变化:', state);
        
        // 根据播放状态添加/移除动画类
        if (this.isPlaying) {
            this.elements.container.classList.add('playing');
        } else {
            this.elements.container.classList.remove('playing');
        }
    }

    handleLyricsUpdated(lyricsData) {
        this.currentLyrics = lyricsData || [];
        this.currentIndex = -1;
        console.log('歌词更新:', this.currentLyrics);
        
        if (this.currentLyrics.length === 0) {
            this.showNoLyrics();
        } else {
            this.updateLyricsDisplay();
        }
    }

    handlePositionChanged(position) {
        this.currentPosition = position;
        this.updateLyricsDisplay();
    }

    handleTrackChanged(trackInfo) {
        this.currentTrack = trackInfo;
        this.updateTrackInfo();
        console.log('歌曲变化:', trackInfo);
    }

    updateTrackInfo() {
        if (this.currentTrack) {
            this.elements.trackInfo.textContent = 
                `${this.currentTrack.title || '未知歌曲'} - ${this.currentTrack.artist || '未知艺术家'}`;
        } else {
            this.elements.trackInfo.textContent = 'MusicBox 桌面歌词';
        }
    }

    updateLyricsDisplay() {
        if (!this.currentLyrics || this.currentLyrics.length === 0) {
            this.showNoLyrics();
            return;
        }

        // 找到当前应该显示的歌词行
        let newIndex = -1;
        for (let i = 0; i < this.currentLyrics.length; i++) {
            if (this.currentPosition >= this.currentLyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }

        // 如果歌词行发生变化，更新显示
        if (newIndex !== this.currentIndex) {
            this.currentIndex = newIndex;
            this.renderCurrentLyrics();
        }
    }

    renderCurrentLyrics() {
        const currentLyric = this.currentIndex >= 0 ? this.currentLyrics[this.currentIndex] : null;
        const nextLyric = this.currentIndex + 1 < this.currentLyrics.length ? 
            this.currentLyrics[this.currentIndex + 1] : null;

        // 更新当前歌词
        if (currentLyric) {
            // 如果歌词内容发生变化，添加动画
            if (this.elements.currentLyric.textContent !== currentLyric.content) {
                this.animateLyricChange(this.elements.currentLyric, currentLyric.content);
            }
            
            // 添加高亮效果
            if (this.isPlaying) {
                this.elements.currentLyric.classList.add('highlight');
            }
        } else {
            this.elements.currentLyric.textContent = '♪';
            this.elements.currentLyric.className = 'current-lyric';
        }

        // 更新下一行歌词
        if (nextLyric) {
            if (this.elements.nextLyric.textContent !== nextLyric.content) {
                this.animateNextLyric(this.elements.nextLyric, nextLyric.content);
            }
            this.elements.nextLyric.style.display = 'block';
        } else {
            this.elements.nextLyric.textContent = '';
            this.elements.nextLyric.style.display = 'none';
        }
    }

    animateLyricChange(element, newContent) {
        // 更流畅的歌词切换动画
        element.style.transition = 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
        element.style.opacity = '0';
        element.style.transform = 'translateY(-20px) scale(0.95)';
        element.style.filter = 'blur(2px)';

        setTimeout(() => {
            element.textContent = newContent;
            element.className = 'current-lyric lyric-enter';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0) scale(1)';
            element.style.filter = 'blur(0)';

            // 添加轻微的弹跳效果
            setTimeout(() => {
                element.style.transform = 'translateY(-2px) scale(1.02)';
                setTimeout(() => {
                    element.style.transform = 'translateY(0) scale(1)';
                }, 150);
            }, 200);
        }, 200);
    }

    animateNextLyric(element, newContent) {
        element.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        element.style.opacity = '0';
        element.style.transform = 'translateX(40px) scale(0.9)';
        element.style.filter = 'blur(1px)';

        setTimeout(() => {
            element.textContent = newContent;
            element.style.opacity = '0.85';
            element.style.transform = 'translateX(0) scale(1)';
            element.style.filter = 'blur(0)';
        }, 150);
    }

    showNoLyrics() {
        this.elements.currentLyric.textContent = '暂无歌词';
        this.elements.currentLyric.className = 'current-lyric no-lyrics';
        this.elements.nextLyric.textContent = '';
        this.elements.nextLyric.style.display = 'none';
    }

    // 交互功能方法
    toggleLock() {
        this.isLocked = !this.isLocked;
        this.elements.lockBtn.textContent = this.isLocked ? '🔓' : '🔒';
        this.elements.lockBtn.title = this.isLocked ? '解锁位置' : '锁定位置';
        this.elements.container.style.cursor = this.isLocked ? 'default' : 'move';

        // 控制body的拖拽区域属性
        if (this.isLocked) {
            document.body.classList.add('locked');
            // 移除边框变色，只改变按钮样式
            this.elements.lockBtn.style.background = 'rgba(255, 193, 7, 0.25)';
            this.elements.lockBtn.style.borderColor = 'rgba(255, 193, 7, 0.4)';
            this.elements.lockBtn.style.boxShadow = '0 0 8px rgba(255, 193, 7, 0.3)';
            this.showStatusToast('位置已锁定', '🔒');
        } else {
            document.body.classList.remove('locked');
            this.elements.lockBtn.style.background = 'rgba(255, 255, 255, 0.12)';
            this.elements.lockBtn.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            this.elements.lockBtn.style.boxShadow = '';
            this.showStatusToast('位置已解锁', '🔓');
        }
    }

    toggleAdjustmentPanel() {
        if (this.elements.adjustmentPanel.classList.contains('show')) {
            this.hideAdjustmentPanel();
        } else {
            this.showAdjustmentPanel();
        }
    }

    showAdjustmentPanel() {
        // 计算最佳位置
        this.calculatePanelPosition();
        this.elements.adjustmentPanel.classList.add('show');
    }

    hideAdjustmentPanel() {
        this.elements.adjustmentPanel.classList.remove('show');
    }

    // 计算调整面板的最佳位置
    calculatePanelPosition() {
        const container = this.elements.container;
        const panel = this.elements.adjustmentPanel;
        const containerRect = container.getBoundingClientRect();

        // 清除之前的位置类
        panel.classList.remove('position-left', 'position-bottom', 'position-center', 'compact');

        const panelWidth = 240; // 默认面板宽度
        const panelHeight = 120; // 估算面板高度
        const margin = 16;

        // 检查是否需要紧凑模式
        if (containerRect.width < 400 || containerRect.height < 200) {
            panel.classList.add('compact');
        }

        // 检查右侧是否有足够空间
        const rightSpace = containerRect.width - 50; // 设置按钮位置
        if (rightSpace < panelWidth + margin) {
            // 右侧空间不足，尝试左侧
            const leftSpace = containerRect.width - 50;
            if (leftSpace >= panelWidth + margin) {
                panel.classList.add('position-left');
            } else {
                // 左右都不够，使用居中
                panel.classList.add('position-center');
            }
        }

        // 检查顶部是否有足够空间
        const topSpace = containerRect.height - 55; // 控制按钮高度
        if (topSpace < panelHeight + margin) {
            // 顶部空间不足，放到底部
            panel.classList.add('position-bottom');
        }

        console.log('🎵 DesktopLyrics: 调整面板位置已计算', {
            containerSize: `${containerRect.width}x${containerRect.height}`,
            rightSpace,
            topSpace,
            classes: Array.from(panel.classList)
        });
    }

    async setOpacity(opacity) {
        window.cacheManager.setLocalCache('desktopLyrics-opacity', opacity);
        
        if (window.electronAPI && window.electronAPI.desktopLyrics) {
            try {
                await window.electronAPI.desktopLyrics.setOpacity(opacity);
            } catch (error) {
                console.error('设置透明度失败:', error);
            }
        }
    }

    setFontSize(fontSize) {
        // 根据当前布局调整字体大小
        if (this.currentLayout === 'vertical') {
            const verticalFontSize = Math.max(20, fontSize - 4);
            this.elements.currentLyric.style.fontSize = verticalFontSize + 'px';
            this.elements.nextLyric.style.fontSize = (verticalFontSize * 0.7) + 'px';
        } else {
            this.elements.currentLyric.style.fontSize = fontSize + 'px';
            this.elements.nextLyric.style.fontSize = (fontSize * 0.64) + 'px';
        }
        window.cacheManager.setLocalCache('desktopLyrics-fontSize', fontSize);
    }

    startDrag(e) {
        // 如果已锁定，不允许拖拽
        if (this.isLocked) {
            return;
        }

        this.isDragging = true;
        this.dragOffset.x = e.screenX;
        this.dragOffset.y = e.screenY;
        this.elements.container.style.cursor = 'grabbing';
        this.elements.container.style.transform = 'scale(1.02)';
        this.elements.container.style.transition = 'transform 0.2s ease';
        e.preventDefault();
    }

    async handleDrag(e) {
        if (!this.isDragging || this.isLocked) return;

        const deltaX = e.screenX - this.dragOffset.x;
        const deltaY = e.screenY - this.dragOffset.y;

        // 添加拖拽阻尼效果
        if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) return;

        if (window.electronAPI && window.electronAPI.desktopLyrics) {
            try {
                const currentPos = await window.electronAPI.desktopLyrics.getPosition();
                if (currentPos.success) {
                    const newX = currentPos.position[0] + deltaX;
                    const newY = currentPos.position[1] + deltaY;
                    await window.electronAPI.desktopLyrics.setPosition(newX, newY);
                    this.dragOffset.x = e.screenX;
                    this.dragOffset.y = e.screenY;
                }
            } catch (error) {
                console.error('移动窗口失败:', error);
            }
        }
    }

    stopDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.elements.container.style.cursor = this.isLocked ? 'default' : 'move';
            this.elements.container.style.transform = 'scale(1)';
            this.elements.container.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';

            // 添加放置反馈
            setTimeout(() => {
                this.elements.container.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.elements.container.style.transform = 'scale(1)';
                }, 100);
            }, 50);

            // 拖拽结束后保存窗口状态
            setTimeout(() => {
                this.saveCurrentWindowState();
            }, 200);
        }
    }

    cycleTheme() {
        const themes = [
            { name: '', displayName: '默认' },
            { name: 'theme-blue', displayName: '蓝色' },
            { name: 'theme-green', displayName: '绿色' },
            { name: 'theme-purple', displayName: '紫色' },
            { name: 'theme-orange', displayName: '橙色' },
            { name: 'theme-pink', displayName: '粉色' },
            { name: 'theme-cyan', displayName: '青色' }
        ];
        
        const currentTheme = this.elements.container.className.split(' ').find(cls => cls.startsWith('theme-'));
        const currentIndex = themes.findIndex(theme => theme.name === (currentTheme || ''));
        const nextIndex = (currentIndex + 1) % themes.length;
        
        // 移除所有主题类
        themes.forEach(theme => {
            if (theme.name) this.elements.container.classList.remove(theme.name);
        });
        
        // 添加新主题类
        if (themes[nextIndex].name) {
            this.elements.container.classList.add(themes[nextIndex].name);
        }
        
        // 显示主题名称
        this.showThemeToast(themes[nextIndex].displayName);
        
        // 保存主题设置
        window.cacheManager.setLocalCache('desktopLyrics-theme', themes[nextIndex].name);
    }

    showThemeToast(themeName) {
        // 创建更精美的主题提示
        const toast = document.createElement('div');
        toast.textContent = `主题: ${themeName}`;
        toast.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.8);
            background: linear-gradient(135deg,
                rgba(15, 15, 25, 0.95) 0%,
                rgba(0, 0, 0, 0.92) 100%);
            color: white;
            padding: 12px 24px;
            border-radius: 30px;
            font-size: 15px;
            font-weight: 500;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
            backdrop-filter: blur(15px) saturate(1.2);
            border: 1px solid rgba(255, 255, 255, 0.25);
            box-shadow:
                0 8px 32px rgba(0, 0, 0, 0.6),
                0 4px 16px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            letter-spacing: 0.5px;
        `;

        this.elements.container.appendChild(toast);

        // 显示动画
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);

        // 隐藏动画
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -50%) scale(0.9)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 400);
        }, 1800);
    }

    async loadSettings() {
        // 加载保存的设置
        const savedOpacity = window.cacheManager.getLocalCache('desktopLyrics-opacity');
        if (savedOpacity) {
            const opacity = parseFloat(savedOpacity);
            this.elements.opacitySlider.value = opacity;
            await this.setOpacity(opacity);
        }
        
        const savedFontSize = window.cacheManager.getLocalCache('desktopLyrics-fontSize');
        if (savedFontSize) {
            const fontSize = parseInt(savedFontSize);
            this.elements.fontSizeSlider.value = fontSize;
            this.setFontSize(fontSize);
        }

        // 加载保存的主题
        const savedTheme = window.cacheManager.getLocalCache('desktopLyrics-theme');
        if (savedTheme) {
            this.elements.container.classList.add(savedTheme);
        }

        // 加载保存的布局偏好
        const savedLayout = window.cacheManager.getLocalCache('desktopLyrics-layout');
        if (savedLayout) {
            console.log('🎵 DesktopLyrics: 上次使用的布局:', savedLayout);
        }
    }

    showStatusToast(message, icon = '') {
        // 创建状态提示
        const toast = document.createElement('div');
        toast.innerHTML = `${icon} ${message}`;
        toast.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 500;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        `;

        this.elements.container.appendChild(toast);

        // 显示动画
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);

        // 隐藏动画
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }

    // 初始化布局检测
    initializeLayoutDetection() {
        // 使用ResizeObserver监听窗口大小变化
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    this.checkAndUpdateLayout(entry.contentRect);
                }
            });
            this.resizeObserver.observe(this.elements.container);
        } else {
            // 降级方案：使用定时器检测
            this.layoutCheckInterval = setInterval(() => {
                this.checkAndUpdateLayout();
            }, 500);
        }

        // 初始布局检测 - 延迟到尺寸恢复完成后
        setTimeout(() => {
            this.checkAndUpdateLayout();
        }, 800); // 确保在尺寸恢复(500ms + 200ms缓冲)之后执行

        console.log('🎵 DesktopLyrics: 布局检测已初始化');
    }

    // 检查并更新布局
    checkAndUpdateLayout(rect = null) {
        if (!this.elements.container) return;

        // 如果正在恢复尺寸，跳过布局检测避免干扰
        if (this.isRestoringSize) {
            console.log('🎵 DesktopLyrics: 正在恢复尺寸，跳过布局检测');
            return;
        }

        const containerRect = rect || this.elements.container.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;

        // 判断应该使用哪种布局
        const shouldUseVertical = height >= width && width > 0 && height > 0;
        const newLayout = shouldUseVertical ? 'vertical' : 'horizontal';

        // 如果布局发生变化，执行切换
        if (newLayout !== this.currentLayout) {
            this.switchLayout(newLayout);
        }

        // 如果调整面板正在显示，重新计算位置
        if (this.elements.adjustmentPanel.classList.contains('show')) {
            this.calculatePanelPosition();
        }
    }

    // 切换布局
    switchLayout(newLayout) {
        const oldLayout = this.currentLayout;
        this.currentLayout = newLayout;

        console.log(`🎵 DesktopLyrics: 布局切换 ${oldLayout} -> ${newLayout}`);

        // 移除旧的布局类
        this.elements.container.classList.remove('horizontal-layout', 'vertical-layout');

        // 添加新的布局类
        this.elements.container.classList.add(`${newLayout}-layout`);

        // 触发布局切换动画
        this.animateLayoutTransition(oldLayout, newLayout);

        // 调整字体大小以适应新布局
        this.adjustFontSizeForLayout(newLayout);

        // 保存布局偏好
        window.cacheManager.setLocalCache('desktopLyrics-lastLayout', newLayout);

        // 显示布局切换提示
        this.showLayoutToast(newLayout);
    }

    // 布局切换动画
    animateLayoutTransition(oldLayout, newLayout) {
        const lyricsContent = this.elements.container.querySelector('.lyrics-content');
        if (!lyricsContent) return;

        // 添加过渡动画类
        lyricsContent.classList.add('layout-transitioning');
        // 短暂延迟后移除动画类
        setTimeout(() => {
            lyricsContent.classList.remove('layout-transitioning');
        }, 500);
    }

    // 根据布局调整字体大小
    adjustFontSizeForLayout(layout) {
        const currentFontSize = parseInt(this.elements.fontSizeSlider.value) || 28;

        if (layout === 'vertical') {
            // 竖向布局使用稍小的字体
            const verticalFontSize = Math.max(20, currentFontSize - 4);
            this.elements.currentLyric.style.fontSize = verticalFontSize + 'px';
            this.elements.nextLyric.style.fontSize = (verticalFontSize * 0.7) + 'px';
        } else {
            // 横向布局使用正常字体大小
            this.elements.currentLyric.style.fontSize = currentFontSize + 'px';
            this.elements.nextLyric.style.fontSize = (currentFontSize * 0.64) + 'px';
        }
    }

    // 显示布局切换提示
    showLayoutToast(layout) {
        const layoutNames = {
            'horizontal': '横向布局',
            'vertical': '竖向布局'
        };

        const layoutIcons = {
            'horizontal': '📱',
            'vertical': '📲'
        };

        this.showStatusToast(
            `${layoutNames[layout]}`,
            layoutIcons[layout]
        );
    }

    // 销毁布局检测
    destroyLayoutDetection() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.layoutCheckInterval) {
            clearInterval(this.layoutCheckInterval);
            this.layoutCheckInterval = null;
        }
    }

    // 初始化位置记忆功能
    initializePositionMemory() {
        // 延迟恢复位置和尺寸，确保窗口已完全初始化
        setTimeout(() => {
            this.restoreWindowState();
        }, 500);
        this.startWindowTracking();
        console.log('🎵 DesktopLyrics: 位置记忆功能已初始化');
    }

    // 开始跟踪窗口位置和尺寸变化
    startWindowTracking() {
        setInterval(() => {
            this.checkAndSaveWindowState();
        }, 2000);
    }

    // 检查并保存窗口位置和尺寸
    async checkAndSaveWindowState() {
        if (!window.electronAPI || !window.electronAPI.desktopLyrics) {
            return;
        }

        try {
            const currentPos = await window.electronAPI.desktopLyrics.getPosition();
            const currentSize = await window.electronAPI.desktopLyrics.getSize();

            if (currentPos.success && currentSize.success) {
                const position = currentPos.position;
                const size = currentSize.size;
                const positionKey = `${position[0]},${position[1]}`;
                const sizeKey = `${size[0]},${size[1]}`;
                
                if (this.lastSavedPosition !== positionKey) {
                    this.saveWindowPosition(position[0], position[1]);
                    this.lastSavedPosition = positionKey;
                }
                if (this.lastSavedSize !== sizeKey) {
                    this.saveWindowSize(size[0], size[1]);
                    this.lastSavedSize = sizeKey;
                }
            }
        } catch (error) {
            console.error('❌ DesktopLyrics: 检查窗口状态失败:', error);
        }
    }

    // 保存窗口位置
    saveWindowPosition(x, y) {
        try {
            const positionData = {
                x: x,
                y: y,
            };
            window.cacheManager.setLocalCache('desktopLyrics-windowPosition', positionData);
            console.log(`🎵 DesktopLyrics: 窗口位置已保存 (${x}, ${y})`);
        } catch (error) {
            console.error('❌ DesktopLyrics: 保存窗口位置失败:', error);
        }
    }

    // 保存窗口尺寸
    saveWindowSize(width, height) {
        try {
            const isVertical = height >= width;
            const sizeData = {
                width: width,
                height: height,
                layout: isVertical ? 'vertical' : 'horizontal' // 记录保存时的布局模式
            };
            window.cacheManager.setLocalCache('desktopLyrics-windowSize', sizeData);
            console.log(`🎵 DesktopLyrics: 窗口尺寸已保存 (${width}x${height}) [${isVertical ? '竖屏' : '横屏'}模式]`);
        } catch (error) {
            console.error('❌ DesktopLyrics: 保存窗口尺寸失败:', error);
        }
    }

    // 恢复窗口位置和尺寸
    async restoreWindowState() {
        if (!window.electronAPI || !window.electronAPI.desktopLyrics) {
            console.warn('⚠️ DesktopLyrics: Electron API 不可用，无法恢复窗口状态');
            return;
        }
        console.log('🎵 DesktopLyrics: 开始恢复窗口状态');

        // 设置恢复状态标记，暂停布局检测
        this.isRestoringSize = true;
        try {
            await this.restoreWindowPosition();
            await this.restoreWindowSize();
            // 等待一段时间确保尺寸设置完成
            await new Promise(resolve => setTimeout(resolve, 200));
        } finally {
            // 恢复完成，重新启用布局检测
            this.isRestoringSize = false;
            console.log('🎵 DesktopLyrics: 窗口状态恢复完成，重新启用布局检测');

            // 立即执行一次布局检测，确保布局正确
            setTimeout(() => {
                this.checkAndUpdateLayout();
            }, 100);
        }
    }

    // 恢复窗口位置
    async restoreWindowPosition() {
        try {
            const savedPosition = window.cacheManager.getLocalCache('desktopLyrics-windowPosition');
            if (!savedPosition) {
                console.log('🎵 DesktopLyrics: 没有保存的窗口位置');
                return;
            }
            
            const { x, y} = savedPosition;
            // 验证位置是否在屏幕范围内
            if (this.isPositionValid(x, y)) {
                await window.electronAPI.desktopLyrics.setPosition(x, y);
                this.lastSavedPosition = `${x},${y}`;
                console.log(`🎵 DesktopLyrics: 窗口位置已恢复 (${x}, ${y})`);
            } else {
                console.log('🎵 DesktopLyrics: 保存的位置无效，使用默认位置');
                window.cacheManager.removeLocalCache('desktopLyrics-windowPosition');
            }
        } catch (error) {
            console.error('❌ DesktopLyrics: 恢复窗口位置失败:', error);
        }
    }

    // 恢复窗口尺寸
    async restoreWindowSize() {
        try {
            const savedSize = window.cacheManager.getLocalCache('desktopLyrics-windowSize');
            if (!savedSize) {
                console.log('🎵 DesktopLyrics: 没有保存的窗口尺寸');
                return;
            }
            const { width, height, layout } = savedSize;
            console.log(`🎵 DesktopLyrics: 发现保存的尺寸 (${width}x${height}) [保存时为${layout || '未知'}模式]`);
            
            // 验证尺寸是否合理
            if (this.isSizeValid(width, height)) {
                console.log(`🎵 DesktopLyrics: 准备恢复窗口尺寸 (${width}x${height})`);

                // 检查是否为竖屏模式
                const isVertical = height >= width;
                console.log(`🎵 DesktopLyrics: 恢复的尺寸为${isVertical ? '竖屏' : '横屏'}模式`);

                await window.electronAPI.desktopLyrics.setSize(width, height);
                this.lastSavedSize = `${width},${height}`;
                console.log(`🎵 DesktopLyrics: 窗口尺寸已恢复 (${width}x${height})`);

                // 验证设置是否成功
                setTimeout(async () => {
                    try {
                        const currentSize = await window.electronAPI.desktopLyrics.getSize();
                        if (currentSize.success) {
                            const [currentWidth, currentHeight] = currentSize.size;
                            console.log(`🎵 DesktopLyrics: 验证当前尺寸 (${currentWidth}x${currentHeight})`);
                        }
                    } catch (error) {
                        console.error('❌ DesktopLyrics: 验证尺寸失败:', error);
                    }
                }, 100);
            } else {
                console.log(`🎵 DesktopLyrics: 保存的尺寸无效 (${width}x${height})，使用默认尺寸`);
                window.cacheManager.removeLocalCache('desktopLyrics-windowSize')
            }
        } catch (error) {
            console.error('❌ DesktopLyrics: 恢复窗口尺寸失败:', error);
        }
    }

    // 验证位置是否有效（在屏幕范围内）
    isPositionValid(x, y) {
        // 基本的边界检查
        if (x < -1000 || x > 10000 || y < -1000 || y > 10000) {
            return false;
        }

        // 检查是否在主屏幕范围内
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;

        // 允许窗口部分超出屏幕边界，但至少要有一部分可见
        return x > -500 && x < screenWidth + 500 && y > -500 && y < screenHeight + 500;
    }

    // 验证尺寸是否有效
    isSizeValid(width, height) {
        // 基本的尺寸检查
        const minWidth = 200;
        const minHeight = 80;
        const maxWidth = 2000;
        const maxHeight = 1500;

        const isValid = width >= minWidth && width <= maxWidth &&
                       height >= minHeight && height <= maxHeight;

        if (!isValid) {
            console.log(`🎵 DesktopLyrics: 尺寸验证失败 (${width}x${height})`, {
                width: { value: width, min: minWidth, max: maxWidth, valid: width >= minWidth && width <= maxWidth },
                height: { value: height, min: minHeight, max: maxHeight, valid: height >= minHeight && height <= maxHeight }
            });
        }

        return isValid;
    }

    // 手动保存当前窗口状态（在拖拽结束时调用）
    async saveCurrentWindowState() {
        if (!window.electronAPI || !window.electronAPI.desktopLyrics) {
            return;
        }

        try {
            // 保存位置
            const currentPos = await window.electronAPI.desktopLyrics.getPosition();
            if (currentPos.success) {
                const [x, y] = currentPos.position;
                this.saveWindowPosition(x, y);
            }

            // 保存尺寸
            const currentSize = await window.electronAPI.desktopLyrics.getSize();
            if (currentSize.success) {
                const [width, height] = currentSize.size;
                this.saveWindowSize(width, height);
            }
        } catch (error) {
            console.error('❌ DesktopLyrics: 保存当前窗口状态失败:', error);
        }
    }

    showContextMenu(event) {
        // TODO: 实现右键菜单
        console.log('显示右键菜单', event);
    }
}

// 初始化桌面歌词管理器
document.addEventListener('DOMContentLoaded', () => {
    window.desktopLyricsManager = new DesktopLyricsManager();
    console.log('桌面歌词管理器已初始化');
});
