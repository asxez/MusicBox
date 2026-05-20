/**
 * 参量均衡器预设管理器
 * 提供专业的参量均衡器预设和导入/导出功能
 */

export type ParametricFilterType = 'peak' | 'lowshelf' | 'highshelf' | 'lowpass' | 'highpass' | 'bandpass' | 'notch';

export interface ParametricPresetBand {
    type: ParametricFilterType;
    freq: number;
    gain: number;
    q: number;
    enabled: boolean;
}

export interface ParametricPreset {
    name: string;
    description: string;
    preamp_db: number;
    bands: ParametricPresetBand[];
}

export interface ParametricRuntimeBand {
    filterType: ParametricFilterType;
    frequency: number;
    gain: number;
    q: number;
    enabled: boolean;
}

export type ParametricPresetMap = Record<string, ParametricPreset>;

class ParametricEqualizerPresets {
    private readonly builtInPresets: ParametricPresetMap;
    private customPresets: ParametricPresetMap;

    constructor() {
        this.builtInPresets = {
            // ────────────────────────────────────────────────
            // 1. 封神默认预设
            // ────────────────────────────────────────────────
            'asxez-vocal-god': {
                name: '人声贴耳·asxez 终极私藏',
                description: '加载即爆炸！人声直接怼脸，呼吸声都能听清，2025 最强人声音色',
                preamp_db: -6.0,
                bands: [
                    {type: 'highpass', freq: 85, gain: 0, q: 0.71, enabled: true},
                    {type: 'lowshelf', freq: 160, gain: 4.0, q: 0.71, enabled: true},
                    {type: 'peak', freq: 280, gain: 3.0, q: 1.6, enabled: true},
                    {type: 'peak', freq: 3000, gain: -8.0, q: 9.0, enabled: true}, // 暴力去齿音
                    {type: 'peak', freq: 5200, gain: -3.5, q: 7.0, enabled: true},
                    {type: 'peak', freq: 8200, gain: 9.0, q: 4.0, enabled: true}, // 空气感拉满
                    {type: 'peak', freq: 11500, gain: 5.0, q: 3.0, enabled: true},
                    {type: 'highshelf', freq: 10000, gain: 7.0, q: 0.71, enabled: true}
                ]
            },

            // ────────────────────────────────────────────────
            // 2. 中国专属神器
            // ────────────────────────────────────────────────
            '50hz-killer-cn': {
                name: '中国电网哼声终结者',
                description: '一键消灭 50Hz 及其倍频哼声，专治劣质电源/老房子',
                preamp_db: 0,
                bands: [
                    {type: 'notch', freq: 50, gain: -60, q: 30, enabled: true},
                    {type: 'notch', freq: 100, gain: -30, q: 25, enabled: true},
                    {type: 'notch', freq: 150, gain: -24, q: 20, enabled: true},
                    {type: 'notch', freq: 200, gain: -18, q: 18, enabled: true},
                    {type: 'notch', freq: 250, gain: -15, q: 15, enabled: true}
                ]
            },

            // ────────────────────────────────────────────────
            // 3. 科学靶曲线（耳机党狂喜）
            // ────────────────────────────────────────────────
            'harman-ie-2023': {
                name: 'Harman 耳机靶曲线 2023',
                description: '全球公认最悦耳曲线，几乎适配所有入耳/头戴式耳机',
                preamp_db: -5.0,
                bands: [
                    {type: 'lowshelf', freq: 105, gain: 6.5, q: 0.71, enabled: true},
                    {type: 'peak', freq: 180, gain: -2.2, q: 2.0, enabled: true},
                    {type: 'peak', freq: 2800, gain: 5.0, q: 3.0, enabled: true},
                    {type: 'peak', freq: 4800, gain: -3.5, q: 4.0, enabled: true},
                    {type: 'highshelf', freq: 8000, gain: -2.8, q: 0.71, enabled: true}
                ]
            },

            // ────────────────────────────────────────────────
            // 4. 低音炮终极版
            // ────────────────────────────────────────────────
            'ultra-bass-2025': {
                name: '超重低音·震撼人心',
                description: '低频量感+120%，胸口共振，专治没低音的耳机/音箱',
                preamp_db: -7.0,
                bands: [
                    {type: 'lowshelf', freq: 40, gain: 10.0, q: 0.71, enabled: true},
                    {type: 'lowshelf', freq: 85, gain: 8.0, q: 0.71, enabled: true},
                    {type: 'peak', freq: 180, gain: 4.0, q: 1.2, enabled: true},
                    {type: 'peak', freq: 8000, gain: 4.0, q: 2.0, enabled: true},
                    {type: 'highshelf', freq: 10000, gain: 3.0, q: 0.71, enabled: true}
                ]
            },

            // ────────────────────────────────────────────────
            // 5. 高频细节党
            // ────────────────────────────────────────────────
            'crystal-clear': {
                name: '水晶高频·极致解析',
                description: '镲片、弦乐、呼吸声细节拉满，发烧友专用',
                preamp_db: -4.5,
                bands: [
                    {type: 'peak', freq: 4000, gain: 6.0, q: 4.0, enabled: true},
                    {type: 'peak', freq: 8000, gain: 8.0, q: 3.5, enabled: true},
                    {type: 'peak', freq: 12000, gain: 10.0, q: 3.0, enabled: true},
                    {type: 'highshelf', freq: 10000, gain: 8.0, q: 0.71, enabled: true}
                ]
            },

            // ────────────────────────────────────────────────
            // 6. 摇滚现场
            // ────────────────────────────────────────────────
            'rock-concert': {
                name: '摇滚现场·电吉他炸裂',
                description: '吉他失真、鼓点、嘶吼全部拉满',
                preamp_db: -5.0,
                bands: [
                    {type: 'lowshelf', freq: 60, gain: 6.0, q: 0.71, enabled: true},
                    {type: 'peak', freq: 240, gain: 5.0, q: 1.4, enabled: true},
                    {type: 'peak', freq: 800, gain: -3.0, q: 2.0, enabled: true},
                    {type: 'peak', freq: 3000, gain: 6.0, q: 3.0, enabled: true},
                    {type: 'peak', freq: 8000, gain: 7.0, q: 2.5, enabled: true},
                    {type: 'highshelf', freq: 12000, gain: 4.0, q: 0.71, enabled: true}
                ]
            },

            // ────────────────────────────────────────────────
            // 7. 古典大厅
            // ────────────────────────────────────────────────
            'classical-hall': {
                name: '古典大厅·维也纳金色大厅',
                description: '自然空间感，弦乐泛音拉满，录音室监听级',
                preamp_db: -2.0,
                bands: [
                    {type: 'highpass', freq: 40, gain: 0, q: 0.71, enabled: true},
                    {type: 'lowshelf', freq: 120, gain: 2.0, q: 0.71, enabled: true},
                    {type: 'peak', freq: 3000, gain: 3.0, q: 2.0, enabled: true},
                    {type: 'peak', freq: 8000, gain: 4.0, q: 2.5, enabled: true},
                    {type: 'highshelf', freq: 12000, gain: 3.0, q: 0.71, enabled: true}
                ]
            },

            // ────────────────────────────────────────────────
            // 8. 深夜模式
            // ────────────────────────────────────────────────
            'night-mode': {
                name: '深夜护耳·不扰民',
                description: '低频-70%，高频柔化，戴耳机也能小声听',
                preamp_db: -8.0,
                bands: [
                    {type: 'lowshelf', freq: 120, gain: -10.0, q: 0.71, enabled: true},
                    {type: 'peak', freq: 8000, gain: -6.0, q: 2.0, enabled: true},
                    {type: 'highshelf', freq: 8000, gain: -8.0, q: 0.71, enabled: true}
                ]
            },

            // ────────────────────────────────────────────────
            // 9. 播客/有声书终极版
            // ────────────────────────────────────────────────
            'podcast-pro': {
                name: '播客·声音像在耳边说话',
                description: '人声超近，背景噪音全消，疲劳度最低',
                preamp_db: -3.0,
                bands: [
                    {type: 'highpass', freq: 120, gain: 0, q: 0.71, enabled: true},
                    {type: 'peak', freq: 200, gain: -4.0, q: 1.5, enabled: true},
                    {type: 'peak', freq: 1000, gain: 5.0, q: 2.0, enabled: true},
                    {type: 'peak', freq: 3500, gain: 6.0, q: 3.0, enabled: true},
                    {type: 'peak', freq: 8000, gain: -4.0, q: 4.0, enabled: true},
                    {type: 'lowpass', freq: 9000, gain: 0, q: 0.71, enabled: true}
                ]
            },

            // ────────────────────────────────────────────────
            // 10. 温暖胆机味
            // ────────────────────────────────────────────────
            'warm-tube': {
                name: '电子管温暖味',
                description: '老唱片、爵士、女声毒药',
                preamp_db: -2.5,
                bands: [
                    {type: 'lowshelf', freq: 120, gain: 5.0, q: 0.71, enabled: true},
                    {type: 'peak', freq: 480, gain: 4.0, q: 1.2, enabled: true},
                    {type: 'peak', freq: 5000, gain: -4.0, q: 2.0, enabled: true},
                    {type: 'highshelf', freq: 10000, gain: -3.0, q: 0.71, enabled: true}
                ]
            }
        };

        // 用户自定义预设
        this.customPresets = {};
    }

    /**
     * 获取所有预设（内置 + 自定义）
     */
    getAllPresets(): {builtin: ParametricPresetMap; custom: ParametricPresetMap} {
        return {
            builtin: this.builtInPresets,
            custom: this.customPresets
        };
    }

    /**
     * 获取预设
     */
    getPreset(id: string, isCustom = false): ParametricPreset | undefined {
        if (isCustom) {
            return this.customPresets[id];
        }
        return this.builtInPresets[id];
    }

    /**
     * 添加自定义预设
     */
    addCustomPreset(id: string, preset: ParametricPreset): void {
        this.customPresets[id] = preset;
    }

    /**
     * 删除自定义预设
     */
    removeCustomPreset(id: string): void {
        delete this.customPresets[id];
    }

    /**
     * 导出预设为JSON
     */
    exportPreset(preset: ParametricPreset): string {
        return JSON.stringify(preset, null, 2);
    }

    /**
     * 从JSON导入预设
     */
    importPreset(jsonString: string): ParametricPreset | null {
        try {
            const preset = JSON.parse(jsonString) as unknown;

            // 验证预设格式
            if (!this.validatePreset(preset)) {
                throw new Error('预设格式无效');
            }

            return preset;
        } catch (error) {
            console.error('❌ 导入预设失败:', error);
            return null;
        }
    }

    /**
     * 验证预设格式
     */
    validatePreset(preset: unknown): preset is ParametricPreset {
        if (!preset || typeof preset !== 'object') {
            return false;
        }

        const candidate = preset as Partial<ParametricPreset>;

        // 检查必需字段
        if (!candidate.name || typeof candidate.name !== 'string') {
            return false;
        }

        if (candidate.preamp_db === undefined || typeof candidate.preamp_db !== 'number') {
            return false;
        }

        if (!Array.isArray(candidate.bands)) {
            return false;
        }

        // 验证每个频段
        for (const band of candidate.bands) {
            if (!this.validateBand(band)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 验证频段格式
     */
    validateBand(band: unknown): band is ParametricPresetBand {
        if (!band || typeof band !== 'object') {
            return false;
        }

        const candidate = band as Partial<ParametricPresetBand>;
        const validTypes: ParametricFilterType[] = ['peak', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'bandpass', 'notch'];

        if (!candidate.type || !validTypes.includes(candidate.type)) {
            return false;
        }

        if (typeof candidate.freq !== 'number' || candidate.freq < 20 || candidate.freq > 20000) {
            return false;
        }

        if (typeof candidate.gain !== 'number' || candidate.gain < -20 || candidate.gain > 20) {
            return false;
        }

        if (typeof candidate.q !== 'number' || candidate.q < 0.1 || candidate.q > 10) {
            return false;
        }

        if (typeof candidate.enabled !== 'boolean') {
            return false;
        }

        return true;
    }

    /**
     * 从当前均衡器状态创建预设
     */
    createPresetFromState(name: string, description: string, preamp: number, bands: ParametricRuntimeBand[]): ParametricPreset {
        return {
            name,
            description: description || '',
            preamp_db: preamp,
            bands: bands.map((band) => ({
                type: band.filterType,
                freq: band.frequency,
                gain: band.gain,
                q: band.q,
                enabled: band.enabled
            }))
        };
    }

    /**
     * 加载自定义预设
     */
    loadCustomPresets(presets: unknown): void {
        if (presets && typeof presets === 'object') {
            this.customPresets = presets as ParametricPresetMap;
        }
    }

    /**
     * 获取自定义预设
     */
    getCustomPresets(): ParametricPresetMap {
        return this.customPresets;
    }
}

export default ParametricEqualizerPresets;
