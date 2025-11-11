/**
 * UI API - 用户界面 API
 * 提供通知、对话框、状态栏、进度提示等 UI 交互功能
 */

import {Validator} from './common/validation.js';
import {ErrorUtils} from './common/errors.js';
import {Disposable, toDisposable} from '../core/Lifecycle.js';
import {showToast, theme} from '@utils';

/**
 * 通知类型枚举
 */
export const NotificationType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

/**
 * 设置页管理器
 * 管理扩展贡献的设置页导航项和内容
 */
class SettingsManagerClass {
    constructor() {
        this.sections = new Map(); // 存储注册的导航项
        this.pages = new Map(); // 存储注册的页面渲染函数
        this.initialized = false;
    }

    /**
     * 初始化设置页管理器
     */
    initialize() {
        if (this.initialized) return;
        this.initialized = true;

        // 监听设置页显示事件，渲染扩展内容
        this._setupSettingsPageListener();
    }

    /**
     * 注册设置页导航项
     */
    registerSection(id, label, options = {}) {
        if (this.sections.has(id)) {
            console.warn(`设置页导航项 ${id} 已存在，将被覆盖`);
        }

        const section = {
            id,
            label,
            order: options.order || 100,
            icon: options.icon || null
        };

        this.sections.set(id, section);
        this._renderSection(section);

        return toDisposable(() => {
            this.sections.delete(id);
            this._removeSection(id);
        });
    }

    /**
     * 注册设置页内容
     */
    registerPage(sectionId, renderFunction) {
        if (this.pages.has(sectionId)) {
            console.warn(`设置页内容 ${sectionId} 已存在，将被覆盖`);
        }

        this.pages.set(sectionId, renderFunction);
        this._renderPage(sectionId);

        return toDisposable(() => {
            this.pages.delete(sectionId);
            this._removePage(sectionId);
        });
    }

    /**
     * 渲染导航项到设置页侧边栏
     */
    _renderSection(section) {
        const navList = document.querySelector('.settings-nav-list');
        if (!navList) return;

        // 检查是否已存在
        let navItem = document.querySelector(`[data-section="${section.id}"]`)?.parentElement;

        if (!navItem) {
            navItem = document.createElement('li');
            navItem.className = 'settings-nav-item';
        }

        const navBtn = document.createElement('button');
        navBtn.className = 'settings-nav-btn';
        navBtn.dataset.section = section.id;
        navBtn.innerHTML = `<span class="nav-text">${section.label}</span>`;

        navItem.innerHTML = '';
        navItem.appendChild(navBtn);

        // 按order排序插入
        const sections = Array.from(this.sections.values()).sort((a, b) => a.order - b.order);
        const index = sections.findIndex(s => s.id === section.id);

        if (index === sections.length - 1) {
            navList.appendChild(navItem);
        } else {
            const nextSection = sections[index + 1];
            const nextNavItem = document.querySelector(`[data-section="${nextSection.id}"]`)?.parentElement;
            if (nextNavItem) {
                navList.insertBefore(navItem, nextNavItem);
            } else {
                navList.appendChild(navItem);
            }
        }

        // 添加点击事件
        navBtn.addEventListener('click', (e) => {
            this._switchToSection(e.currentTarget.dataset.section);
        });
    }

    /**
     * 渲染页面内容到设置页内容区
     */
    _renderPage(sectionId) {
        const sectionsContainer = document.querySelector('.settings-sections-container');
        if (!sectionsContainer) return;

        const renderFunction = this.pages.get(sectionId);
        if (!renderFunction) return;

        // 检查是否已存在
        let sectionElement = document.querySelector(`.settings-section[data-section="${sectionId}"]`);

        if (!sectionElement) {
            sectionElement = document.createElement('div');
            sectionElement.className = 'settings-section';
            sectionElement.dataset.section = sectionId;
            sectionElement.dataset.extensionSection = 'true';
            sectionsContainer.appendChild(sectionElement);
        }

        // 清空现有内容
        sectionElement.innerHTML = '';

        // 添加标题
        const section = this.sections.get(sectionId);
        if (section) {
            const title = document.createElement('h2');
            title.className = 'section-title';
            title.textContent = section.label;
            sectionElement.appendChild(title);
        }

        // 调用渲染函数
        try {
            renderFunction(sectionElement);
        } catch (error) {
            console.error(`渲染设置页 ${sectionId} 失败:`, error);
        }
    }

    /**
     * 移除导航项
     */
    _removeSection(id) {
        const navItem = document.querySelector(`[data-section="${id}"]`)?.parentElement;
        if (navItem && navItem.dataset.extensionSection) {
            navItem.remove();
        }
    }

    /**
     * 移除页面内容
     */
    _removePage(id) {
        const sectionElement = document.querySelector(`.settings-section[data-section="${id}"]`);
        if (sectionElement && sectionElement.dataset.extensionSection) {
            sectionElement.remove();
        }
    }

    /**
     * 切换到指定设置页
     */
    _switchToSection(sectionId) {
        // 更新导航按钮状态
        document.querySelectorAll('.settings-nav-btn').forEach(btn => {
            if (btn.dataset.section === sectionId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 显示/隐藏设置区域
        document.querySelectorAll('.settings-section').forEach(section => {
            if (section.dataset.section === sectionId) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
    }

    /**
     * 监听设置页显示事件
     */
    _setupSettingsPageListener() {
        // 使用MutationObserver监听设置页显示
        const observer = new MutationObserver(() => {
            const settingsPage = document.getElementById('settings-page');
            if (settingsPage && settingsPage.style.display !== 'none') {
                // 设置页显示时，重新渲染所有扩展内容
                this.sections.forEach(section => this._renderSection(section));
                this.pages.forEach((_, sectionId) => this._renderPage(sectionId));
            }
        });

        const settingsPage = document.getElementById('settings-page');
        if (settingsPage) {
            observer.observe(settingsPage, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
    }

    /**
     * 创建开关设置项
     */
    createToggleSetting(label, description, defaultValue, onChange) {
        const settingsItem = document.createElement('div');
        settingsItem.className = 'settings-item';

        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-info';

        const itemLabel = document.createElement('label');
        itemLabel.className = 'item-label';
        itemLabel.textContent = label;

        const itemDescription = document.createElement('p');
        itemDescription.className = 'item-description';
        itemDescription.textContent = description;

        itemInfo.appendChild(itemLabel);
        itemInfo.appendChild(itemDescription);

        const itemControl = document.createElement('div');
        itemControl.className = 'item-control';

        const toggleSwitch = document.createElement('div');
        toggleSwitch.className = 'toggle-switch';

        const toggleId = `toggle-${Math.random().toString(36).substr(2, 9)}`;
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.id = toggleId;
        toggleInput.className = 'toggle-input';
        toggleInput.checked = defaultValue;

        const toggleLabel = document.createElement('label');
        toggleLabel.htmlFor = toggleId;
        toggleLabel.className = 'toggle-label';

        toggleInput.addEventListener('change', (e) => {
            onChange(e.target.checked);
        });

        toggleSwitch.appendChild(toggleInput);
        toggleSwitch.appendChild(toggleLabel);
        itemControl.appendChild(toggleSwitch);

        settingsItem.appendChild(itemInfo);
        settingsItem.appendChild(itemControl);

        return settingsItem;
    }

    /**
     * 创建下拉选择设置项
     */
    createSelectSetting(label, description, options, defaultValue, onChange) {
        const settingsItem = document.createElement('div');
        settingsItem.className = 'settings-item';

        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-info';

        const itemLabel = document.createElement('label');
        itemLabel.className = 'item-label';
        itemLabel.textContent = label;

        const itemDescription = document.createElement('p');
        itemDescription.className = 'item-description';
        itemDescription.textContent = description;

        itemInfo.appendChild(itemLabel);
        itemInfo.appendChild(itemDescription);

        const itemControl = document.createElement('div');
        itemControl.className = 'item-control';

        const select = document.createElement('select');
        select.className = 'settings-select';

        // 处理选项
        options.forEach(option => {
            const optionElement = document.createElement('option');
            if (typeof option === 'string') {
                optionElement.value = option;
                optionElement.textContent = option;
            } else {
                optionElement.value = option.value;
                optionElement.textContent = option.label || option.value;
            }
            select.appendChild(optionElement);
        });

        select.value = defaultValue;

        select.addEventListener('change', (e) => {
            onChange(e.target.value);
        });

        itemControl.appendChild(select);

        settingsItem.appendChild(itemInfo);
        settingsItem.appendChild(itemControl);

        return settingsItem;
    }

    /**
     * 创建文本输入设置项
     */
    createInputSetting(label, description, defaultValue, onChange, options = {}) {
        const settingsItem = document.createElement('div');
        settingsItem.className = 'settings-item';

        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-info';

        const itemLabel = document.createElement('label');
        itemLabel.className = 'item-label';
        itemLabel.textContent = label;

        const itemDescription = document.createElement('p');
        itemDescription.className = 'item-description';
        itemDescription.textContent = description;

        itemInfo.appendChild(itemLabel);
        itemInfo.appendChild(itemDescription);

        const itemControl = document.createElement('div');
        itemControl.className = 'item-control';

        const input = document.createElement('input');
        input.type = options.type || 'text';
        input.className = 'settings-select'; // 复用select的样式
        input.value = defaultValue;
        input.placeholder = options.placeholder || '';

        if (options.min !== undefined) input.min = options.min;
        if (options.max !== undefined) input.max = options.max;
        if (options.step !== undefined) input.step = options.step;

        input.addEventListener('change', (e) => {
            onChange(e.target.value);
        });

        itemControl.appendChild(input);

        settingsItem.appendChild(itemInfo);
        settingsItem.appendChild(itemControl);

        return settingsItem;
    }

    /**
     * 创建颜色选择器设置项
     */
    createColorPickerSetting(label, description, defaultValue, onChange) {
        const settingsItem = document.createElement('div');
        settingsItem.className = 'settings-item';

        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-info';

        const itemLabel = document.createElement('label');
        itemLabel.className = 'item-label';
        itemLabel.textContent = label;

        const itemDescription = document.createElement('p');
        itemDescription.className = 'item-description';
        itemDescription.textContent = description;

        itemInfo.appendChild(itemLabel);
        itemInfo.appendChild(itemDescription);

        const itemControl = document.createElement('div');
        itemControl.className = 'item-control';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = defaultValue;
        colorInput.style.width = '60px';
        colorInput.style.height = '36px';
        colorInput.style.border = '1px solid var(--color-border)';
        colorInput.style.borderRadius = 'var(--radius-md)';
        colorInput.style.cursor = 'pointer';

        colorInput.addEventListener('change', (e) => {
            onChange(e.target.value);
        });

        itemControl.appendChild(colorInput);

        settingsItem.appendChild(itemInfo);
        settingsItem.appendChild(itemControl);

        return settingsItem;
    }

    /**
     * 创建按钮设置项
     */
    createButtonSetting(label, description, buttonText, onClick, options = {}) {
        const settingsItem = document.createElement('div');
        settingsItem.className = 'settings-item';

        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-info';

        const itemLabel = document.createElement('label');
        itemLabel.className = 'item-label';
        itemLabel.textContent = label;

        const itemDescription = document.createElement('p');
        itemDescription.className = 'item-description';
        itemDescription.textContent = description;

        itemInfo.appendChild(itemLabel);
        itemInfo.appendChild(itemDescription);

        const itemControl = document.createElement('div');
        itemControl.className = 'item-control';

        const button = document.createElement('button');
        button.className = options.secondary ? 'settings-button secondary' : 'settings-button';
        button.textContent = buttonText;

        button.addEventListener('click', onClick);

        itemControl.appendChild(button);

        settingsItem.appendChild(itemInfo);
        settingsItem.appendChild(itemControl);

        return settingsItem;
    }
}

// 创建单例
const SettingsManager = new SettingsManagerClass();

// 初始化设置页管理器
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        SettingsManager.initialize();
    });
} else {
    SettingsManager.initialize();
}

/**
 * 创建 UI API
 * @param {Object} context - 扩展上下文
 * @returns {UIAPI} UI API 实例
 */
export function createUIAPI(context) {
    return {
        /**
         * 显示通知
         * @param {string} message - 消息内容
         * @param {string} [type='info'] - 类型 (info, success, warning, error)
         * @returns {*}
         */
        showNotification(message, type = NotificationType.INFO) {
            Validator.assertNonEmptyString(message, 'message');
            Validator.assertEnum(type, Object.values(NotificationType), 'type');

            return ErrorUtils.wrapSync(() => {
                showToast(message, type);
            }, 'ui.showNotification');
        },

        /**
         * 显示信息通知
         * @param {string} message - 消息内容
         * @returns {*}
         */
        showInformationMessage(message) {
            return this.showNotification(message, NotificationType.INFO);
        },

        /**
         * 显示成功通知
         * @param {string} message - 消息内容
         * @returns {*}
         */
        showSuccessMessage(message) {
            return this.showNotification(message, NotificationType.SUCCESS);
        },

        /**
         * 显示警告通知
         * @param {string} message - 消息内容
         * @returns {*}
         */
        showWarningMessage(message) {
            return this.showNotification(message, NotificationType.WARNING);
        },

        /**
         * 显示错误通知
         * @param {string} message - 消息内容
         * @returns {*}
         */
        showErrorMessage(message) {
            return this.showNotification(message, NotificationType.ERROR);
        },

        /**
         * 显示确认对话框
         * @param {string} message - 消息内容
         * @param {Object} [options={}] - 对话框选项
         * @returns {Promise<boolean>} 用户是否确认
         */
        async showConfirmDialog(message, options = {}) {
            Validator.assertNonEmptyString(message, 'message');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const title = options.title || '确认';
                const confirmText = options.confirmText || '确定';
                const cancelText = options.cancelText || '取消';

                // TODO: 实现自定义对话框组件
                return window.confirm(`${title}\n\n${message}`);
            }, 'ui.showConfirmDialog');
        },

        /**
         * 显示输入框
         * @param {Object} options - 输入框选项
         * @returns {Promise<string|null>} 用户输入的内容，取消则返回 null
         */
        async showInputBox(options = {}) {
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const prompt = options.prompt || '请输入';
                const defaultValue = options.value || '';
                const placeholder = options.placeholder || '';

                // TODO: 实现自定义输入框组件
                const result = window.prompt(prompt, defaultValue);
                return result;
            }, 'ui.showInputBox');
        },

        /**
         * 显示快速选择列表
         * @param {Array<string|Object>} items - 选项列表
         * @param {Object} [options={}] - 选择器选项
         * @returns {Promise<string|Object|null>} 用户选择的项，取消则返回 null
         */
        async showQuickPick(items, options = {}) {
            Validator.assertNonEmptyArray(items, 'items');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const placeholder = options.placeholder || '请选择';

                // TODO: 实现自定义快速选择组件
                const itemLabels = items.map(item =>
                    typeof item === 'string' ? item : (item.label || String(item))
                );

                const selectedLabel = window.prompt(
                    `${placeholder}\n可选项: ${itemLabels.join(', ')}`
                );

                if (selectedLabel === null) {
                    return null;
                }

                const index = itemLabels.indexOf(selectedLabel);
                return index !== -1 ? items[index] : null;
            }, 'ui.showQuickPick');
        },

        /**
         * 显示进度提示
         * @param {Object} options - 进度选项
         * @param {Function} task - 任务函数
         * @returns {Promise<*>} 任务结果
         */
        async withProgress(options, task) {
            Validator.assertObject(options, 'options');
            Validator.assertFunction(task, 'task');

            return ErrorUtils.wrapAsync(async () => {
                const title = options.title || '处理中...';
                const cancellable = options.cancellable || false;

                // TODO: 实现自定义进度提示组件
                console.log(`[Progress] ${title}`);

                const progress = {
                    report(value) {
                        if (typeof value === 'object' && value.message) {
                            console.log(`[Progress] ${value.message}`);
                        }
                    }
                };

                try {
                    const result = await task(progress);
                    console.log(`[Progress] 完成`);
                    return result;
                } catch (error) {
                    console.error(`[Progress] 失败:`, error);
                    throw error;
                }
            }, 'ui.withProgress');
        },

        /**
         * 获取当前主题
         * @returns {string} 当前主题名称 ('light' 或 'dark')
         */
        getCurrentTheme() {
            return ErrorUtils.wrapSync(() => {
                return theme.current;
            }, 'ui.getCurrentTheme');
        },

        /**
         * 设置主题
         * @param {string} themeName - 主题名称 ('light' 或 'dark')
         * @returns {*}
         */
        setTheme(themeName) {
            Validator.assertNonEmptyString(themeName, 'themeName');

            return ErrorUtils.wrapSync(() => {
                theme.set(themeName);
            }, 'ui.setTheme');
        },

        /**
         * 切换主题
         * @returns {*}
         */
        toggleTheme() {
            return ErrorUtils.wrapSync(() => {
                theme.toggle();
            }, 'ui.toggleTheme');
        },

        /**
         * 监听主题变化
         * @param {Function} callback - 回调函数，接收新主题名称作为参数
         * @returns {Disposable} 可释放对象
         */
        onThemeChanged(callback) {
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                theme.on('change', callback);
                return toDisposable(() => {
                    theme.off('change', callback);
                });
            }, 'ui.onThemeChanged');
        },

        /**
         * 设置 CSS 变量
         * @param {string} name - CSS 变量名（不包含 --）
         * @param {string} value - CSS 变量值
         * @returns {*}
         */
        setCSSVariable(name, value) {
            Validator.assertNonEmptyString(name, 'name');
            Validator.assertNonEmptyString(value, 'value');

            return ErrorUtils.wrapSync(() => {
                document.documentElement.style.setProperty(`--${name}`, value);
            }, 'ui.setCSSVariable');
        },

        /**
         * 获取 CSS 变量
         * @param {string} name - CSS 变量名（不包含 --）
         * @returns {string} CSS 变量值
         */
        getCSSVariable(name) {
            Validator.assertNonEmptyString(name, 'name');

            return ErrorUtils.wrapSync(() => {
                return getComputedStyle(document.documentElement)
                    .getPropertyValue(`--${name}`).trim();
            }, 'ui.getCSSVariable');
        },

        /**
         * 注册设置页导航项
         * @param {string} id - 导航项唯一标识
         * @param {string} label - 导航项显示文本
         * @param {Object} [options={}] - 可选配置
         * @returns {Disposable} 可释放对象
         */
        registerSettingsSection(id, label, options = {}) {
            Validator.assertNonEmptyString(id, 'id');
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.registerSection(id, label, options);
            }, 'ui.registerSettingsSection');
        },

        /**
         * 注册设置页内容
         * @param {string} sectionId - 对应的导航项ID
         * @param {Function} renderFunction - 渲染函数，接收容器元素作为参数
         * @returns {Disposable} 可释放对象
         */
        registerSettingsPage(sectionId, renderFunction) {
            Validator.assertNonEmptyString(sectionId, 'sectionId');
            Validator.assertFunction(renderFunction, 'renderFunction');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.registerPage(sectionId, renderFunction);
            }, 'ui.registerSettingsPage');
        },

        /**
         * 创建开关设置项
         * @param {string} label - 设置项标签
         * @param {string} description - 设置项描述
         * @param {boolean} defaultValue - 默认值
         * @param {Function} onChange - 值变化回调
         * @returns {HTMLElement} 设置项DOM元素
         */
        createToggleSetting(label, description, defaultValue, onChange) {
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertNonEmptyString(description, 'description');
            Validator.assertBoolean(defaultValue, 'defaultValue');
            Validator.assertFunction(onChange, 'onChange');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.createToggleSetting(label, description, defaultValue, onChange);
            }, 'ui.createToggleSetting');
        },

        /**
         * 创建下拉选择设置项
         * @param {string} label - 设置项标签
         * @param {string} description - 设置项描述
         * @param {Array<{value: string, label: string}>|Array<string>} options - 选项列表
         * @param {string} defaultValue - 默认值
         * @param {Function} onChange - 值变化回调
         * @returns {HTMLElement} 设置项DOM元素
         */
        createSelectSetting(label, description, options, defaultValue, onChange) {
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertNonEmptyString(description, 'description');
            Validator.assertNonEmptyArray(options, 'options');
            Validator.assertNonEmptyString(defaultValue, 'defaultValue');
            Validator.assertFunction(onChange, 'onChange');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.createSelectSetting(label, description, options, defaultValue, onChange);
            }, 'ui.createSelectSetting');
        },

        /**
         * 创建文本输入设置项
         * @param {string} label - 设置项标签
         * @param {string} description - 设置项描述
         * @param {string} defaultValue - 默认值
         * @param {Function} onChange - 值变化回调
         * @param {Object} [options={}] - 可选配置
         * @returns {HTMLElement} 设置项DOM元素
         */
        createInputSetting(label, description, defaultValue, onChange, options = {}) {
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertNonEmptyString(description, 'description');
            Validator.assertString(defaultValue, 'defaultValue');
            Validator.assertFunction(onChange, 'onChange');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.createInputSetting(label, description, defaultValue, onChange, options);
            }, 'ui.createInputSetting');
        },

        /**
         * 创建颜色选择器设置项
         * @param {string} label - 设置项标签
         * @param {string} description - 设置项描述
         * @param {string} defaultValue - 默认颜色值（十六进制）
         * @param {Function} onChange - 值变化回调
         * @returns {HTMLElement} 设置项DOM元素
         */
        createColorPickerSetting(label, description, defaultValue, onChange) {
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertNonEmptyString(description, 'description');
            Validator.assertNonEmptyString(defaultValue, 'defaultValue');
            Validator.assertFunction(onChange, 'onChange');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.createColorPickerSetting(label, description, defaultValue, onChange);
            }, 'ui.createColorPickerSetting');
        },

        /**
         * 创建按钮设置项
         * @param {string} label - 设置项标签
         * @param {string} description - 设置项描述
         * @param {string} buttonText - 按钮文本
         * @param {Function} onClick - 点击回调
         * @param {Object} [options={}] - 可选配置
         * @returns {HTMLElement} 设置项DOM元素
         */
        createButtonSetting(label, description, buttonText, onClick, options = {}) {
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertNonEmptyString(description, 'description');
            Validator.assertNonEmptyString(buttonText, 'buttonText');
            Validator.assertFunction(onClick, 'onClick');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.createButtonSetting(label, description, buttonText, onClick, options);
            }, 'ui.createButtonSetting');
        }
    };
}
