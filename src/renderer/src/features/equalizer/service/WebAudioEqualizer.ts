export type FrequencyResponsePoint = {
    frequency: number;
    gain: number;
};

class WebAudioEqualizer {
    private readonly audioContext: AudioContext;
    private filters: BiquadFilterNode[];
    public input: GainNode | null;
    public output: GainNode | null;
    private preampNode: GainNode | null;
    private readonly frequencies: number[];
    private readonly presets: Record<string, number[]>;
    private gains: number[];
    private qValues: number[];
    private preampGain: number;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
        this.filters = [];
        this.input = null;
        this.output = null;
        this.preampNode = null;
        this.frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
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
        this.initialize();
    }

    initialize(): void {
        try {
            this.input = this.audioContext.createGain();
            this.output = this.audioContext.createGain();
            this.preampNode = this.audioContext.createGain();
            this.preampNode.gain.value = 1.0;
            this.input.connect(this.preampNode);
            this.createFilterChain();
        } catch (error) {
            console.error('❌ 音频均衡器初始化失败:', error);
            throw error;
        }
    }

    createFilterChain(): void {
        console.log(`🔗 频段数量: ${this.frequencies.length}`);

        let previousNode: AudioNode = this.preampNode!;
        console.log(`🔗 起始节点: preampNode (${!!this.preampNode})`);

        for (let i = 0; i < this.frequencies.length; i++) {
            const filter = this.audioContext.createBiquadFilter();
            if (i === 0) {
                filter.type = 'lowshelf';
            } else if (i === this.frequencies.length - 1) {
                filter.type = 'highshelf';
            } else {
                filter.type = 'peaking';
            }

            filter.frequency.value = this.frequencies[i];
            filter.Q.value = this.qValues[i];
            filter.gain.value = 0;

            try {
                previousNode.connect(filter);
                previousNode = filter;
            } catch (error) {
                console.error(`❌ 滤波器 ${i} 连接失败:`, error);
                throw error;
            }

            this.filters.push(filter);
        }

        try {
            previousNode.connect(this.output!);
            console.log(`✅ 最后一个滤波器连接到输出: filter${this.filters.length - 1} -> output`);
        } catch (error) {
            console.error('❌ 连接到输出失败:', error);
            throw error;
        }

        console.log(`🔗 滤波器链路径: input -> ${this.filters.length}个滤波器 -> output`);
    }

    setBandGain(bandIndex: number, gain: number): void {
        if (bandIndex < 0 || bandIndex >= this.frequencies.length) {
            console.error('❌ 无效的频段索引:', bandIndex, '有效范围: 0-' + (this.frequencies.length - 1));
            return;
        }

        const normalizedGain = Math.max(-12, Math.min(12, gain));
        this.gains[bandIndex] = normalizedGain;
        if (this.filters.length > 0 && this.filters[bandIndex]) {
            this.filters[bandIndex].gain.setValueAtTime(normalizedGain, this.audioContext.currentTime);
        } else {
            console.log(`⚠️ 频段 ${bandIndex} 滤波器不存在（可能处于绕过模式），仅更新增益记录`);
        }
    }

    getBandGain(bandIndex: number): number {
        if (bandIndex < 0 || bandIndex >= this.gains.length) {
            return 0;
        }

        return this.gains[bandIndex];
    }

    setAllGains(gains: number[]): void {
        if (!Array.isArray(gains) || gains.length !== this.frequencies.length) {
            console.error('❌ 无效的增益数组');
            return;
        }

        for (let i = 0; i < gains.length; i++) {
            this.setBandGain(i, gains[i]);
        }
    }

    getAllGains(): number[] {
        return [...this.gains];
    }

    setPreamp(gainDb: number): void {
        this.preampGain = Math.max(-12, Math.min(12, gainDb));
        if (this.preampNode) {
            const linearGain = Math.pow(10, this.preampGain / 20);
            this.preampNode.gain.setValueAtTime(linearGain, this.audioContext.currentTime);
        }
    }

    getPreamp(): number {
        return this.preampGain;
    }

    setBandQ(bandIndex: number, q: number): void {
        if (bandIndex < 0 || bandIndex >= this.frequencies.length) {
            return;
        }

        const normalizedQ = Math.max(0.1, Math.min(10, q));
        this.qValues[bandIndex] = normalizedQ;

        if (this.filters[bandIndex]) {
            this.filters[bandIndex].Q.setValueAtTime(normalizedQ, this.audioContext.currentTime);
        }
    }

    getBandQ(bandIndex: number): number {
        if (bandIndex < 0 || bandIndex >= this.qValues.length) {
            return 1.0;
        }

        return this.qValues[bandIndex];
    }

    getAllQValues(): number[] {
        return [...this.qValues];
    }

    setAllQValues(qValues: number[]): void {
        if (!Array.isArray(qValues) || qValues.length !== this.frequencies.length) {
            return;
        }

        for (let i = 0; i < qValues.length; i++) {
            this.setBandQ(i, qValues[i]);
        }
    }

    getFrequencyResponse(): FrequencyResponsePoint[] {
        const numPoints = 128;
        const response: FrequencyResponsePoint[] = [];
        const minFreq = 20;
        const maxFreq = 20000;
        const frequencies = new Float32Array(numPoints);
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            frequencies[i] = minFreq * Math.pow(maxFreq / minFreq, t);
        }

        const totalMag = new Float32Array(numPoints).fill(1);
        const magResponse = new Float32Array(numPoints);
        const phaseResponse = new Float32Array(numPoints);
        const preampLinear = Math.pow(10, this.preampGain / 20);

        for (const filter of this.filters) {
            filter.getFrequencyResponse(frequencies, magResponse, phaseResponse);
            for (let i = 0; i < numPoints; i++) {
                totalMag[i] *= magResponse[i];
            }
        }

        for (let i = 0; i < numPoints; i++) {
            const gainDb = 20 * Math.log10(totalMag[i] * preampLinear);
            response.push({
                frequency: frequencies[i],
                gain: Number.isFinite(gainDb) ? gainDb : 0
            });
        }

        return response;
    }

    applyPreset(presetName: string): boolean {
        if (!this.presets[presetName]) {
            console.error('❌ 未知的预设:', presetName);
            return false;
        }

        this.setAllGains(this.presets[presetName]);
        return true;
    }

    getPresetNames(): string[] {
        return Object.keys(this.presets);
    }

    reset(): void {
        this.setAllGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        this.setPreamp(0);
        this.setAllQValues([0.707, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.707]);
    }

    disconnect(): void {
        try {
            this.input?.disconnect();
        } catch (error) {
            console.warn('⚠️ 均衡器input节点断开失败:', error);
        }

        try {
            this.output?.disconnect();
        } catch (error) {
            console.warn('⚠️ 均衡器output节点断开失败:', error);
        }

        this.filters.forEach((filter, index) => {
            try {
                filter.disconnect();
            } catch (error) {
                console.warn(`⚠️ 滤波器 ${index} 断开失败:`, error);
            }
        });
    }

    destroy(): void {
        this.disconnect();
        this.filters = [];
        this.input = null;
        this.output = null;
    }
}

export default WebAudioEqualizer;
export {WebAudioEqualizer};
