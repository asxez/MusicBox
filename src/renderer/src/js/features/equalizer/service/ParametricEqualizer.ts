/**
 * 参量均衡器封装类
 * 提供对原生参量均衡器的前端接口封装
 */

import {settingsShellService} from "@js/features/appShell/service";
import {mediaController} from "@js/features/media";
import ParametricEqualizerPresets, {
    ParametricFilterType,
    ParametricPreset,
    ParametricRuntimeBand
} from "./ParametricEqualizerPresets";

class ParametricEqualizer {
    private nativeEngine: any;
    private readonly audioEngine: any | null;
    private enabled: boolean;
    private preampGain: number;
    private bands: ParametricBand[];
    private readonly presets: ParametricEqualizerPresets;
    private currentPresetId: string | null;
    private currentPresetIsCustom: boolean;

    constructor(nativeEngine: any, audioEngine: any | null = null) {
        this.nativeEngine = nativeEngine;
        this.audioEngine = audioEngine;
        this.enabled = false;
        this.preampGain = 0;
        this.bands = []; // 本地缓存频段列表
        this.presets = new ParametricEqualizerPresets();
        this.currentPresetId = null; // 当前加载的预设ID
        this.currentPresetIsCustom = false; // 当前预设是否为自定义
    }

    /**
     * 初始化参量均衡器
     */
    async init(): Promise<void> {
        try {
            // 从native获取初始状态
            const enabledResult = await this.nativeEngine.parametricIsEnabled();
            if (enabledResult.success) {
                this.enabled = Boolean(enabledResult.enabled);
            }

            const preampResult = await this.nativeEngine.parametricGetPreamp();
            if (preampResult.success) {
                this.preampGain = Number(preampResult.preamp);
            }

            const bandsResult = await this.nativeEngine.parametricGetBands();
            if (bandsResult.success) {
                this.bands = bandsResult.bands || [];
            }

            console.log('🎚️ 参量均衡器初始化成功');
        } catch (error) {
            console.error('❌ 参量均衡器初始化失败:', error);
        }
    }

    /**
     * 启用/禁用参量均衡器
     */
    async setEnabled(enabled: boolean): Promise<boolean> {
        try {
            if (enabled) {
                const modeResult = await this.setEqualizerMode('parametric');
                if (!modeResult) {
                    console.warn('⚠️ 切换到参量均衡器模式失败');
                }
            }

            const result = await this.nativeEngine.parametricSetEnabled(enabled);
            if (result.success) {
                this.enabled = enabled;
                console.log(`🎚️ 参量均衡器: ${enabled ? '启用' : '禁用'}`);

                if (!enabled) {
                    await this.setEqualizerMode('graphic');
                }
            }
            return result.success;
        } catch (error) {
            console.error('❌ 设置参量均衡器启用状态失败:', error);
            return false;
        }
    }

    /**
     * 检查是否启用
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * 确保均衡器模式正确
     * 如果参量均衡器已启用，确保切换到 parametric 模式
     */
    async ensureCorrectMode(): Promise<void> {
        if (this.enabled) {
            const currentMode = await this.getEqualizerMode();
            if (currentMode !== 'parametric') {
                console.log('🎚️ 参量均衡器已启用，切换到参量模式');
                await this.setEqualizerMode('parametric');
            }
        }
    }

    private async setEqualizerMode(mode: EqualizerMode): Promise<boolean> {
        if (typeof this.nativeEngine?.setEqualizerMode === 'function') {
            const result = await this.nativeEngine.setEqualizerMode(mode);
            return isSuccessResult(result);
        }

        if (typeof this.audioEngine?.setEqualizerMode === 'function') {
            const result = await this.audioEngine.setEqualizerMode(mode);
            return isSuccessResult(result);
        }

        return false;
    }

    private async getEqualizerMode(): Promise<EqualizerMode> {
        if (typeof this.nativeEngine?.getEqualizerMode === 'function') {
            const result = await this.nativeEngine.getEqualizerMode();
            if (result && typeof result === 'object' && 'mode' in result) {
                return result.mode === 'parametric' ? 'parametric' : 'graphic';
            }
            return result === 'parametric' ? 'parametric' : 'graphic';
        }

        if (typeof this.audioEngine?.getEqualizerMode === 'function') {
            const result = await this.audioEngine.getEqualizerMode();
            return result === 'parametric' ? 'parametric' : 'graphic';
        }

        return 'graphic';
    }

    /**
     * 设置前置增益
     */
    async setPreamp(gain: number): Promise<boolean> {
        try {
            const result = await this.nativeEngine.parametricSetPreamp(gain);
            if (result.success) {
                this.preampGain = gain;
            }
            return result.success;
        } catch (error) {
            console.error('❌ 设置参量均衡器前置增益失败:', error);
            return false;
        }
    }

    /**
     * 获取前置增益
     */
    getPreamp(): number {
        return this.preampGain;
    }

    /**
     * 添加频段
     * @param {number} frequency - 频率 (20-20000 Hz)
     * @param {number} gain - 增益 (-20 到 +20 dB)
     * @param {number} q - Q值 (0.1-10.0)
     * @param {string} filterType - 滤波器类型 (peak, lowshelf, highshelf, lowpass, highpass, bandpass, notch)
     * @returns {Promise<number|null>} 频段ID，失败返回null
     */
    async addBand(frequency: number, gain: number, q: number, filterType: ParametricFilterType): Promise<number | null> {
        try {
            const result = await this.nativeEngine.parametricAddBand({
                frequency,
                gain,
                q,
                filterType
            });

            if (result.success && result.bandId !== undefined) {
                // 更新本地缓存
                await this.refreshBands();
                console.log(`🎚️ 参量均衡器: 添加频段 #${result.bandId}`, {frequency, gain, q, filterType});
                return result.bandId;
            }
            return null;
        } catch (error) {
            console.error('❌ 添加参量频段失败:', error);
            return null;
        }
    }

    /**
     * 移除频段
     */
    async removeBand(bandId: number): Promise<boolean> {
        try {
            const result = await this.nativeEngine.parametricRemoveBand(bandId);
            if (result.success) {
                // 更新本地缓存
                await this.refreshBands();
                console.log(`🎚️ 参量均衡器: 移除频段 #${bandId}`);
            }
            return result.success;
        } catch (error) {
            console.error('❌ 移除参量频段失败:', error);
            return false;
        }
    }

    /**
     * 更新频段
     */
    async updateBand(bandId: number, updates: Partial<ParametricBand>): Promise<boolean> {
        try {
            const config = {
                bandId,
                ...updates
            };

            const result = await this.nativeEngine.parametricUpdateBand(config);
            if (result.success) {
                // 更新本地缓存
                await this.refreshBands();
                console.log(`🎚️ 参量均衡器: 更新频段 #${bandId}`, updates);
            }
            return result.success;
        } catch (error) {
            console.error('❌ 更新参量频段失败:', error);
            return false;
        }
    }

    /**
     * 获取所有频段
     */
    getBands(): ParametricBand[] {
        return [...this.bands];
    }

    /**
     * 获取单个频段
     */
    getBand(bandId: number): ParametricBand | undefined {
        return this.bands.find((band) => band.id === bandId);
    }

    /**
     * 刷新频段列表（从native获取最新数据）
     */
    async refreshBands(): Promise<void> {
        try {
            const result = await this.nativeEngine.parametricGetBands();
            if (result.success) {
                this.bands = result.bands || [];
            }
        } catch (error) {
            console.error('❌ 刷新参量频段列表失败:', error);
        }
    }

    /**
     * 重置参量均衡器（将所有频段增益设为0）
     */
    async reset(): Promise<boolean> {
        try {
            const result = await this.nativeEngine.parametricReset();
            if (result.success) {
                await this.refreshBands();
                this.preampGain = 0;
                console.log('🎚️ 参量均衡器: 重置为平坦响应');
            }
            return result.success;
        } catch (error) {
            console.error('❌ 重置参量均衡器失败:', error);
            return false;
        }
    }

    /**
     * 清除所有频段
     */
    async clearBands(): Promise<boolean> {
        try {
            const result = await this.nativeEngine.parametricClearBands();
            if (result.success) {
                this.bands = [];
                console.log('🎚️ 参量均衡器: 清除所有频段');
            }
            return result.success;
        } catch (error) {
            console.error('❌ 清除参量频段失败:', error);
            return false;
        }
    }

    /**
     * 销毁参量均衡器
     */
    destroy(): void {
        this.bands = [];
        this.enabled = false;
        this.preampGain = 0;
        this.nativeEngine = null;
    }

    /**
     * 加载预设
     * @param {string} presetId - 预设ID
     * @param {boolean} isCustom - 是否为自定义预设
     */
    async loadPreset(presetId: string, isCustom = false): Promise<boolean> {
        try {
            const preset = this.presets.getPreset(presetId, isCustom);
            if (!preset) {
                console.error('❌ 预设不存在:', presetId);
                return false;
            }

            console.log('🎚️ 加载预设:', preset.name);

            // 清除当前所有频段
            await this.clearBands();

            // 设置前置增益
            await this.setPreamp(preset.preamp_db);

            // 添加所有频段
            for (const band of preset.bands) {
                await this.addBand(
                    band.freq,
                    band.gain,
                    band.q,
                    band.type
                );
            }

            // 如果预设中有禁用的频段，需要更新
            await this.refreshBands();
            const currentBands = this.getBands();
            for (let i = 0; i < preset.bands.length && i < currentBands.length; i++) {
                if (!preset.bands[i].enabled) {
                    await this.updateBand(currentBands[i].id, {enabled: false});
                }
            }

            this.currentPresetId = presetId;
            this.currentPresetIsCustom = isCustom;

            console.log('✅ 预设加载成功:', preset.name);
            return true;
        } catch (error) {
            console.error('❌ 加载预设失败:', error);
            return false;
        }
    }

    /**
     * 保存当前状态为自定义预设
     * @param {string} name - 预设名称
     * @param {string} description - 预设描述
     */
    async saveAsCustomPreset(name: string, description = ''): Promise<{success: boolean; id?: string; error?: string}> {
        try {
            // 刷新频段确保数据最新
            await this.refreshBands();

            // 创建预设
            const preset = this.presets.createPresetFromState(
                name,
                description,
                this.preampGain,
                this.bands
            );

            // 生成ID（使用时间戳和随机数）
            const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // 添加到自定义预设
            this.presets.addCustomPreset(id, preset);

            // 保存到本地存储
            await this.saveCustomPresets();

            console.log('✅ 保存自定义预设成功:', name);
            return {success: true, id};
        } catch (error) {
            console.error('❌ 保存自定义预设失败:', error);
            return {success: false, error: getErrorMessage(error)};
        }
    }

    /**
     * 删除自定义预设
     */
    async deleteCustomPreset(id: string): Promise<boolean> {
        try {
            this.presets.removeCustomPreset(id);
            await this.saveCustomPresets();
            console.log('✅ 删除自定义预设成功:', id);
            return true;
        } catch (error) {
            console.error('❌ 删除自定义预设失败:', error);
            return false;
        }
    }

    /**
     * 获取所有预设
     */
    getAllPresets(): ReturnType<ParametricEqualizerPresets['getAllPresets']> {
        return this.presets.getAllPresets();
    }

    /**
     * 导出当前设置为JSON文件
     */
    async exportCurrentSettings(name = '我的参量均衡器设置'): Promise<{success: boolean; filePath?: string; cancelled?: boolean; error?: string}> {
        try {
            // 刷新频段确保数据最新
            await this.refreshBands();

            const preset = this.presets.createPresetFromState(
                name,
                '',
                this.preampGain,
                this.bands
            );

            const jsonString = this.presets.exportPreset(preset);

            // 使用文件对话框保存
            const result = await mediaController.saveFile({
                title: '导出参量均衡器设置',
                defaultPath: `${name}.peq.json`,
                filters: [
                    {name: '参量均衡器预设', extensions: ['peq.json', 'json']},
                    {name: '所有文件', extensions: ['*']}
                ]
            });

            if (result.success && result.filePath) {
                await mediaController.writeFile(result.filePath, jsonString);
                console.log('✅ 导出设置成功:', result.filePath);
                return {success: true, filePath: result.filePath};
            }

            return {success: false, cancelled: true};
        } catch (error) {
            console.error('❌ 导出设置失败:', error);
            return {success: false, error: getErrorMessage(error)};
        }
    }

    /**
     * 从JSON文件导入设置
     */
    async importSettings(): Promise<{success: boolean; preset?: ParametricPreset; cancelled?: boolean; error?: string}> {
        try {
            const result = await mediaController.openFile({
                title: '导入参量均衡器设置',
                filters: [
                    {name: '参量均衡器预设', extensions: ['peq.json', 'json']},
                    {name: '所有文件', extensions: ['*']}
                ],
                properties: ['openFile']
            });

            if (result.success && result.filePaths && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                const jsonString = await mediaController.readFile(filePath, 'utf-8');
                if (typeof jsonString !== 'string') {
                    return {success: false, error: '无法读取预设文件内容'};
                }

                const preset = this.presets.importPreset(jsonString);
                if (!preset) {
                    return {success: false, error: '无效的预设文件格式'};
                }

                // 清除当前所有频段
                await this.clearBands();

                // 设置前置增益
                await this.setPreamp(preset.preamp_db);

                // 添加所有频段
                for (const band of preset.bands) {
                    await this.addBand(
                        band.freq,
                        band.gain,
                        band.q,
                        band.type
                    );
                }

                // 如果预设中有禁用的频段，需要更新
                await this.refreshBands();
                const currentBands = this.getBands();
                for (let i = 0; i < preset.bands.length && i < currentBands.length; i++) {
                    if (!preset.bands[i].enabled) {
                        await this.updateBand(currentBands[i].id, {enabled: false});
                    }
                }

                console.log('✅ 导入设置成功:', preset.name);
                return {success: true, preset};
            }

            return {success: false, cancelled: true};
        } catch (error) {
            console.error('❌ 导入设置失败:', error);
            return {success: false, error: getErrorMessage(error)};
        }
    }

    /**
     * 保存自定义预设到本地存储
     */
    async saveCustomPresets(): Promise<void> {
        try {
            const customPresets = this.presets.getCustomPresets();
            await settingsShellService.setSetting('parametric-equalizer.custom-presets', customPresets);
        } catch (error) {
            console.error('❌ 保存自定义预设到本地存储失败:', error);
        }
    }

    /**
     * 从本地存储加载自定义预设
     */
    async loadCustomPresets(): Promise<void> {
        try {
            const customPresets = await settingsShellService.getSetting('parametric-equalizer.custom-presets');
            if (customPresets) {
                this.presets.loadCustomPresets(customPresets);
                console.log('🎚️ 加载自定义预设:', Object.keys(customPresets).length, '个');
            }
        } catch (error) {
            console.error('❌ 从本地存储加载自定义预设失败:', error);
        }
    }

    /**
     * 保存当前状态（用于持久化）
     */
    async saveCurrentState(): Promise<void> {
        try {
            // 刷新频段确保数据最新
            await this.refreshBands();

            const state = {
                enabled: this.enabled,
                preamp: this.preampGain,
                bands: this.bands,
                currentPresetId: this.currentPresetId,
                currentPresetIsCustom: this.currentPresetIsCustom
            };

            await settingsShellService.setSetting('parametric-equalizer.state', state);
            console.log('💾 保存参量均衡器状态');
        } catch (error) {
            console.error('❌ 保存参量均衡器状态失败:', error);
        }
    }

    /**
     * 加载保存的状态（用于恢复）
     */
    async loadSavedState(): Promise<boolean> {
        try {
            const state = await settingsShellService.getSetting<ParametricEqualizerState>('parametric-equalizer.state');
            if (!state) {
                console.log('💡 没有保存的参量均衡器状态');
                return false;
            }

            console.log('🎚️ 恢复参量均衡器状态');

            // 恢复启用状态
            if (state.enabled) {
                await this.setEnabled(true);
            }

            // 恢复前置增益
            await this.setPreamp(state.preamp || 0);

            // 清除当前所有频段
            await this.clearBands();

            // 恢复频段
            if (state.bands && state.bands.length > 0) {
                for (const band of state.bands) {
                    await this.addBand(
                        band.frequency,
                        band.gain,
                        band.q,
                        band.filterType
                    );
                }

                // 更新频段启用状态
                await this.refreshBands();
                const currentBands = this.getBands();
                for (let i = 0; i < state.bands.length && i < currentBands.length; i++) {
                    if (!state.bands[i].enabled) {
                        await this.updateBand(currentBands[i].id, {enabled: false});
                    }
                }
            }

            // 恢复预设信息
            this.currentPresetId = state.currentPresetId || null;
            this.currentPresetIsCustom = state.currentPresetIsCustom || false;

            console.log('✅ 参量均衡器状态恢复成功');
            return true;
        } catch (error) {
            console.error('❌ 加载参量均衡器状态失败:', error);
            return false;
        }
    }

    /**
     * 获取当前预设信息
     */
    getCurrentPresetInfo(): {id: string | null; isCustom: boolean} {
        return {
            id: this.currentPresetId,
            isCustom: this.currentPresetIsCustom
        };
    }
}

interface ParametricBand extends ParametricRuntimeBand {
    id: number;
}

type EqualizerMode = 'graphic' | 'parametric';

interface ParametricEqualizerState {
    enabled?: boolean;
    preamp?: number;
    bands?: ParametricBand[];
    currentPresetId?: string | null;
    currentPresetIsCustom?: boolean;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isSuccessResult(result: unknown): boolean {
    if (result === true) {
        return true;
    }

    if (result && typeof result === 'object' && 'success' in result) {
        return (result as {success?: unknown}).success === true;
    }

    return false;
}

export default ParametricEqualizer;
