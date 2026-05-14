type NativeEqualizerEngine = {
    setEqualizerBandGain?: (bandIndex: number, gain: number) => unknown;
    setEqualizerPreamp?: (gain: number) => unknown;
    setEqualizerBandQ?: (bandIndex: number, q: number) => unknown;
    applyEqualizerPreset?: (presetName: string) => unknown;
    resetEqualizer?: () => unknown;
    getEqualizerFrequencyResponse?: () => Promise<{success?: boolean; response?: unknown[]}>;
};

class WasapiEqualizer {
    private readonly nativeEngine: NativeEqualizerEngine;
    private readonly presets: Record<string, number[]>;
    private gains: number[];
    private qValues: number[];
    private preampGain: number;

    constructor(nativeEngine: NativeEqualizerEngine) {
        this.nativeEngine = nativeEngine;
        this.presets = {
            'flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            'pop': [1, 2, 3, 1, -1, -1, 1, 2, 3, 2],
            'rock': [3, 2, 1, 0, -1, 0, 1, 2, 3, 3],
            'classical': [2, 1, 0, 0, 0, 0, -1, -1, 0, 1],
            'jazz': [2, 1, 0, 1, 2, 1, 0, 1, 2, 2],
            'vocal': [0, -1, -2, -1, 1, 3, 3, 2, 1, 0],
            'bass': [4, 3, 2, 1, 0, -1, -2, -2, -1, 0],
            'treble': [0, -1, -2, -1, 0, 1, 2, 3, 4, 4],
            'electronic': [2, 3, 1, 0, -1, 1, 0, 1, 2, 3],
            'hifi': [1, 0.5, 0, -0.5, 0, 0.5, 1, 1.5, 2, 1.5],
            'studio': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            'live': [2, 1, 0, -1, -1, 0, 1, 2, 3, 2],
            'loudness': [4, 2, 0, -1, -2, -2, -1, 0, 2, 4],
            'cinema': [3, 2, 1, 1, 0, -1, -1, 0, 1, 2],
            'warm': [2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -1, 0],
            'bright': [-1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3]
        };

        this.gains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.qValues = [0.707, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.707];
        this.preampGain = 0;
    }

    setBandGain(bandIndex: number, gain: number): void {
        if (bandIndex < 0 || bandIndex >= 10) {
            return;
        }

        const normalizedGain = Math.max(-12, Math.min(12, gain));
        this.gains[bandIndex] = normalizedGain;
        this.nativeEngine.setEqualizerBandGain?.(bandIndex, normalizedGain);
    }

    getBandGain(bandIndex: number): number {
        if (bandIndex < 0 || bandIndex >= 10) {
            return 0;
        }

        return this.gains[bandIndex];
    }

    setAllGains(gains: number[]): void {
        if (!Array.isArray(gains) || gains.length !== 10) {
            return;
        }

        this.gains = gains.map((gain) => Math.max(-12, Math.min(12, gain)));
        for (let i = 0; i < 10; i++) {
            this.nativeEngine.setEqualizerBandGain?.(i, this.gains[i]);
        }
    }

    getAllGains(): number[] {
        return [...this.gains];
    }

    setPreamp(gainDb: number): void {
        this.preampGain = Math.max(-12, Math.min(12, gainDb));
        this.nativeEngine.setEqualizerPreamp?.(this.preampGain);
    }

    getPreamp(): number {
        return this.preampGain;
    }

    setBandQ(bandIndex: number, q: number): void {
        if (bandIndex < 0 || bandIndex >= 10) {
            return;
        }

        const normalizedQ = Math.max(0.1, Math.min(10, q));
        this.qValues[bandIndex] = normalizedQ;
        this.nativeEngine.setEqualizerBandQ?.(bandIndex, normalizedQ);
    }

    getBandQ(bandIndex: number): number {
        if (bandIndex < 0 || bandIndex >= 10) {
            return 1.0;
        }

        return this.qValues[bandIndex];
    }

    getAllQValues(): number[] {
        return [...this.qValues];
    }

    applyPreset(presetName: string): unknown {
        if (this.presets[presetName]) {
            this.setAllGains(this.presets[presetName]);
            return true;
        }

        return this.nativeEngine.applyEqualizerPreset?.(presetName) || false;
    }

    getPresetNames(): string[] {
        return Object.keys(this.presets);
    }

    reset(): void {
        this.gains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.qValues = [0.707, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.707];
        this.preampGain = 0;
        this.nativeEngine.resetEqualizer?.();
    }

    async getFrequencyResponse(): Promise<unknown[]> {
        try {
            const result = await this.nativeEngine.getEqualizerFrequencyResponse?.();
            if (result?.success && result.response) {
                return result.response;
            }
        } catch (error) {
            console.error('❌ 获取频率响应失败:', error);
        }

        return [];
    }
}

export default WasapiEqualizer;
export {WasapiEqualizer};
