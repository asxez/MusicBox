import {showToast} from "@utils/index.js";
import type {MusicBoxSettings} from "@api/types/settings";
import {cacheSettingsRenderer} from "./CacheSettingsRenderer";
import {cacheSettingsService} from "./CacheSettingsService";
import {embeddedLyricsDiagnosticsDialogRenderer} from "./EmbeddedLyricsDiagnosticsDialogRenderer";
import {embeddedLyricsDiagnosticsRenderer} from "./EmbeddedLyricsDiagnosticsRenderer";
import {embeddedLyricsDiagnosticsService} from "./EmbeddedLyricsDiagnosticsService";
import {lyricsAppearanceSettingsRenderer} from "./LyricsAppearanceSettingsRenderer";
import {lyricsAppearanceSettingsService} from "./LyricsAppearanceSettingsService";
import {mediaDirectorySettingsRenderer} from "./MediaDirectorySettingsRenderer";
import {mediaDirectorySettingsService} from "./MediaDirectorySettingsService";
import {appConfirmationService} from "@js/features/appShell/service";
import type {SettingValue} from "./SettingsStore";
import type {SettingsListenerScope} from "./SettingsListenerScope";

export interface SettingsToolsElements {
    selectLyricsFolderButton: HTMLElement | null;
    lyricsFolderPath: HTMLElement | null;
    selectCoverCacheFolderButton: HTMLElement | null;
    coverCacheFolderPath: HTMLElement | null;
    viewCacheStatsButton: HTMLButtonElement | null;
    validateCacheButton: HTMLButtonElement | null;
    clearCacheButton: HTMLButtonElement | null;
    cacheStatsDescription: HTMLElement | null;
    testEmbeddedLyricsButton: HTMLButtonElement | null;
    lyricsHighlightOpacitySlider: HTMLInputElement | null;
    lyricsHighlightOpacityValue: HTMLElement | null;
    lyricsHighlightColorInput: HTMLInputElement | null;
    lyricsHighlightColorValue: HTMLElement | null;
}

interface SettingsToolsCallbacks {
    updateSetting: (key: string, value: SettingValue) => void;
    emit: (eventName: string, ...args: unknown[]) => void;
}

class SettingsToolsController {
    initialize(elements: SettingsToolsElements, callbacks: SettingsToolsCallbacks, scope: SettingsListenerScope): void {
        this.bindDirectoryEvents(elements, callbacks, scope);
        this.bindCacheEvents(elements, scope);
        this.bindEmbeddedLyricsDiagnostics(elements, scope);
        this.bindLyricsAppearanceEvents(elements, callbacks, scope);
    }

    initializeLyricsAppearance(settings: MusicBoxSettings, elements: SettingsToolsElements, callbacks: SettingsToolsCallbacks): void {
        const lyricsAppearanceSettings = lyricsAppearanceSettingsService.getSettings(settings);
        lyricsAppearanceSettingsRenderer.initialize(this.toLyricsAppearanceElements(elements), lyricsAppearanceSettings);
        this.applyLyricsHighlightOpacity(lyricsAppearanceSettings.highlightOpacity, callbacks);
        this.applyLyricsHighlightColor(lyricsAppearanceSettings.highlightColor);
    }

    initializeLyricsDirectory(settings: MusicBoxSettings, elements: SettingsToolsElements): void {
        const lyricsDirectory = typeof settings.lyricsDirectory === 'string' ? settings.lyricsDirectory : '';
        mediaDirectorySettingsRenderer.updateDirectory(this.toMediaDirectoryElements(elements), 'lyrics', lyricsDirectory || null);

        if (lyricsDirectory) {
            mediaDirectorySettingsService.applyLyricsDirectory(lyricsDirectory);
        }
    }

    async initializeCoverCacheDirectory(settings: MusicBoxSettings, elements: SettingsToolsElements, callbacks: SettingsToolsCallbacks): Promise<void> {
        try {
            let coverCacheDirectory = typeof settings.coverCacheDirectory === 'string' ? settings.coverCacheDirectory : null;
            const resolved = await mediaDirectorySettingsService.resolveCoverCacheDirectory(coverCacheDirectory);
            coverCacheDirectory = resolved.directory;

            if (resolved.shouldPersist && coverCacheDirectory) {
                callbacks.updateSetting('coverCacheDirectory', coverCacheDirectory);
                console.log(`✅ Settings: 使用默认封面缓存目录: ${coverCacheDirectory}`);
            }

            if (resolved.error) {
                console.error('❌ Settings:', resolved.error);
            }

            this.applyCoverDirectory(elements, coverCacheDirectory);
        } catch (error) {
            console.error('❌ Settings: 初始化封面缓存目录失败:', error);
            this.applyCoverDirectory(elements, null);
        }
    }

    private bindDirectoryEvents(elements: SettingsToolsElements, callbacks: SettingsToolsCallbacks, scope: SettingsListenerScope): void {
        scope.listen(elements.selectLyricsFolderButton, 'click', async () => {
            await this.selectLyricsDirectory(elements, callbacks);
        });

        scope.listen(elements.selectCoverCacheFolderButton, 'click', async () => {
            await this.selectCoverCacheDirectory(elements, callbacks);
        });
    }

    private async selectLyricsDirectory(elements: SettingsToolsElements, callbacks: SettingsToolsCallbacks): Promise<void> {
        try {
            const selectedPath = await mediaDirectorySettingsService.selectDirectory();
            if (!selectedPath) {
                return;
            }

            callbacks.updateSetting('lyricsDirectory', selectedPath);
            mediaDirectorySettingsRenderer.updateDirectory(this.toMediaDirectoryElements(elements), 'lyrics', selectedPath);
            mediaDirectorySettingsService.applyLyricsDirectory(selectedPath);
        } catch (error) {
            console.error('❌ Settings: 选择歌词目录失败:', error);
        }
    }

    private async selectCoverCacheDirectory(elements: SettingsToolsElements, callbacks: SettingsToolsCallbacks): Promise<void> {
        try {
            const selectedPath = await mediaDirectorySettingsService.selectDirectory();
            if (!selectedPath) {
                return;
            }

            callbacks.updateSetting('coverCacheDirectory', selectedPath);
            this.applyCoverDirectory(elements, selectedPath);
        } catch (error) {
            console.error('❌ Settings: 选择封面缓存目录失败:', error);
        }
    }

    private applyCoverDirectory(elements: SettingsToolsElements, directory: string | null): void {
        mediaDirectorySettingsRenderer.updateDirectory(this.toMediaDirectoryElements(elements), 'coverCache', directory);

        if (directory) {
            mediaDirectorySettingsService.applyCoverDirectory(directory);
        }
    }

    private bindCacheEvents(elements: SettingsToolsElements, scope: SettingsListenerScope): void {
        scope.listen(elements.viewCacheStatsButton, 'click', async () => {
            await this.showCacheStatistics(elements);
        });

        scope.listen(elements.validateCacheButton, 'click', async () => {
            await this.validateCache(elements);
        });

        scope.listen(elements.clearCacheButton, 'click', async () => {
            await this.clearCache(elements);
        });
    }

    async showCacheStatistics(elements: SettingsToolsElements): Promise<void> {
        try {
            cacheSettingsRenderer.setStatisticsLoading(this.toCacheSettingsElements(elements), true);
            const display = await cacheSettingsService.getStatisticsDisplay();
            if (display.success) {
                cacheSettingsRenderer.updateDescription(this.toCacheSettingsElements(elements), display.description || '');
                showToast(display.toastMessage || '缓存统计已更新', 'info');
            } else {
                showToast(display.error || '获取缓存统计失败', 'error');
            }
        } catch (error) {
            console.error('❌ 获取缓存统计失败:', error);
            showToast('获取缓存统计失败', 'error');
        } finally {
            cacheSettingsRenderer.setStatisticsLoading(this.toCacheSettingsElements(elements), false);
        }
    }

    private async validateCache(elements: SettingsToolsElements): Promise<void> {
        try {
            cacheSettingsRenderer.setValidationLoading(this.toCacheSettingsElements(elements), true);
            showToast('开始验证缓存，请稍候...', 'info');

            const result = await cacheSettingsService.validateCache();
            showToast(result.message, result.success ? 'success' : 'error');
        } catch (error) {
            console.error('缓存验证失败:', error);
            showToast('缓存验证失败', 'error');
        } finally {
            cacheSettingsRenderer.setValidationLoading(this.toCacheSettingsElements(elements), false);
        }
    }

    private async clearCache(elements: SettingsToolsElements): Promise<void> {
        const confirmed = await appConfirmationService.confirm({
            title: '清空缓存',
            message: '确定要清空所有缓存吗？这将删除所有已缓存的音乐文件信息，下次启动时需要重新扫描。',
            type: 'warning',
            confirmText: '清空'
        });

        if (!confirmed) {
            return;
        }

        try {
            cacheSettingsRenderer.setClearLoading(this.toCacheSettingsElements(elements), true);
            const result = await cacheSettingsService.clearCache();
            showToast(result.message, result.success ? 'success' : 'error');

            if (result.success) {
                cacheSettingsRenderer.updateDescription(this.toCacheSettingsElements(elements), result.description || '');
            }
        } catch (error) {
            console.error('清空缓存失败:', error);
            showToast('清空缓存失败', 'error');
        } finally {
            cacheSettingsRenderer.setClearLoading(this.toCacheSettingsElements(elements), false);
        }
    }

    private bindEmbeddedLyricsDiagnostics(elements: SettingsToolsElements, scope: SettingsListenerScope): void {
        scope.listen(elements.testEmbeddedLyricsButton, 'click', async () => {
            await this.testEmbeddedLyrics(elements);
        });
    }

    private async testEmbeddedLyrics(elements: SettingsToolsElements): Promise<void> {
        try {
            embeddedLyricsDiagnosticsRenderer.setState(this.toEmbeddedLyricsDiagnosticsElements(elements), 'selecting');
            const diagnostics = await embeddedLyricsDiagnosticsService.chooseFileAndBuildReport();
            if (!diagnostics.selected) {
                showToast('未选择文件', 'info');
                return;
            }

            embeddedLyricsDiagnosticsRenderer.setState(this.toEmbeddedLyricsDiagnosticsElements(elements), 'checking');
            console.log(`🎵 测试内嵌歌词: ${diagnostics.filePath}`);
            showToast(diagnostics.foundLyrics ? '检测到内嵌歌词！' : '未检测到内嵌歌词', diagnostics.foundLyrics ? 'success' : 'info');

            const report = diagnostics.report || diagnostics.error || '没有诊断报告';
            console.log('🔧 内嵌歌词测试报告:\n', report);
            embeddedLyricsDiagnosticsDialogRenderer.show(report);
        } catch (error) {
            console.error('❌ 内嵌歌词测试失败:', error);
            showToast('内嵌歌词测试失败', 'error');
        } finally {
            embeddedLyricsDiagnosticsRenderer.setState(this.toEmbeddedLyricsDiagnosticsElements(elements), 'idle');
        }
    }

    private bindLyricsAppearanceEvents(elements: SettingsToolsElements, callbacks: SettingsToolsCallbacks, scope: SettingsListenerScope): void {
        scope.listen(elements.lyricsHighlightOpacitySlider, 'input', () => {
            const value = parseFloat(elements.lyricsHighlightOpacitySlider?.value || '1');
            lyricsAppearanceSettingsRenderer.updateOpacity(this.toLyricsAppearanceElements(elements), value);
            callbacks.updateSetting('lyricsHighlightOpacity', value);
            this.applyLyricsHighlightOpacity(value, callbacks);
        });

        scope.listen(elements.lyricsHighlightColorInput, 'input', () => {
            const color = elements.lyricsHighlightColorInput?.value || '#335eea';
            lyricsAppearanceSettingsRenderer.updateColor(this.toLyricsAppearanceElements(elements), color);
            callbacks.updateSetting('lyricsHighlightColor', color);
            this.applyLyricsHighlightColor(color);
        });
    }

    private applyLyricsHighlightOpacity(opacity: number, callbacks: SettingsToolsCallbacks): void {
        lyricsAppearanceSettingsService.applyHighlightOpacity(opacity);
        callbacks.emit('lyricsHighlightOpacityChanged', opacity);
    }

    private applyLyricsHighlightColor(color: string): void {
        lyricsAppearanceSettingsService.applyHighlightColor(color);
    }

    private toMediaDirectoryElements(elements: SettingsToolsElements) {
        return {
            lyricsFolderPath: elements.lyricsFolderPath,
            coverCacheFolderPath: elements.coverCacheFolderPath
        };
    }

    private toCacheSettingsElements(elements: SettingsToolsElements) {
        return {
            viewCacheStatsButton: elements.viewCacheStatsButton,
            validateCacheButton: elements.validateCacheButton,
            clearCacheButton: elements.clearCacheButton,
            cacheStatsDescription: elements.cacheStatsDescription
        };
    }

    private toEmbeddedLyricsDiagnosticsElements(elements: SettingsToolsElements) {
        return {
            testButton: elements.testEmbeddedLyricsButton
        };
    }

    private toLyricsAppearanceElements(elements: SettingsToolsElements) {
        return {
            highlightOpacitySlider: elements.lyricsHighlightOpacitySlider,
            highlightOpacityValue: elements.lyricsHighlightOpacityValue,
            highlightColorInput: elements.lyricsHighlightColorInput,
            highlightColorValue: elements.lyricsHighlightColorValue
        };
    }
}

export const settingsToolsController = new SettingsToolsController();
