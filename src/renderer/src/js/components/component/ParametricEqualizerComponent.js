/**
 * 参量均衡器UI组件
 */

import {api} from "@api/api";
import {Component} from "@components/base/Component";
import {showInputDialog} from "@js/utils/InputDialog";
import {app} from "@core/app";

class ParametricEqualizerComponent extends Component {
    constructor() {
        super('#parametric-equalizer-modal');
        this.equalizer = null;

        // 滤波器类型定义
        this.filterTypes = [
            {value: 'peak', label: '峰值 (Peak)', description: '提升/衰减特定频率'},
            {value: 'lowshelf', label: '低频搁架 (Low Shelf)', description: '影响低于指定频率的所有频率'},
            {value: 'highshelf', label: '高频搁架 (High Shelf)', description: '影响高于指定频率的所有频率'},
            {value: 'lowpass', label: '低通 (Low Pass)', description: '只允许低于指定频率的信号通过'},
            {value: 'highpass', label: '高通 (High Pass)', description: '只允许高于指定频率的信号通过'},
            {value: 'bandpass', label: '带通 (Band Pass)', description: '只允许特定频率范围通过'},
            {value: 'notch', label: '陷波 (Notch)', description: '去除特定频率噪声'}
        ];

        this.setupElements();
        this.setupEventListeners();
        this.initializeEqualizer();
    }

    async show() {
        if (!this.equalizer) {
            return;
        }

        // 确保均衡器模式正确
        await this.equalizer.ensureCorrectMode();
        await this.refresh();

        this.element.classList.add('active');
    }

    hide() {
        this.element.classList.remove('active');
    }

    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        this.equalizer = null;
    }

    setupElements() {
        this.openBtn = document.querySelector('#open-parametric-equalizer-btn');
        this.closeBtn = this.element.querySelector('#peq-close');
        this.enabledToggleBtn = this.element.querySelector('#peq-enabled');
        this.preampSlider = this.element.querySelector('#peq-preamp');
        this.preampValue = this.element.querySelector('#peq-preamp-value');
        this.addBandBtn = this.element.querySelector('#peq-add-band');
        this.resetBtn = this.element.querySelector('#peq-reset');

        // 预设相关元素
        this.presetSelector = this.element.querySelector('#peq-preset-selector');
        this.savePresetBtn = this.element.querySelector('#peq-save-preset');
        this.importBtn = this.element.querySelector('#peq-import');
        this.exportBtn = this.element.querySelector('#peq-export');
    }

    setupEventListeners() {
        // 开启/关闭
        this.addEventListenerManaged(this.openBtn, 'click', async () => {
            await this.show();
        });
        this.addEventListenerManaged(this.closeBtn, 'click', () => {
            this.hide();
        });

        // 点击遮罩关闭
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.hide();
            }
        });

        // 启用开关
        this.addEventListenerManaged(this.enabledToggleBtn, 'change', async (e) => {
            await this.equalizer.setEnabled(e.target.checked);
            await this.autoSaveState();
        });

        // 前置增益滑块
        this.addEventListenerManaged(this.preampSlider, 'input', async (e) => {
            const gain = parseFloat(e.target.value);
            this.preampValue.textContent = `${gain.toFixed(1)} dB`;
            await this.equalizer.setPreamp(gain);
        });

        this.addEventListenerManaged(this.preampSlider, 'change', async () => {
            await this.autoSaveState();
        });

        // 添加频段按钮
        this.addEventListenerManaged(this.addBandBtn, 'click', async () => {
            await this.addBand();
            await this.autoSaveState();
        });

        // 重置按钮
        this.addEventListenerManaged(this.resetBtn, 'click', async () => {
            await this.equalizer.reset();
            await this.refresh();
            await this.autoSaveState();
        });

        const WASAPIEnable = document.querySelector('#exclusive-mode-toggle');
        this.addEventListenerManaged(WASAPIEnable, 'change', (e) => {
            this.setParametricEqualizerEnable(e.target.checked);
        });

        // 预设选择器
        this.addEventListenerManaged(this.presetSelector, 'change', async (e) => {
            await this.loadPreset(e.target.value);
        });

        // 保存预设按钮
        this.addEventListenerManaged(this.savePresetBtn, 'click', async () => {
            await this.showSavePresetDialog();
        });

        // 导入按钮
        this.addEventListenerManaged(this.importBtn, 'click', async () => {
            await this.importSettings();
        });

        // 导出按钮
        this.addEventListenerManaged(this.exportBtn, 'click', async () => {
            await this.exportSettings();
        });
    }

    // 初始化均衡器
    async initializeEqualizer() {
        const audioEngine = api.audioEngine;
        if (audioEngine?.currentEngine) {
            if (audioEngine.engineType !== 'wasapi') {
                this.equalizer = null;
                this.setParametricEqualizerEnable(false);
                return;
            }

            this.equalizer = audioEngine.currentEngine.getParametricEqualizer();
            if (this.equalizer) {
                this.setParametricEqualizerEnable(true);

                // 加载自定义预设
                await this.equalizer.loadCustomPresets();

                // 填充预设选择器
                await this.populatePresetSelector();

                // 尝试加载上次保存的状态
                const loaded = await this.equalizer.loadSavedState();

                // 如果成功加载了状态，刷新UI
                if (loaded) {
                    console.log('🎚️ 参量均衡器: 已恢复上次状态');
                }

                return;
            }
        }
        // 音频引擎或参量均衡器尚未就绪，稍后重试
        setTimeout(() => this.initializeEqualizer(), 100);
    }

    // 开启/关闭参量均衡器
    setParametricEqualizerEnable(enable) {
        const parametricEqualizerSettings = document.querySelector('#parametric-equalizer-settings');
        if (parametricEqualizerSettings) {
            parametricEqualizerSettings.classList.toggle('disabled', !enable);
        }
    }

    // 刷新
    async refresh() {
        if (!this.equalizer) return;

        // 刷新频段列表
        await this.equalizer.refreshBands();

        // 更新全局控制
        const enabledToggle = this.element.querySelector('#peq-enabled');
        enabledToggle.checked = this.equalizer.isEnabled();

        const preampSlider = this.element.querySelector('#peq-preamp');
        const preampValue = this.element.querySelector('#peq-preamp-value');
        const preamp = this.equalizer.getPreamp();
        preampSlider.value = preamp;
        preampValue.textContent = `${preamp.toFixed(1)} dB`;

        // 更新频段列表
        this.renderBands();
    }

    // 渲染频段列表
    renderBands() {
        const container = this.element.querySelector('#peq-bands-container');
        const bands = this.equalizer.getBands();

        if (bands.length === 0) {
            container.innerHTML = `
                <div class="peq-empty-message">
                    <p>暂无频段</p>
                    <p class="hint">点击"添加频段"按钮来创建新的滤波器</p>
                </div>
            `;
            return;
        }

        container.innerHTML = bands.map(band => this.createBandHTML(band)).join('');

        // 绑定频段事件
        bands.forEach(band => {
            this.bindBandEvents(band.id);
        });
    }

    // 创建频段HTML
    createBandHTML(band) {
        const filterTypeOptions = this.filterTypes.map(ft =>
            `<option value="${ft.value}" ${band.filterType === ft.value ? 'selected' : ''}>${ft.label}</option>`
        ).join('');

        return `
            <div class="peq-band ${band.enabled ? 'band-enabled' : 'band-disabled'}" data-band-id="${band.id}">
                <div class="peq-band-header">
                    <div class="band-title">
                        <span class="band-number">频段 #${band.id}</span>
                        <span class="band-info">${this.formatFrequency(band.frequency)} · ${band.gain >= 0 ? '+' : ''}${band.gain.toFixed(1)} dB</span>
                    </div>
                    <div class="band-header-controls">
                        <div class="toggle-switch">
                            <input type="checkbox" id="band-enabled-${band.id}" class="toggle-input" ${band.enabled ? 'checked' : ''}>
                            <label for="band-enabled-${band.id}" class="toggle-label"></label>
                        </div>
                        <button class="peq-btn-remove" data-band-id="${band.id}" title="删除频段">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="peq-band-controls">
                    <!-- 滤波器类型 -->
                    <div class="peq-band-control peq-control-fullwidth">
                        <label>滤波器类型</label>
                        <select class="band-filter-type" data-band-id="${band.id}">
                            ${filterTypeOptions}
                        </select>
                    </div>

                    <!-- 频率 -->
                    <div class="peq-band-control">
                        <label>频率</label>
                        <div class="control-input-group">
                            <input type="number" class="band-frequency-input" data-band-id="${band.id}"
                                min="20" max="20000" value="${Math.round(band.frequency)}" step="1">
                            <span class="input-unit">Hz</span>
                        </div>
                        <input type="range" class="band-frequency" data-band-id="${band.id}"
                            min="20" max="20000" value="${band.frequency}" step="1">
                    </div>

                    <!-- 增益 -->
                    <div class="peq-band-control">
                        <label>增益</label>
                        <div class="control-input-group">
                            <input type="number" class="band-gain-input" data-band-id="${band.id}"
                                min="-20" max="20" value="${band.gain.toFixed(1)}" step="0.1">
                            <span class="input-unit">dB</span>
                        </div>
                        <input type="range" class="band-gain" data-band-id="${band.id}"
                            min="-20" max="20" value="${band.gain}" step="0.1">
                    </div>

                    <!-- Q值 -->
                    <div class="peq-band-control">
                        <label>Q值（品质因数）</label>
                        <div class="control-input-group">
                            <input type="number" class="band-q-input" data-band-id="${band.id}"
                                min="0.1" max="10" value="${band.q.toFixed(2)}" step="0.01">
                            <span class="input-unit"></span>
                        </div>
                        <input type="range" class="band-q" data-band-id="${band.id}"
                            min="0.1" max="10" value="${band.q}" step="0.01">
                    </div>
                </div>
            </div>
        `;
    }

    // 绑定频段事件
    bindBandEvents(bandId) {
        const bandElement = this.element.querySelector(`.peq-band[data-band-id="${bandId}"]`);
        if (!bandElement) return;

        // 启用开关
        const enabledToggle = bandElement.querySelector(`#band-enabled-${bandId}`);
        enabledToggle.addEventListener('change', async (e) => {
            await this.equalizer.updateBand(bandId, {enabled: e.target.checked});
            bandElement.classList.toggle('band-enabled', e.target.checked);
            bandElement.classList.toggle('band-disabled', !e.target.checked);
            await this.autoSaveState();
        });

        // 删除按钮
        const removeBtn = bandElement.querySelector('.peq-btn-remove');
        removeBtn.addEventListener('click', async () => {
            await this.equalizer.removeBand(bandId);
            this.renderBands();
            await this.autoSaveState();
        });

        // 滤波器类型
        const filterType = bandElement.querySelector('.band-filter-type');
        filterType.addEventListener('change', async (e) => {
            await this.equalizer.updateBand(bandId, {filterType: e.target.value});
            await this.autoSaveState();
        });

        // 频率滑块和输入框
        const freqSlider = bandElement.querySelector('.band-frequency');
        const freqInput = bandElement.querySelector('.band-frequency-input');
        const bandInfo = bandElement.querySelector('.band-info');

        freqSlider.addEventListener('input', (e) => {
            const freq = parseFloat(e.target.value);
            freqInput.value = Math.round(freq);
            this.updateBandInfo(bandElement);
        });

        freqSlider.addEventListener('change', async (e) => {
            const freq = parseFloat(e.target.value);
            await this.equalizer.updateBand(bandId, {frequency: freq});
            await this.autoSaveState();
        });

        freqInput.addEventListener('input', (e) => {
            const freq = parseFloat(e.target.value);
            if (!isNaN(freq) && freq >= 20 && freq <= 20000) {
                freqSlider.value = freq;
                this.updateBandInfo(bandElement);
            }
        });

        freqInput.addEventListener('change', async (e) => {
            const freq = parseFloat(e.target.value);
            if (!isNaN(freq) && freq >= 20 && freq <= 20000) {
                await this.equalizer.updateBand(bandId, {frequency: freq});
                await this.autoSaveState();
            } else {
                // 恢复原值
                freqInput.value = Math.round(freqSlider.value);
            }
        });

        // 增益滑块和输入框
        const gainSlider = bandElement.querySelector('.band-gain');
        const gainInput = bandElement.querySelector('.band-gain-input');

        gainSlider.addEventListener('input', (e) => {
            const gain = parseFloat(e.target.value);
            gainInput.value = gain.toFixed(1);
            this.updateBandInfo(bandElement);
        });

        gainSlider.addEventListener('change', async (e) => {
            const gain = parseFloat(e.target.value);
            await this.equalizer.updateBand(bandId, {gain: gain});
            await this.autoSaveState();
        });

        gainInput.addEventListener('input', (e) => {
            const gain = parseFloat(e.target.value);
            if (!isNaN(gain) && gain >= -20 && gain <= 20) {
                gainSlider.value = gain;
                this.updateBandInfo(bandElement);
            }
        });

        gainInput.addEventListener('change', async (e) => {
            const gain = parseFloat(e.target.value);
            if (!isNaN(gain) && gain >= -20 && gain <= 20) {
                await this.equalizer.updateBand(bandId, {gain: gain});
                await this.autoSaveState();
            } else {
                gainInput.value = parseFloat(gainSlider.value).toFixed(1);
            }
        });

        // Q值滑块和输入框
        const qSlider = bandElement.querySelector('.band-q');
        const qInput = bandElement.querySelector('.band-q-input');

        qSlider.addEventListener('input', (e) => {
            const q = parseFloat(e.target.value);
            qInput.value = q.toFixed(2);
        });

        qSlider.addEventListener('change', async (e) => {
            const q = parseFloat(e.target.value);
            await this.equalizer.updateBand(bandId, {q: q});
            await this.autoSaveState();
        });

        qInput.addEventListener('input', (e) => {
            const q = parseFloat(e.target.value);
            if (!isNaN(q) && q >= 0.1 && q <= 10) {
                qSlider.value = q;
            }
        });

        qInput.addEventListener('change', async (e) => {
            const q = parseFloat(e.target.value);
            if (!isNaN(q) && q >= 0.1 && q <= 10) {
                await this.equalizer.updateBand(bandId, {q: q});
                await this.autoSaveState();
            } else {
                qInput.value = parseFloat(qSlider.value).toFixed(2);
            }
        });
    }

    // 更新频段信息显示
    updateBandInfo(bandElement) {
        const freqSlider = bandElement.querySelector('.band-frequency');
        const gainSlider = bandElement.querySelector('.band-gain');
        const bandInfo = bandElement.querySelector('.band-info');

        const freq = parseFloat(freqSlider.value);
        const gain = parseFloat(gainSlider.value);

        bandInfo.textContent = `${this.formatFrequency(freq)} · ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB`;
    }

    // 添加新频段
    async addBand() {
        // 默认参数
        const bandId = await this.equalizer.addBand(1000, 0, 1.0, 'peak');
        if (bandId !== null) {
            this.renderBands();
        }
    }

    // 格式化频率显示
    formatFrequency(freq) {
        if (freq >= 1000) {
            return `${(freq / 1000).toFixed(1)} kHz`;
        }
        return `${Math.round(freq)} Hz`;
    }

    // 填充预设选择器
    async populatePresetSelector() {
        if (!this.equalizer) return;

        const allPresets = this.equalizer.getAllPresets();
        const {builtin, custom} = allPresets;

        // 清空选择器
        this.presetSelector.innerHTML = '<option value="">选择预设...</option>';

        // 添加内置预设组
        if (Object.keys(builtin).length > 0) {
            const builtinGroup = document.createElement('optgroup');
            builtinGroup.label = '内置预设';

            for (const [id, preset] of Object.entries(builtin)) {
                const option = document.createElement('option');
                option.value = `builtin:${id}`;
                option.textContent = preset.name;
                option.title = preset.description || '';
                builtinGroup.appendChild(option);
            }

            this.presetSelector.appendChild(builtinGroup);
        }

        // 添加自定义预设组
        if (Object.keys(custom).length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = '自定义预设';

            for (const [id, preset] of Object.entries(custom)) {
                const option = document.createElement('option');
                option.value = `custom:${id}`;
                option.textContent = preset.name;
                option.title = preset.description || '';
                customGroup.appendChild(option);
            }

            this.presetSelector.appendChild(customGroup);
        }
    }

    // 加载预设
    async loadPreset(value) {
        if (!this.equalizer || !value) return;

        const [type, id] = value.split(':');
        const isCustom = type === 'custom';

        const success = await this.equalizer.loadPreset(id, isCustom);
        if (success) {
            await this.refresh();
            await this.equalizer.saveCurrentState(); // 保存状态
        } else {
            console.error('❌ 预设加载失败');
            this.presetSelector.value = '';
        }
    }

    // 显示保存预设对话框
    async showSavePresetDialog() {
        if (!this.equalizer) return;

        const name = await showInputDialog('请输入预设名称:', '我的自定义预设', '保存预设');
        if (!name || name.trim() === '') {
            return;
        }

        const description = await showInputDialog('请输入预设描述（可选）:', '', '预设描述');
        const result = await this.equalizer.saveAsCustomPreset(name.trim(), description?.trim() || '');

        if (result.success) {
            // 重新填充预设选择器
            await this.populatePresetSelector();

            // 选中新保存的预设
            this.presetSelector.value = `custom:${result.id}`;
            app.showSuccess('预设保存成功！');
        } else {
            console.error('❌ 保存自定义预设失败:', result.error);
            app.showError('保存预设失败');
        }
    }

    // 导入设置
    async importSettings() {
        if (!this.equalizer) return;

        const result = await this.equalizer.importSettings();
        if (result.success && result.preset) {
            await this.refresh();
            await this.equalizer.saveCurrentState(); // 保存状态
            app.showSuccess('导入成功');

            // 重置预设选择器
            this.presetSelector.value = '';
        } else if (result.error) {
            console.error('❌ 导入设置失败:', result.error);
            app.showError('导入失败');
        }
    }

    // 导出设置
    async exportSettings() {
        if (!this.equalizer) return;

        const name = await showInputDialog('请输入导出文件名称:', '我的参量均衡器设置', '导出设置');
        if (!name || name.trim() === '') {
            return;
        }

        const result = await this.equalizer.exportCurrentSettings(name.trim());
        if (result.success && result.filePath) {
            app.showSuccess('导出成功！');
        } else if (result.error) {
            console.error('❌ 导出设置失败:', result.error);
            app.showError('导出失败');
        }
    }

    // 自动保存当前状态
    async autoSaveState() {
        if (!this.equalizer) return;

        // 使用防抖，避免频繁保存
        if (this.saveStateTimeout) {
            clearTimeout(this.saveStateTimeout);
        }

        this.saveStateTimeout = setTimeout(async () => {
            await this.equalizer.saveCurrentState();
        }, 500);
    }
}

export default ParametricEqualizerComponent;
