/**
 * 均衡器组件
 */

import {cacheManager} from "@js/shared/cache";
import {appInteractionService} from "@js/features/appShell/service";
import {Component} from "@ui/base/Component";
import {equalizerController} from "@js/features/equalizer";

interface EqualizerFrequencyPoint {
    frequency: number;
    gain: number;
}

interface EqualizerBridge {
    setBandGain(bandIndex: number, gain: number): void;
    getAllGains(): number[];
    setAllGains(gains: number[]): void;
    setPreamp?(gain: number): void;
    getPreamp?(): number;
    applyPreset(presetName: string): boolean | unknown;
    reset(): void;
    getFrequencyResponse?(): EqualizerFrequencyPoint[] | Promise<EqualizerFrequencyPoint[]>;
}

interface EqualizerSettings {
    enabled?: boolean;
    preset?: string;
    gains?: number[];
    lastModified?: number;
}

interface CustomEqualizerPreset {
    name: string;
    gains: number[];
    createdAt: string;
}

type CustomEqualizerPresets = Record<string, CustomEqualizerPreset>;

interface EqualizerWindow extends Window {
    equalizerComponent?: EqualizerComponent;
}

class EqualizerComponent extends Component {
    private equalizer: EqualizerBridge | null;
    private isEnabled: boolean;
    private currentPreset: string;
    private modal!: HTMLElement;
    private closeBtn!: HTMLElement;
    private openBtn!: HTMLElement;
    private equalizerToggle!: HTMLInputElement;
    private equalizerSettings!: HTMLElement;
    private curveCanvas!: HTMLCanvasElement | null;
    private curveCtx!: CanvasRenderingContext2D | null;
    private preampSlider!: HTMLInputElement;
    private preampValue!: HTMLElement;
    private presetSelect!: HTMLSelectElement;
    private managePresetsBtn!: HTMLElement;
    private customPresetsPanel!: HTMLElement;
    private closePresetsPanelBtn!: HTMLElement;
    private newPresetNameInput!: HTMLInputElement;
    private savePresetBtn!: HTMLButtonElement;
    private customPresetsList!: HTMLElement;
    private bandSliders!: HTMLInputElement[];
    private bandValues!: HTMLElement[];
    private resetBtn!: HTMLElement;
    private applyBtn!: HTMLElement;
    private curveAnimationFrame: number | null;
    private saveTimeout: ReturnType<typeof setTimeout> | null;

    constructor() {
        super('#equalizer-modal');
        this.equalizer = null;
        this.isEnabled = false;
        this.currentPreset = 'flat';
        this.curveAnimationFrame = null;
        this.saveTimeout = null;
        this.setupElements();
        this.setupEventListeners();
        this.initializeEqualizer().then(() => {});
        // 设置全局引用，供HTML中的onclick事件使用
        (window as EqualizerWindow).equalizerComponent = this;
    }

    async show(): Promise<void> {
        await this.refreshEqualizerReference();
        this.modal.style.display = 'flex';
        requestAnimationFrame(() => {
            this.modal.classList.add('show');
        });
        this.updateUI();
    }

    hide(): void {
        this.modal.classList.remove('show');
        setTimeout(() => {
            this.modal.style.display = 'none';
        }, 300);
        this.saveSettings();
    }

    destroy(): void {
        this.saveSettings();
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.curveAnimationFrame) {
            cancelAnimationFrame(this.curveAnimationFrame);
            this.curveAnimationFrame = null;
        }
        super.destroy();
    }

    setupElements(): void {
        // 弹窗控制
        this.modal = this.requireElement(this.element, '#equalizer-modal');
        this.closeBtn = this.queryElement('#equalizer-close');
        this.openBtn = queryDocumentElement('#open-equalizer-btn');

        // 均衡器开关
        this.equalizerToggle = queryDocumentElement<HTMLInputElement>('#equalizer-toggle');
        this.equalizerSettings = queryDocumentElement('#equalizer-settings');

        // EQ曲线画布
        this.curveCanvas = this.queryElement<HTMLCanvasElement>('#equalizer-curve-canvas');
        this.curveCtx = this.curveCanvas ? this.curveCanvas.getContext('2d') : null;

        // 前置增益控制
        this.preampSlider = this.queryElement<HTMLInputElement>('#preamp-slider');
        this.preampValue = this.queryElement('#preamp-value');

        // 预设选择器
        this.presetSelect = this.queryElement<HTMLSelectElement>('#equalizer-preset-select');
        this.managePresetsBtn = this.queryElement('#manage-presets-btn');

        // 自定义预设管理
        this.customPresetsPanel = this.queryElement('#custom-presets-panel');
        this.closePresetsPanelBtn = this.queryElement('#close-presets-panel');
        this.newPresetNameInput = this.queryElement<HTMLInputElement>('#new-preset-name');
        this.savePresetBtn = this.queryElement<HTMLButtonElement>('#save-preset-btn');
        this.customPresetsList = this.queryElement('#custom-presets-list');

        // 频段滑块
        this.bandSliders = [];
        this.bandValues = [];
        for (let i = 0; i < 10; i++) {
            this.bandSliders[i] = this.queryElement<HTMLInputElement>(`#band-${i}`);
            this.bandValues[i] = this.queryElement(`#band-value-${i}`);
            // console.log(`🎛️ 频段 ${i} - 滑块:`, this.bandSliders[i], '数值:', this.bandValues[i]);
        }

        // 控制按钮
        this.resetBtn = this.queryElement('#equalizer-reset');
        this.applyBtn = this.queryElement('#equalizer-apply');

        // 曲线绘制动画帧ID
        this.curveAnimationFrame = null;
    }

    setupEventListeners(): void {
        this.addEventListenerManaged(this.openBtn, 'click', () => {
            this.show();
        });
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.modal, 'click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        this.addEventListenerManaged(this.equalizerToggle, 'change', (e) => {
            const target = e.currentTarget as HTMLInputElement;
            this.setEnabled(target.checked);
        });

        // 前置增益控制
        if (this.preampSlider) {
            this.addEventListenerManaged(this.preampSlider, 'input', (e) => {
                const target = e.currentTarget as HTMLInputElement;
                this.updatePreamp(parseFloat(target.value));
            });
        }

        // 预设选择
        this.addEventListenerManaged(this.presetSelect, 'change', async (e) => {
            const target = e.currentTarget as HTMLSelectElement;
            await this.applyPreset(target.value);
        });

        // 自定义预设管理
        this.addEventListenerManaged(this.managePresetsBtn, 'click', () => {
            this.toggleCustomPresetsPanel();
        });

        this.addEventListenerManaged(this.closePresetsPanelBtn, 'click', () => {
            this.hideCustomPresetsPanel();
        });

        this.addEventListenerManaged(this.savePresetBtn, 'click', async () => {
            await this.saveCustomPreset();
        });

        this.addEventListenerManaged(this.newPresetNameInput, 'input', () => {
            this.updateSaveButtonState();
        });

        this.addEventListenerManaged(this.newPresetNameInput, 'keypress', async (e) => {
            if ((e as KeyboardEvent).key === 'Enter') {
                await this.saveCustomPreset();
            }
        });

        // 频段滑块
        this.bandSliders.forEach((slider, index) => {
            if (slider) {
                this.addEventListenerManaged(slider, 'input', (e) => {
                    const target = e.currentTarget as HTMLInputElement;
                    this.updateBandGain(index, parseFloat(target.value));
                });
            }
        });

        // 控制按钮
        this.addEventListenerManaged(this.resetBtn, 'click', () => this.reset());
        this.addEventListenerManaged(this.applyBtn, 'click', () => this.hide());

        this.addEventListenerManaged(document, 'keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Escape' && this.isVisible()) {
                this.hide();
            }
        });
    }

    async initializeEqualizer(): Promise<void> {
        // 等待API初始化
        const equalizer = equalizerController.getEqualizer<EqualizerBridge>();
        if (equalizer) {
            this.equalizer = equalizer;
            if (cacheManager) {
                this.reloadConfig();
            } else {
                this.loadSettings();
                this.updatePresetSelect();
            }
        } else {
            setTimeout(() => this.initializeEqualizer(), 100);
        }
    }

    async refreshEqualizerReference(): Promise<boolean> {
        const latestEqualizer = equalizerController.getEqualizer<EqualizerBridge>();
        if (!latestEqualizer) {
            return false;
        }

        if (latestEqualizer !== this.equalizer) {
            this.equalizer = latestEqualizer;
            this.loadSettings();
        }

        return true;
    }

    isVisible(): boolean {
        return this.modal.classList.contains('show');
    }

    async setEnabled(enabled: boolean): Promise<void> {
        await this.refreshEqualizerReference();
        // console.log(`🎛️ 设置均衡器状态: ${enabled} (当前状态: ${this.isEnabled})`);

        // 防止重复设置相同状态
        if (this.isEnabled === enabled) {
            // console.log(`ℹ️ 均衡器状态已经是 ${enabled}，跳过设置`);
            return;
        }

        this.isEnabled = enabled;

        // 更新音频引擎
        equalizerController.setEqualizerEnabled(enabled);
        // console.log(`🎛️ 音频引擎均衡器状态已更新: ${enabled}`);

        // 更新UI状态（避免触发change事件）
        this.updateUIState(enabled);

        // 立即保存设置到缓存
        this.saveSettingsImmediate();
    }

    // 更新UI状态，避免触发事件
    updateUIState(enabled: boolean): void {
        // 临时移除事件监听器，避免递归调用
        if (this.equalizerToggle) {
            const oldHandler = this.equalizerToggle.onchange;
            this.equalizerToggle.onchange = null;
            this.equalizerToggle.checked = enabled;
            this.equalizerToggle.onchange = oldHandler;
        }

        if (this.equalizerSettings) {
            this.equalizerSettings.classList.toggle('disabled', !enabled);
        }
    }

    // 应用预设
    async applyPreset(presetName: string): Promise<void> {
        await this.refreshEqualizerReference();
        if (!this.equalizer) return;

        // 检查是否是自定义预设
        if (presetName.startsWith('custom:')) {
            const customPresetName = presetName.substring(7); // 移除 'custom:' 前缀
            this.loadCustomPreset(customPresetName);
            return;
        }

        // 应用内置预设
        if (this.equalizer.applyPreset(presetName)) {
            this.currentPreset = presetName;
            this.updateUI();
            await this.drawEQCurve();
            this.saveSettingsImmediate(); // 保存设置
        } else {
            console.error(`❌ 应用预设失败: ${presetName}`);
        }
    }

    updateBandGain(bandIndex: number, gain: number): void {
        this.refreshEqualizerReference();
        // console.log(`🎛️ 调节频段 ${bandIndex}，增益: ${gain}dB`);

        if (!this.equalizer) {
            console.error('❌ 均衡器实例不存在');
            return;
        }

        this.equalizer.setBandGain(bandIndex, gain);
        this.updateBandValueDisplay(bandIndex, gain);

        // 更新曲线
        this.drawEQCurve();

        // 如果手动调节，切换到自定义模式
        this.currentPreset = 'custom';
        if (this.presetSelect) {
            this.presetSelect.value = 'custom';
        }

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveSettingsImmediate();
        }, 500);
    }

    updatePreamp(gain: number): void {
        this.refreshEqualizerReference();
        if (!this.equalizer) {
            console.error('❌ 均衡器实例不存在');
            return;
        }

        if (this.equalizer.setPreamp) {
            this.equalizer.setPreamp(gain);
        }

        // 更新显示值
        if (this.preampValue) {
            const displayValue = gain >= 0 ? `+${gain.toFixed(1)}dB` : `${gain.toFixed(1)}dB`;
            this.preampValue.textContent = displayValue;
        }

        // 更新曲线
        this.drawEQCurve();

        // 保存设置
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveSettingsImmediate();
        }, 500);
    }

    updateBandValueDisplay(bandIndex: number, gain: number): void {
        if (this.bandValues[bandIndex]) {
            const displayValue = gain >= 0 ? `+${gain.toFixed(1)}dB` : `${gain.toFixed(1)}dB`;
            this.bandValues[bandIndex].textContent = displayValue;
        } else {
            console.error(`❌ 频段 ${bandIndex} 的数值元素不存在`);
        }
    }

    updateUI(): void {
        if (!this.equalizer) return;

        // 更新前置增益
        if (this.equalizer.getPreamp && this.preampSlider) {
            const preamp = this.equalizer.getPreamp();
            this.preampSlider.value = String(preamp);
            if (this.preampValue) {
                const displayValue = preamp >= 0 ? `+${preamp.toFixed(1)}dB` : `${preamp.toFixed(1)}dB`;
                this.preampValue.textContent = displayValue;
            }
        }

        // 更新滑块值
        const gains = this.equalizer.getAllGains();
        gains.forEach((gain, index) => {
            if (this.bandSliders[index]) {
                this.bandSliders[index].value = String(gain);
                this.updateBandValueDisplay(index, gain);
            }
        });

        // 更新预设选择器
        if (this.presetSelect) {
            // 确保预设选择器中有对应的选项
            const optionExists = Array.from(this.presetSelect.options).some((option) => option.value === this.currentPreset);

            if (optionExists) {
                this.presetSelect.value = this.currentPreset;
            } else {
                console.warn(`⚠️ 预设选择器中没有找到选项: ${this.currentPreset}`);
                // 如果是自定义预设但选项不存在，回退到'custom'
                if (this.currentPreset.startsWith('custom:')) {
                    this.presetSelect.value = 'custom';
                }
            }
        }

        // 绘制EQ曲线
        this.drawEQCurve();
    }

    reset(): void {
        if (!this.equalizer) return;
        this.equalizer.reset();
        this.currentPreset = 'flat';
        this.updateUI();
        this.drawEQCurve();
    }

    loadSettings(): void {
        try {
            const settings = (cacheManager.getLocalCache('musicbox-equalizer-settings') || {}) as EqualizerSettings;
            console.log('📋 从缓存加载的设置:', settings);
            const customPresets = (cacheManager.getLocalCache('musicbox-equalizer-custom-presets') || {}) as CustomEqualizerPresets;
            console.log('📋 从缓存加载的自定义预设:', Object.keys(customPresets));
            this.isEnabled = settings.enabled === true;

            // 更新UI但不触发事件
            if (this.equalizerToggle) {
                this.equalizerToggle.checked = this.isEnabled;
            }

            // 直接更新音频引擎状态，不通过setEnabled避免递归
            equalizerController.setEqualizerEnabled(this.isEnabled);

            // 更新UI状态
            if (this.equalizerSettings) {
                this.equalizerSettings.classList.toggle('disabled', !this.isEnabled);
            }

            // 加载预设或自定义设置
            if (settings.preset) {
                if (settings.preset.startsWith('custom:')) {
                    // 自定义预设
                    console.log(`🎵 恢复自定义预设: ${settings.preset}`);
                    this.currentPreset = settings.preset;

                    // 从预设名称中提取实际的预设名
                    const customPresetName = settings.preset.substring(7);
                    const preset = customPresets[customPresetName];

                    if (preset && this.equalizer) {
                        this.equalizer.setAllGains(preset.gains);
                        console.log(`✅ 自定义预设"${customPresetName}"增益值已恢复`);
                    } else if (settings.gains && Array.isArray(settings.gains) && this.equalizer) {
                        // 回退到保存的增益值
                        this.equalizer.setAllGains(settings.gains);
                        console.log('✅ 从保存的增益值恢复自定义设置');
                    }
                } else if (settings.preset !== 'custom') {
                    // 内置预设
                    console.log(`🎵 应用内置预设: ${settings.preset}`);
                    this.currentPreset = settings.preset;
                    if (this.equalizer) {
                        this.equalizer.applyPreset(settings.preset);
                    }
                } else {
                    // 旧版本的'custom'预设，使用保存的增益值
                    console.log('🎵 应用旧版本自定义增益设置');
                    this.currentPreset = 'custom';
                    if (settings.gains && Array.isArray(settings.gains) && this.equalizer) {
                        this.equalizer.setAllGains(settings.gains);
                    }
                }
            } else if (settings.gains && Array.isArray(settings.gains)) {
                console.log('🎵 应用自定义增益设置');
                this.currentPreset = 'custom';
                if (this.equalizer) {
                    this.equalizer.setAllGains(settings.gains);
                }
            } else {
                // 默认使用平坦预设
                this.currentPreset = 'flat';
                if (this.equalizer) {
                    this.equalizer.applyPreset('flat');
                }
            }

            // 恢复自定义预设到localStorage（向后兼容）
            if (Object.keys(customPresets).length > 0) {
                cacheManager.setLocalCache('customEqualizerPresets', customPresets);
                console.log(`✅ 恢复了 ${Object.keys(customPresets).length} 个自定义预设到localStorage`);
            }

            // 更新预设选择器选项
            this.updatePresetSelect();

            // 更新UI显示
            this.updateUI();
        } catch (error) {
            console.error('❌ 加载均衡器设置失败:', error);
            this.useDefaultSettings();
        }
    }

    useDefaultSettings(): void {
        this.isEnabled = false;
        this.currentPreset = 'flat';

        if (this.equalizerToggle) {
            this.equalizerToggle.checked = false;
        }

        if (this.equalizerSettings) {
            this.equalizerSettings.classList.add('disabled');
        }

        equalizerController.setEqualizerEnabled(false);
    }

    saveSettings(): void {
        // 保存主要设置
        const settings = {
            enabled: this.isEnabled,
            preset: this.currentPreset,
            gains: this.equalizer?.getAllGains() || [],
            lastModified: Date.now(),
        };

        cacheManager.setLocalCache('musicbox-equalizer-settings', settings);

        // 保存自定义预设
        const customPresetsFromStorage = cacheManager.getLocalCache('customEqualizerPresets') as CustomEqualizerPresets | null;
        if (customPresetsFromStorage) {
            const customPresets = customPresetsFromStorage;
            cacheManager.setLocalCache('musicbox-equalizer-custom-presets', customPresets);
            console.log(`💾 已同步 ${Object.keys(customPresets).length} 个自定义预设到缓存`);
        }
    }

    // 自定义预设管理方法
    toggleCustomPresetsPanel(): void {
        const isVisible = this.customPresetsPanel.style.display !== 'none';
        if (isVisible) {
            this.hideCustomPresetsPanel();
        } else {
            this.showCustomPresetsPanel();
        }
    }

    showCustomPresetsPanel(): void {
        this.customPresetsPanel.style.display = 'block';
        this.loadCustomPresetsList();
        this.updateSaveButtonState();
    }

    hideCustomPresetsPanel(): void {
        this.customPresetsPanel.style.display = 'none';
        this.newPresetNameInput.value = '';
    }

    updateSaveButtonState(): void {
        const name = this.newPresetNameInput.value.trim();
        const isValid = name.length > 0 && name.length <= 20;
        this.savePresetBtn.disabled = !isValid;
    }

    async saveCustomPreset(): Promise<void> {
        const name = this.newPresetNameInput.value.trim();
        if (!name || name.length > 20) {
            alert('请输入有效的预设名称（1-20个字符）');
            return;
        }

        // 获取当前的频段设置
        const gains: number[] = [];
        for (let i = 0; i < 10; i++) {
            gains[i] = this.bandSliders[i] ? parseFloat(this.bandSliders[i].value) : 0;
        }

        // 保存到缓存
        try {
            const customPresets = this.getCustomPresets();
            // 检查是否已存在同名预设
            if (customPresets[name]) {
                const shouldOverwrite = await appInteractionService.confirm({
                    title: '覆盖预设',
                    message: `预设"${name}"已存在，是否覆盖？`,
                    confirmText: '覆盖',
                    type: 'warning'
                });

                if (!shouldOverwrite) {
                    return;
                }
            }

            customPresets[name] = {
                name: name,
                gains: gains,
                createdAt: new Date().toISOString()
            };

            // 保存缓存
            cacheManager.setLocalCache('musicbox-equalizer-custom-presets', customPresets);
            cacheManager.setLocalCache('customEqualizerPresets', customPresets);

            // 更新预设选择器
            this.updatePresetSelect();

            // 清空输入框并刷新列表
            this.newPresetNameInput.value = '';
            this.loadCustomPresetsList();
            this.updateSaveButtonState();
        } catch (error) {
            console.error('❌ 保存自定义预设失败:', error);
            alert('保存预设失败，请重试');
        }
    }

    loadCustomPreset(name: string): void {
        try {
            const customPresets = this.getCustomPresets();
            const preset = customPresets[name];

            if (!preset) {
                console.error(`❌ 自定义预设"${name}"不存在`);
                return;
            }
            // console.log(`🔄 开始加载自定义预设"${name}"`);

            // 应用预设的增益值（不触发保存）
            for (let i = 0; i < 10; i++) {
                const gain = preset.gains[i] || 0;
                if (this.bandSliders[i]) {
                    this.bandSliders[i].value = String(gain);
                    // 直接更新均衡器，不触发updateBandGain的保存逻辑
                    if (this.equalizer) {
                        this.equalizer.setBandGain(i, gain);
                    }
                    this.updateBandValueDisplay(i, gain);
                }
            }

            // 更新预设选择器为完整的自定义预设名称
            const customPresetValue = `custom:${name}`;
            if (this.presetSelect) {
                this.presetSelect.value = customPresetValue;
                // console.log(`🎛️ 预设选择器已更新为: ${customPresetValue}`);
            }

            // 设置当前预设为自定义预设的完整标识
            this.currentPreset = customPresetValue;
            this.saveSettingsImmediate();
        } catch (error) {
            console.error('❌ 加载自定义预设失败:', error);
            alert('加载预设失败，请重试');
        }
    }

    async deleteCustomPreset(name: string): Promise<void> {
        const shouldDelete = await appInteractionService.confirm({
            title: '删除预设',
            message: `确定要删除预设"${name}"吗？此操作无法撤销。`,
            confirmText: '删除',
            type: 'danger'
        });

        if (!shouldDelete) {
            return;
        }

        try {
            const customPresets = this.getCustomPresets();
            delete customPresets[name];

            // 更新缓存
            cacheManager.setLocalCache('musicbox-equalizer-custom-presets', customPresets);
            cacheManager.setLocalCache('customEqualizerPresets', customPresets);

            // 更新预设选择器
            this.updatePresetSelect();
            this.loadCustomPresetsList();
        } catch (error) {
            console.error('❌ 删除自定义预设失败:', error);
            alert('删除预设失败，请重试');
        }
    }

    getCustomPresets(): CustomEqualizerPresets {
        try {
            if (!cacheManager) {
                console.warn('CacheManager未加载，返回空的自定义预设');
                return {};
            }

            const stored = cacheManager.getLocalCache('musicbox-equalizer-custom-presets') as CustomEqualizerPresets | null;
            return stored || {};
        } catch (error) {
            console.error('❌ 读取自定义预设失败:', error);
            return {};
        }
    }

    loadCustomPresetsList(): void {
        const customPresets = this.getCustomPresets();
        const presetNames = Object.keys(customPresets);

        if (presetNames.length === 0) {
            this.customPresetsList.innerHTML = '<div class="no-presets">暂无自定义预设</div>';
            return;
        }

        this.customPresetsList.innerHTML = presetNames.map((name) => {
            const preset = customPresets[name];
            const createdDate = new Date(preset.createdAt).toLocaleDateString();

            return `
                <div class="preset-item">
                    <div class="preset-info">
                        <div class="preset-name">${name}</div>
                        <div class="preset-date">创建于: ${createdDate}</div>
                    </div>
                    <div class="preset-actions">
                        <button class="preset-action-btn load-btn" onclick="equalizerComponent.loadCustomPreset('${name}')">
                            加载
                        </button>
                        <button class="preset-action-btn delete-btn" onclick="equalizerComponent.deleteCustomPreset('${name}')">
                            删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    updatePresetSelect(): void {
        // 移除现有的自定义预设选项
        const options = Array.from(this.presetSelect.options);
        options.forEach((option) => {
            if (option.dataset.custom === 'true') {
                option.remove();
            }
        });

        // 添加自定义预设选项
        const customPresets = this.getCustomPresets();
        const customOption = this.presetSelect.querySelector('option[value="custom"]');

        Object.keys(customPresets).forEach((name) => {
            const option = document.createElement('option');
            option.value = `custom:${name}`;
            option.textContent = `自定义: ${name}`;
            option.dataset.custom = 'true';

            // 在"自定义"选项之后插入
            if (customOption && customOption.nextSibling) {
                this.presetSelect.insertBefore(option, customOption.nextSibling);
            } else {
                this.presetSelect.appendChild(option);
            }
        });
    }

    // 重新加载配置
    reloadConfig(): boolean {
        this.loadSettings();
        this.updatePresetSelect();
        return true;
    }

    // 立即保存设置
    saveSettingsImmediate(): void {
        this.saveSettings();
    }

    // 绘制EQ曲线
    async drawEQCurve(): Promise<void> {
        if (!this.curveCanvas || !this.curveCtx || !this.equalizer) {
            return;
        }
        const canvas = this.curveCanvas;
        const ctx = this.curveCtx;

        // 获取频率响应数据
        let response: EqualizerFrequencyPoint[] = [];
        if (this.equalizer.getFrequencyResponse) {
            response = await this.equalizer.getFrequencyResponse();
        }

        if (!response || response.length === 0) {
            return;
        }

        // 设置canvas尺寸（使用CSS尺寸）
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 计算样式变量
        const style = getComputedStyle(canvas);
        const primaryColor = style.getPropertyValue('--color-primary') || '#335eea';
        const borderColor = style.getPropertyValue('--color-border') || '#e5e5e7';

        // 绘制网格线
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        // 水平网格线 (0dB, ±6dB, ±12dB)
        const dbLevels = [-12, -6, 0, 6, 12];
        dbLevels.forEach((db) => {
            const y = height / 2 - (db / 12) * (height / 2);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        });

        // 垂直网格线（对数频率刻度）
        const freqLines = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
        freqLines.forEach((freq) => {
            const minFreq = 20;
            const maxFreq = 20000;
            const logPos = (Math.log10(freq) - Math.log10(minFreq)) /
                          (Math.log10(maxFreq) - Math.log10(minFreq));
            const x = logPos * width;

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        });

        // 绘制EQ曲线
        ctx.setLineDash([]);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.beginPath();

        response.forEach((point, index) => {
            const {frequency, gain} = point;

            // 对数频率映射到x坐标
            const minFreq = 20;
            const maxFreq = 20000;
            const logPos = (Math.log10(frequency) - Math.log10(minFreq)) /
                          (Math.log10(maxFreq) - Math.log10(minFreq));
            const x = logPos * width;

            // 增益映射到y坐标（±12dB范围）
            const clampedGain = Math.max(-12, Math.min(12, gain));
            const y = height / 2 - (clampedGain / 12) * (height / 2);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // 添加填充渐变
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, primaryColor + '40');
        gradient.addColorStop(1, primaryColor + '08');
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    private requireElement<T extends HTMLElement = HTMLElement>(element: Element | null, selector: string): T {
        if (element instanceof HTMLElement) {
            return element as T;
        }

        throw new Error(`Element not found: ${selector}`);
    }

    private queryElement<T extends HTMLElement = HTMLElement>(selector: string): T {
        const element = this.modal?.querySelector<T>(selector);
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        return element;
    }
}

function queryDocumentElement<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Element not found: ${selector}`);
    }

    return element;
}

export {EqualizerComponent};
