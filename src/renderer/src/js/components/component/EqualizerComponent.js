/**
 * 均衡器组件
 */

class EqualizerComponent extends Component {
    constructor() {
        super('#equalizer-modal');
        this.equalizer = null;
        this.isEnabled = false;
        this.currentPreset = 'flat';

        this.setupElements();
        this.setupEventListeners();
        this.initializeEqualizer().then(r => {
        });

        // 设置全局引用，供HTML中的onclick事件使用
        window.equalizerComponent = this;
    }

    setupElements() {
        // 弹窗控制
        this.modal = this.element;
        this.closeBtn = this.element.querySelector('#equalizer-close');
        this.openBtn = document.querySelector('#open-equalizer-btn');

        // 均衡器开关
        this.equalizerToggle = document.querySelector('#equalizer-toggle');
        this.equalizerSettings = document.querySelector('#equalizer-settings');

        // 预设选择器
        this.presetSelect = this.element.querySelector('#equalizer-preset-select');
        this.managePresetsBtn = this.element.querySelector('#manage-presets-btn');

        // 自定义预设管理
        this.customPresetsPanel = this.element.querySelector('#custom-presets-panel');
        this.closePresetsPanelBtn = this.element.querySelector('#close-presets-panel');
        this.newPresetNameInput = this.element.querySelector('#new-preset-name');
        this.savePresetBtn = this.element.querySelector('#save-preset-btn');
        this.customPresetsList = this.element.querySelector('#custom-presets-list');

        // 频段滑块
        this.bandSliders = [];
        this.bandValues = [];
        for (let i = 0; i < 10; i++) {
            this.bandSliders[i] = this.element.querySelector(`#band-${i}`);
            this.bandValues[i] = this.element.querySelector(`#band-value-${i}`);
            console.log(`🎛️ 频段 ${i} - 滑块:`, this.bandSliders[i], '数值:', this.bandValues[i]);
        }

        // 控制按钮
        this.resetBtn = this.element.querySelector('#equalizer-reset');
        this.applyBtn = this.element.querySelector('#equalizer-apply');
    }

    setupEventListeners() {
        this.openBtn?.addEventListener('click', () => this.show());
        this.closeBtn?.addEventListener('click', () => this.hide());
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        this.equalizerToggle?.addEventListener('change', (e) => {
            this.setEnabled(e.target.checked);
        });

        // 预设选择
        this.presetSelect?.addEventListener('change', (e) => {
            this.applyPreset(e.target.value);
        });

        // 自定义预设管理
        this.managePresetsBtn?.addEventListener('click', () => {
            this.toggleCustomPresetsPanel();
        });

        this.closePresetsPanelBtn?.addEventListener('click', () => {
            this.hideCustomPresetsPanel();
        });

        this.savePresetBtn?.addEventListener('click', () => {
            this.saveCustomPreset();
        });

        this.newPresetNameInput?.addEventListener('input', () => {
            this.updateSaveButtonState();
        });

        this.newPresetNameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveCustomPreset();
            }
        });

        // 频段滑块
        this.bandSliders.forEach((slider, index) => {
            if (slider) {
                slider.addEventListener('input', (e) => {
                    this.updateBandGain(index, parseFloat(e.target.value));
                });
            }
        });

        // 控制按钮
        this.resetBtn?.addEventListener('click', () => this.reset());
        this.applyBtn?.addEventListener('click', () => this.hide());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.hide();
            }
        });
    }

    async initializeEqualizer() {
        console.log('🎛️ 尝试初始化均衡器组件...');
        console.log('🎛️ window.api:', window.api);
        console.log('🎛️ window.api.getEqualizer:', window.api?.getEqualizer);

        // 等待API初始化
        if (window.api && window.api.getEqualizer) {
            this.equalizer = window.api.getEqualizer();
            console.log('🎛️ 获取到的均衡器实例:', this.equalizer);
            if (this.equalizer) {
                if (window.cacheManager) {
                    this.reloadConfig();
                } else {
                    this.loadSettings();
                    this.updatePresetSelect();
                }
                console.log('✅ 均衡器组件初始化成功');
            } else {
                console.log('⏳ 均衡器实例为空，延迟重试...');
                // 延迟初始化
                setTimeout(() => this.initializeEqualizer(), 100);
            }
        } else {
            console.log('⏳ API或getEqualizer方法不可用，延迟重试...');
            setTimeout(() => this.initializeEqualizer(), 100);
        }
    }

    show() {
        this.modal.style.display = 'flex';
        setTimeout(() => {
            this.modal.classList.add('show');
        }, 10);
        this.updateUI();
    }

    hide() {
        this.modal.classList.remove('show');
        setTimeout(() => {
            this.modal.style.display = 'none';
        }, 300);
        this.saveSettings();
    }

    isVisible() {
        return this.modal.classList.contains('show');
    }

    setEnabled(enabled) {
        console.log(`🎛️ 设置均衡器状态: ${enabled} (当前状态: ${this.isEnabled})`);

        // 防止重复设置相同状态
        if (this.isEnabled === enabled) {
            console.log(`ℹ️ 均衡器状态已经是 ${enabled}，跳过设置`);
            return;
        }

        this.isEnabled = enabled;

        // 更新音频引擎
        if (window.api && window.api.setEqualizerEnabled) {
            window.api.setEqualizerEnabled(enabled);
            console.log(`🎛️ 音频引擎均衡器状态已更新: ${enabled}`);
        } else {
            console.warn('⚠️ 音频引擎API不可用，无法更新均衡器状态');
        }

        // 更新UI状态（避免触发change事件）
        this.updateUIState(enabled);

        // 立即保存设置到缓存
        this.saveSettingsImmediate();
        console.log(`✅ 均衡器${enabled ? '已启用' : '已禁用'}`);
    }

    // 更新UI状态，避免触发事件
    updateUIState(enabled) {
        // 临时移除事件监听器，避免递归调用
        if (this.equalizerToggle) {
            const oldHandler = this.equalizerToggle.onchange;
            this.equalizerToggle.onchange = null;
            this.equalizerToggle.checked = enabled;
            this.equalizerToggle.onchange = oldHandler;
            console.log(`🎛️ UI开关状态已更新: ${enabled}`);
        }

        if (this.equalizerSettings) {
            this.equalizerSettings.classList.toggle('disabled', !enabled);
            console.log(`🎛️ 设置面板状态已更新: ${enabled ? '启用' : '禁用'}`);
        }
    }

    applyPreset(presetName) {
        if (!this.equalizer) return;

        console.log(`🎵 开始应用预设: ${presetName}`);

        // 检查是否是自定义预设
        if (presetName.startsWith('custom:')) {
            const customPresetName = presetName.substring(7); // 移除 'custom:' 前缀
            console.log(`🎵 应用自定义预设: ${customPresetName}`);
            this.loadCustomPreset(customPresetName);
            return;
        }

        // 应用内置预设
        if (this.equalizer.applyPreset(presetName)) {
            this.currentPreset = presetName;
            this.updateUI();
            this.saveSettingsImmediate(); // 保存设置
            console.log(`🎵 已应用内置预设: ${presetName}`);
        } else {
            console.error(`❌ 应用预设失败: ${presetName}`);
        }
    }

    updateBandGain(bandIndex, gain) {
        console.log(`🎛️ 调节频段 ${bandIndex}，增益: ${gain}dB`);

        if (!this.equalizer) {
            console.error('❌ 均衡器实例不存在');
            return;
        }

        this.equalizer.setBandGain(bandIndex, gain);
        this.updateBandValueDisplay(bandIndex, gain);

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

        console.log(`✅ 频段 ${bandIndex} 增益已更新为 ${gain}dB`);
    }

    updateBandValueDisplay(bandIndex, gain) {
        console.log(`🎛️ 更新频段 ${bandIndex} 显示值: ${gain}dB`);
        console.log(`🎛️ 数值元素:`, this.bandValues[bandIndex]);

        if (this.bandValues[bandIndex]) {
            const displayValue = gain >= 0 ? `+${gain.toFixed(1)}dB` : `${gain.toFixed(1)}dB`;
            this.bandValues[bandIndex].textContent = displayValue;
            console.log(`✅ 频段 ${bandIndex} 显示值已更新为: ${displayValue}`);
        } else {
            console.error(`❌ 频段 ${bandIndex} 的数值元素不存在`);
        }
    }

    updateUI() {
        if (!this.equalizer) return;

        // 更新滑块值
        const gains = this.equalizer.getAllGains();
        gains.forEach((gain, index) => {
            if (this.bandSliders[index]) {
                this.bandSliders[index].value = gain;
                this.updateBandValueDisplay(index, gain);
            }
        });

        // 更新预设选择器
        if (this.presetSelect) {
            // 确保预设选择器中有对应的选项
            const optionExists = Array.from(this.presetSelect.options).some(option => option.value === this.currentPreset);

            if (optionExists) {
                this.presetSelect.value = this.currentPreset;
                console.log(`🎛️ 预设选择器已更新为: ${this.currentPreset}`);
            } else {
                console.warn(`⚠️ 预设选择器中没有找到选项: ${this.currentPreset}`);
                // 如果是自定义预设但选项不存在，回退到'custom'
                if (this.currentPreset.startsWith('custom:')) {
                    this.presetSelect.value = 'custom';
                    console.log('🔄 回退到通用自定义选项');
                }
            }
        }
    }

    reset() {
        if (!this.equalizer) return;

        this.equalizer.reset();
        this.currentPreset = 'flat';
        this.updateUI();
        console.log('🔄 均衡器已重置');
    }

    loadSettings() {
        try {
            if (!window.cacheManager) {
                console.warn('🎛️ CacheManager未加载，使用默认均衡器设置');
                this.useDefaultSettings();
                return;
            }

            console.log('🔄 开始加载均衡器设置...');

            const settings = window.cacheManager.getLocalCache('musicbox-equalizer-settings') || {};
            console.log('📋 从缓存加载的设置:', settings);
            const customPresets = window.cacheManager.getLocalCache('musicbox-equalizer-custom-presets') || {};
            console.log('📋 从缓存加载的自定义预设:', Object.keys(customPresets));
            this.isEnabled = settings.enabled === true;
            console.log(`🎛️ 均衡器启用状态: ${this.isEnabled}`);

            // 更新UI但不触发事件
            if (this.equalizerToggle) {
                this.equalizerToggle.checked = this.isEnabled;
            }

            // 直接更新音频引擎状态，不通过setEnabled避免递归
            if (window.api && window.api.setEqualizerEnabled) {
                window.api.setEqualizerEnabled(this.isEnabled);
            }

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
                console.log('🎵 使用默认平坦预设');
                this.currentPreset = 'flat';
                if (this.equalizer) {
                    this.equalizer.applyPreset('flat');
                }
            }

            // 恢复自定义预设到localStorage（向后兼容）
            if (Object.keys(customPresets).length > 0) {
                window.cacheManager.setLocalCache('customEqualizerPresets', customPresets);
                console.log(`✅ 恢复了 ${Object.keys(customPresets).length} 个自定义预设到localStorage`);
            }

            // 更新预设选择器选项
            this.updatePresetSelect();

            // 更新UI显示
            this.updateUI();
            console.log('✅ 均衡器设置已从缓存完整加载');
        } catch (error) {
            console.error('❌ 加载均衡器设置失败:', error);
            this.useDefaultSettings();
        }
    }

    useDefaultSettings() {
        console.log('🔄 使用默认均衡器设置');
        this.isEnabled = false;
        this.currentPreset = 'flat';

        if (this.equalizerToggle) {
            this.equalizerToggle.checked = false;
        }

        if (this.equalizerSettings) {
            this.equalizerSettings.classList.add('disabled');
        }

        if (window.api && window.api.setEqualizerEnabled) {
            window.api.setEqualizerEnabled(false);
        }
    }

    saveSettings() {
        try {
            if (!window.cacheManager) {
                console.error('❌ CacheManager未加载，无法保存均衡器设置');
                return false;
            }

            // 保存主要设置
            const settings = {
                enabled: this.isEnabled,
                preset: this.currentPreset,
                gains: this.equalizer?.getAllGains() || [],
                lastModified: Date.now(),
            };

            window.cacheManager.setLocalCache('musicbox-equalizer-settings', settings);
            console.log('💾 均衡器主要设置已保存到缓存');

            // 保存自定义预设
            try {
                const customPresetsFromStorage = window.cacheManager.getLocalCache('customEqualizerPresets');
                if (customPresetsFromStorage) {
                    const customPresets = customPresetsFromStorage;
                    window.cacheManager.setLocalCache('musicbox-equalizer-custom-presets', customPresets);
                    console.log(`💾 已同步 ${Object.keys(customPresets).length} 个自定义预设到缓存`);
                }
            } catch (error) {
                console.warn('⚠️ 同步自定义预设到缓存失败:', error);
            }

            // 验证保存是否成功
            const saved = window.cacheManager.getLocalCache('musicbox-equalizer-settings');
            if (saved) {
                console.log('✅ 均衡器设置保存验证成功');
                return true;
            } else {
                console.error('❌ 均衡器设置保存验证失败');
                return false;
            }
        } catch (error) {
            console.error('❌ 保存均衡器设置失败:', error);
            return false;
        }
    }

    // 自定义预设管理方法
    toggleCustomPresetsPanel() {
        const isVisible = this.customPresetsPanel.style.display !== 'none';
        if (isVisible) {
            this.hideCustomPresetsPanel();
        } else {
            this.showCustomPresetsPanel();
        }
    }

    showCustomPresetsPanel() {
        this.customPresetsPanel.style.display = 'block';
        this.loadCustomPresetsList();
        this.updateSaveButtonState();
    }

    hideCustomPresetsPanel() {
        this.customPresetsPanel.style.display = 'none';
        this.newPresetNameInput.value = '';
    }

    updateSaveButtonState() {
        const name = this.newPresetNameInput.value.trim();
        const isValid = name.length > 0 && name.length <= 20;
        this.savePresetBtn.disabled = !isValid;
    }

    saveCustomPreset() {
        const name = this.newPresetNameInput.value.trim();
        if (!name || name.length > 20) {
            alert('请输入有效的预设名称（1-20个字符）');
            return;
        }

        // 获取当前的频段设置
        const gains = [];
        for (let i = 0; i < 10; i++) {
            gains[i] = this.bandSliders[i] ? parseFloat(this.bandSliders[i].value) : 0;
        }

        // 保存到缓存
        try {
            if (!window.cacheManager) {
                throw new Error('CacheManager未加载');
            }

            const customPresets = this.getCustomPresets();
            // 检查是否已存在同名预设
            if (customPresets[name]) {
                if (!confirm(`预设"${name}"已存在，是否覆盖？`)) {
                    return;
                }
            }

            customPresets[name] = {
                name: name,
                gains: gains,
                createdAt: new Date().toISOString()
            };

            // 保存缓存
            window.cacheManager.setLocalCache('musicbox-equalizer-custom-presets', customPresets);
            window.cacheManager.setLocalCache('customEqualizerPresets', customPresets);

            // 更新预设选择器
            this.updatePresetSelect();

            // 清空输入框并刷新列表
            this.newPresetNameInput.value = '';
            this.loadCustomPresetsList();
            this.updateSaveButtonState();
            console.log(`✅ 自定义预设"${name}"保存成功`);
        } catch (error) {
            console.error('❌ 保存自定义预设失败:', error);
            alert('保存预设失败，请重试');
        }
    }

    loadCustomPreset(name) {
        try {
            const customPresets = this.getCustomPresets();
            const preset = customPresets[name];

            if (!preset) {
                console.error(`❌ 自定义预设"${name}"不存在`);
                return;
            }
            console.log(`🔄 开始加载自定义预设"${name}"`);

            // 应用预设的增益值（不触发保存）
            for (let i = 0; i < 10; i++) {
                const gain = preset.gains[i] || 0;
                if (this.bandSliders[i]) {
                    this.bandSliders[i].value = gain;
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
                console.log(`🎛️ 预设选择器已更新为: ${customPresetValue}`);
            }

            // 设置当前预设为自定义预设的完整标识
            this.currentPreset = customPresetValue;
            this.saveSettingsImmediate();
            console.log(`✅ 自定义预设"${name}"加载成功`);
        } catch (error) {
            console.error('❌ 加载自定义预设失败:', error);
            alert('加载预设失败，请重试');
        }
    }

    deleteCustomPreset(name) {
        if (!confirm(`确定要删除预设"${name}"吗？此操作无法撤销。`)) {
            return;
        }

        try {
            if (!window.cacheManager) {
                throw new Error('CacheManager未加载');
            }

            const customPresets = this.getCustomPresets();
            delete customPresets[name];

            // 更新缓存
            window.cacheManager.setLocalCache('musicbox-equalizer-custom-presets', customPresets);
            window.cacheManager.setLocalCache('customEqualizerPresets', customPresets);

            // 更新预设选择器
            this.updatePresetSelect();
            this.loadCustomPresetsList();
            console.log(`✅ 自定义预设"${name}"删除成功`);
        } catch (error) {
            console.error('❌ 删除自定义预设失败:', error);
            alert('删除预设失败，请重试');
        }
    }

    getCustomPresets() {
        try {
            if (!window.cacheManager) {
                console.warn('CacheManager未加载，返回空的自定义预设');
                return {};
            }

            const stored = window.cacheManager.getLocalCache('musicbox-equalizer-custom-presets');
            return stored || {};
        } catch (error) {
            console.error('❌ 读取自定义预设失败:', error);
            return {};
        }
    }

    loadCustomPresetsList() {
        const customPresets = this.getCustomPresets();
        const presetNames = Object.keys(customPresets);

        if (presetNames.length === 0) {
            this.customPresetsList.innerHTML = '<div class="no-presets">暂无自定义预设</div>';
            return;
        }

        this.customPresetsList.innerHTML = presetNames.map(name => {
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

    updatePresetSelect() {
        // 移除现有的自定义预设选项
        const options = Array.from(this.presetSelect.options);
        options.forEach(option => {
            if (option.dataset.custom === 'true') {
                option.remove();
            }
        });

        // 添加自定义预设选项
        const customPresets = this.getCustomPresets();
        const customOption = this.presetSelect.querySelector('option[value="custom"]');

        Object.keys(customPresets).forEach(name => {
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
    reloadConfig() {
        console.log('🔄 重新加载均衡器配置');
        this.loadSettings();
        this.updatePresetSelect();
        return true;
    }

    // 立即保存设置
    saveSettingsImmediate() {
        this.saveSettings();
    }

    destroy() {
        this.saveSettings();
        super.destroy();
    }
}
