/**
 * 桌面歌词管理器
 */

import {cacheManager} from "@services/CacheManager";

class DesktopLyricsManager {
    constructor() {
        this.currentLyrics = [];
        this.currentIndex = -1;
        this.currentPosition = 0;
        this.isPlaying = false;
        this.currentTrack = null;

        this.isLocked = false;
        this.displayMode = 'default';
        this.layoutMode = 'default';
        this.theme = 'blue';

        this.progressInterval = null;

        this.initElements();
        this.initEventListeners();
        this.setupElectronAPI();
        this.loadSettings();
    }

    initElements() {
        this.elements = {
            body: document.body,
            container: document.getElementById('desktopLyrics'),
            lyricsWrapper: document.getElementById('lyricsWrapper'),
            prevLyric: document.getElementById('prevLyric'),
            currentLyric: document.getElementById('currentLyric'),
            nextLyric: document.getElementById('nextLyric'),
            lockBtn: document.getElementById('lockBtn'),
            closeBtn: document.getElementById('closeBtn')
        };
    }

    initEventListeners() {
        this.elements.closeBtn.addEventListener('click', async () => {
            await window.electronAPI?.desktopLyrics?.hide();
        });

        this.elements.lockBtn.addEventListener('click', () => this.toggleLock());
    }

    setupElectronAPI() {
        window.electronAPI.desktopLyrics.onPlaybackStateChanged((state) => {
            this.isPlaying = state.isPlaying;
            if (!this.isPlaying) {
                this.stopProgressUpdate();
            }
        });

        window.electronAPI.desktopLyrics.onLyricsUpdated((lyricsData) => {
            this.currentLyrics = lyricsData || [];
            this.currentIndex = -1;
            this.updateLyrics();
        });

        window.electronAPI.desktopLyrics.onPositionChanged((position) => {
            this.currentPosition = position;
            this.updateLyrics();
        });

        window.electronAPI.desktopLyrics.onSettingsChanged(async (settings) => {
            await this.applySettings(settings);
        });
    }

    updateLyrics() {
        if (!this.currentLyrics || this.currentLyrics.length === 0) {
            this.showNoLyrics();
            return;
        }

        let newIndex = -1;
        for (let i = 0; i < this.currentLyrics.length; i++) {
            if (this.currentPosition >= this.currentLyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }

        if (newIndex !== this.currentIndex) {
            this.currentIndex = newIndex;
            this.renderLyrics();
            this.startProgressUpdate();
        }
    }

    renderLyrics() {
        const prev = this.currentIndex > 0 ? this.currentLyrics[this.currentIndex - 1] : null;
        const current = this.currentIndex >= 0 ? this.currentLyrics[this.currentIndex] : null;
        const next = this.currentIndex + 1 < this.currentLyrics.length ?
            this.currentLyrics[this.currentIndex + 1] : null;

        if (prev) {
            this.elements.prevLyric.textContent = prev.content;
            this.elements.prevLyric.classList.add('lyric-enter');
        } else {
            this.elements.prevLyric.textContent = '';
        }

        if (current) {
            this.renderCurrentLyric(current.content);
            this.elements.currentLyric.classList.add('lyric-enter');
            setTimeout(() => {
                this.elements.currentLyric.classList.remove('lyric-enter');
            }, 600);
        } else {
            this.elements.currentLyric.innerHTML = '<span class="lyric-text">♪</span>';
        }

        if (next) {
            this.elements.nextLyric.textContent = next.content;
            this.elements.nextLyric.classList.add('lyric-enter');
        } else {
            this.elements.nextLyric.textContent = '';
        }
    }

    renderCurrentLyric(text) {
        const chars = text.split('');
        const charElements = chars.map(char => {
            if (char === ' ') {
                return '<span class="lyric-char"> </span>';
            }
            return `<span class="lyric-char">${char}</span>`;
        }).join('');

        this.elements.currentLyric.innerHTML = `<span class="lyric-text">${charElements}</span>`;
    }

    startProgressUpdate() {
        this.stopProgressUpdate();

        if (!this.isPlaying) return;

        const current = this.currentLyrics[this.currentIndex];
        const next = this.currentLyrics[this.currentIndex + 1];

        if (!current || !next) return;

        const duration = (next.time - current.time) * 1000;
        const charElements = this.elements.currentLyric.querySelectorAll('.lyric-char');
        const totalChars = charElements.length;

        if (totalChars === 0) return;

        const timePerChar = duration / totalChars;

        let currentChar = 0;
        const highlightNextChar = () => {
            if (currentChar < totalChars) {
                charElements[currentChar].classList.add('highlight');
                currentChar++;
            }
        };

        highlightNextChar();

        this.progressInterval = setInterval(() => {
            if (currentChar >= totalChars || this.currentIndex !== this.currentLyrics.findIndex(l => l === current)) {
                this.stopProgressUpdate();
                return;
            }
            highlightNextChar();
        }, timePerChar - 100);
    }

    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    showNoLyrics() {
        this.elements.prevLyric.textContent = '';
        this.elements.currentLyric.innerHTML = '<span class="lyric-text">暂无歌词</span>';
        this.elements.nextLyric.textContent = '';
        this.stopProgressUpdate();
    }

    toggleLock() {
        this.isLocked = !this.isLocked;
        this.elements.lockBtn.textContent = this.isLocked ? '🔓' : '🔒';
        this.elements.lockBtn.title = this.isLocked ? '解锁位置' : '锁定位置';

        if (this.isLocked) {
            this.elements.body.classList.add('locked');
            this.elements.lockBtn.classList.add('active');
        } else {
            this.elements.body.classList.remove('locked');
            this.elements.lockBtn.classList.remove('active');
        }

        cacheManager.setLocalCache('desktopLyrics-locked', this.isLocked);
    }

    async applySettings(settings) {
        if (settings.themeColor) {
            this.setThemeColor(settings.themeColor);
        }

        if (settings.displayMode) {
            this.setDisplayMode(settings.displayMode);
        }

        if (settings.layoutMode) {
            this.setLayoutMode(settings.layoutMode);
        }

        if (settings.opacity !== undefined) {
            await this.setOpacity(settings.opacity);
        }

        if (settings.fontSize) {
            this.setFontSize(settings.fontSize);
        }
    }

    setThemeColor(color) {
        this.themeColor = color;

        // 直接设置CSS变量为自定义颜色
        this.elements.container.style.setProperty('--theme-color', color);

        // 计算发光效果的颜色 (使用rgba格式，添加0.5透明度)
        const rgb = this.hexToRgb(color);
        if (rgb) {
            const glowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
            this.elements.container.style.setProperty('--theme-color-glow', glowColor);
        }

        cacheManager.setLocalCache('desktopLyrics-themeColor', color);
    }

    // 辅助方法：将十六进制颜色转换为RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    setTheme(theme) {
        const themes = ['blue', 'purple', 'green', 'orange', 'pink'];
        themes.forEach(t => this.elements.container.classList.remove(`theme-${t}`));

        this.theme = theme;
        this.elements.container.classList.add(`theme-${theme}`);
        cacheManager.setLocalCache('desktopLyrics-theme', theme);
    }

    setDisplayMode(mode) {
        this.displayMode = mode;
        this.elements.container.classList.remove('mode-minimal', 'mode-single');

        if (mode !== 'default') {
            this.elements.container.classList.add(`mode-${mode}`);
        }

        cacheManager.setLocalCache('desktopLyrics-displayMode', mode);
    }

    setLayoutMode(mode) {
        this.layoutMode = mode;
        this.elements.container.classList.remove('mode-center');

        if (mode !== 'default') {
            this.elements.container.classList.add(`mode-${mode}`);
        }

        // 根据布局模式调整窗口尺寸
        this.adjustWindowSizeForMode(mode);
        cacheManager.setLocalCache('desktopLyrics-layoutMode', mode);
    }

    // 根据布局模式调整窗口尺寸
    async adjustWindowSizeForMode(mode) {
        try {
            let width, height;
            switch (mode) {
                case 'center':
                    // 居中模式使用更宽的尺寸,确保歌词能完整显示不换行
                    width = 900;
                    height = 200;
                    break;
                default:
                    // 默认模式使用标准尺寸
                    width = 500;
                    height = 120;
                    break;
            }

            await window.electronAPI.desktopLyrics.setSize(width, height);
            console.log(`✅ 桌面歌词窗口尺寸已调整为 ${mode} 模式: ${width}x${height}`);

            // 如果是居中模式，将窗口移动到屏幕中央
            if (mode === 'center') {
                await window.electronAPI.desktopLyrics.centerOnScreen();
                console.log('✅ 桌面歌词窗口已居中到屏幕');
            }

            // 根据模式设置窗口层级和鼠标事件
            await this.adjustWindowBehaviorForMode(mode);
        } catch (error) {
            console.error('❌ 调整桌面歌词窗口尺寸失败:', error);
        }
    }

    // 根据布局模式调整窗口行为（置顶、鼠标穿透等）
    async adjustWindowBehaviorForMode(mode) {
        if (!window.electronAPI?.desktopLyrics) {
            return;
        }

        try {
            if (mode === 'center') {
                // 居中模式：取消置顶，窗口位于桌面图标下方
                // 设置鼠标事件穿透，使窗口完全不响应鼠标
                await window.electronAPI.desktopLyrics.setAlwaysOnTop(false);
                await window.electronAPI.desktopLyrics.setIgnoreMouseEvents(true);
                console.log('✅ 居中模式：已取消置顶并设置鼠标穿透');
            } else {
                // 其他模式：恢复置顶，取消鼠标穿透
                await window.electronAPI.desktopLyrics.setAlwaysOnTop(true);
                await window.electronAPI.desktopLyrics.setIgnoreMouseEvents(false);
                console.log('✅ 普通模式：已恢复置顶并取消鼠标穿透');
            }
        } catch (error) {
            console.error('❌ 调整桌面歌词窗口行为失败:', error);
        }
    }

    async setOpacity(opacity) {
        cacheManager.setLocalCache('desktopLyrics-opacity', opacity);

        if (window.electronAPI?.desktopLyrics) {
            try {
                await window.electronAPI.desktopLyrics.setOpacity(opacity);
            } catch (error) {
                console.error('设置透明度失败:', error);
            }
        }
    }

    setFontSize(fontSize) {
        this.elements.currentLyric.style.fontSize = fontSize + 'px';
        const smallSize = Math.round(fontSize * 0.57);
        this.elements.prevLyric.style.fontSize = smallSize + 'px';
        this.elements.nextLyric.style.fontSize = smallSize + 'px';

        cacheManager.setLocalCache('desktopLyrics-fontSize', fontSize);
    }

    async loadSettings() {
        const savedLocked = cacheManager.getLocalCache('desktopLyrics-locked');
        if (savedLocked && !this.isLocked) {
            this.toggleLock();
        }

        // 优先加载自定义颜色，如果没有则使用预设主题
        const savedThemeColor = cacheManager.getLocalCache('desktopLyrics-themeColor');
        if (savedThemeColor) {
            this.setThemeColor(savedThemeColor);
        } else {
            const savedTheme = cacheManager.getLocalCache('desktopLyrics-theme');
            if (savedTheme) {
                this.setTheme(savedTheme);
            }
        }

        const savedDisplayMode = cacheManager.getLocalCache('desktopLyrics-displayMode');
        if (savedDisplayMode) {
            this.setDisplayMode(savedDisplayMode);
        }

        const savedLayoutMode = cacheManager.getLocalCache('desktopLyrics-layoutMode');
        if (savedLayoutMode) {
            this.setLayoutMode(savedLayoutMode);
        }

        const savedOpacity = cacheManager.getLocalCache('desktopLyrics-opacity');
        if (savedOpacity) {
            await this.setOpacity(parseFloat(savedOpacity));
        }

        const savedFontSize = cacheManager.getLocalCache('desktopLyrics-fontSize');
        if (savedFontSize) {
            this.setFontSize(parseInt(savedFontSize));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.desktopLyricsManager = new DesktopLyricsManager();
});
