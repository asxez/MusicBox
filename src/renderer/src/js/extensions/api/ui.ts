/**
 * UI API - 用户界面 API
 * 提供通知、对话框、状态栏、进度提示等 UI 交互功能
 */

import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils} from '@extensions/api/common/errors';
import {IDisposable, toDisposable} from '@extensions/core/Lifecycle';
import {showToast, theme} from '@js/utils';
import {appInteractionService} from "@services/ui/AppInteractionService";
import {settingsExtensionNavigationService} from "@services/settings/SettingsExtensionNavigationService";
import {ExtensionContext} from "@extensions/core";
import {
    ButtonSettingOptions,
    ConfirmDialogOptions,
    InputBoxOptions,
    InputSettingOptions,
    NotificationTypeValue,
    RegisterSectionOptions,
    SectionConfig,
    SelectOption,
    Theme,
    UIAPI
} from "@extensions/api/types/ui";

/**
 * 通知类型枚举
 */
export const NotificationType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
} as const;

/**
 * 设置页管理器
 * 管理扩展贡献的设置页导航项和内容
 */
class SettingsManagerClass {
    private sections: Map<string, SectionConfig> = new Map();
    private pages: Map<string, (container: HTMLElement) => void> = new Map();
    private initialized: boolean = false;
    private observer: MutationObserver | null = null;

    /**
     * 初始化设置页管理器
     */
    initialize(): void {
        if (this.initialized) return;
        this.initialized = true;

        // 监听设置页显示事件，渲染扩展内容
        this._setupSettingsPageListener();
    }

    /**
     * 注册设置页导航项
     */
    registerSection(id: string, label: string, options: RegisterSectionOptions = {}): IDisposable {
        if (this.sections.has(id)) {
            console.warn(`设置页导航项 ${id} 已存在，将被覆盖`);
        }

        const section: SectionConfig = {
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
    registerPage(sectionId: string, renderFunction: (container: HTMLElement) => void): IDisposable {
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
    private _renderSection(section: SectionConfig): void {
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
            e.preventDefault();
            e.stopPropagation();
            const target = e.currentTarget as HTMLButtonElement;
            settingsExtensionNavigationService.navigateToSection(target.dataset.section!);
        });
    }

    /**
     * 渲染页面内容到设置页内容区
     */
    private _renderPage(sectionId: string): void {
        const sectionsContainer = document.querySelector('.settings-sections-container');
        if (!sectionsContainer) return;

        const renderFunction = this.pages.get(sectionId);
        if (!renderFunction) return;

        // 检查是否已存在
        let sectionElement = document.querySelector(`.settings-section[data-section="${sectionId}"]`) as HTMLElement;

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
    private _removeSection(id: string): void {
        const navItem = document.querySelector(`[data-section="${id}"]`)?.parentElement as HTMLElement;
        if (navItem && navItem.dataset.extensionSection) {
            navItem.remove();
        }
    }

    /**
     * 移除页面内容
     */
    private _removePage(id: string): void {
        const sectionElement = document.querySelector(`.settings-section[data-section="${id}"]`) as HTMLElement;
        if (sectionElement && sectionElement.dataset.extensionSection) {
            sectionElement.remove();
        }
    }

    /**
     * 监听设置页显示事件
     */
    private _setupSettingsPageListener(): void {
        // 使用MutationObserver监听设置页显示
        this.observer = new MutationObserver(() => {
            const settingsPage = document.getElementById('settings-page');
            if (settingsPage && settingsPage.style.display !== 'none') {
                // 设置页显示时，重新渲染所有扩展内容
                this.sections.forEach(section => this._renderSection(section));
                this.pages.forEach((_, sectionId) => this._renderPage(sectionId));
            }
        });

        const settingsPage = document.getElementById('settings-page');
        if (settingsPage) {
            this.observer.observe(settingsPage, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
    }

    /**
     * 创建开关设置项
     */
    createToggleSetting(label: string, description: string, defaultValue: boolean, onChange: (value: boolean) => void): HTMLElement {
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
            onChange((e.target as HTMLInputElement).checked);
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
    createSelectSetting(label: string, description: string, options: SelectOption[], defaultValue: string, onChange: (value: string) => void): HTMLElement {
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
            onChange((e.target as HTMLSelectElement).value);
        });

        itemControl.appendChild(select);

        settingsItem.appendChild(itemInfo);
        settingsItem.appendChild(itemControl);

        return settingsItem;
    }

    /**
     * 创建文本输入设置项
     */
    createInputSetting(label: string, description: string, defaultValue: string, onChange: (value: string) => void, options: InputSettingOptions = {}): HTMLElement {
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

        if (options.min !== undefined) input.min = String(options.min);
        if (options.max !== undefined) input.max = String(options.max);
        if (options.step !== undefined) input.step = String(options.step);

        input.addEventListener('change', (e) => {
            onChange((e.target as HTMLInputElement).value);
        });

        itemControl.appendChild(input);

        settingsItem.appendChild(itemInfo);
        settingsItem.appendChild(itemControl);

        return settingsItem;
    }

    /**
     * 创建颜色选择器设置项
     */
    createColorPickerSetting(label: string, description: string, defaultValue: string, onChange: (value: string) => void): HTMLElement {
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
            onChange((e.target as HTMLInputElement).value);
        });

        itemControl.appendChild(colorInput);

        settingsItem.appendChild(itemInfo);
        settingsItem.appendChild(itemControl);

        return settingsItem;
    }

    /**
     * 创建按钮设置项
     */
    createButtonSetting(label: string, description: string, buttonText: string, onClick: () => void, options: ButtonSettingOptions = {}): HTMLElement {
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
 * @param _context - 扩展上下文
 * @returns UI API 实例
 */
export function createUIAPI(_context: ExtensionContext): UIAPI {
    return {
        showNotification(message: string, type: NotificationTypeValue = NotificationType.INFO): void {
            Validator.assertNonEmptyString(message, 'message');
            Validator.assertEnum(type, Object.values(NotificationType), 'type');

            return ErrorUtils.wrapSync(() => {
                showToast(message, type);
            }, 'ui.showNotification');
        },

        showInformationMessage(message: string): void {
            return this.showNotification(message, NotificationType.INFO);
        },

        showSuccessMessage(message: string): void {
            return this.showNotification(message, NotificationType.SUCCESS);
        },

        showWarningMessage(message: string): void {
            return this.showNotification(message, NotificationType.WARNING);
        },

        showErrorMessage(message: string): void {
            return this.showNotification(message, NotificationType.ERROR);
        },

        async showConfirmDialog(message: string, options: ConfirmDialogOptions = {}): Promise<boolean> {
            Validator.assertNonEmptyString(message, 'message');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const title = options.title || '确认';
                const confirmText = options.confirmText || '确定';
                const cancelText = options.cancelText || '取消';
                const type = options.type || 'default';

                return await appInteractionService.confirm({
                    title: title,
                    message: message,
                    confirmText: confirmText,
                    cancelText: cancelText,
                    type: type
                });
            }, 'ui.showConfirmDialog');
        },

        async showInputBox(options: InputBoxOptions = {}): Promise<string | null> {
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const prompt = options.prompt || '请输入';
                const defaultValue = options.value || '';
                // const placeholder = options.placeholder || '';

                // TODO: 实现自定义输入框组件
                return window.prompt(prompt, defaultValue);
            }, 'ui.showInputBox');
        },

        getCurrentTheme(): string {
            return ErrorUtils.wrapSync(() => {
                return (theme as unknown as Theme).current;
            }, 'ui.getCurrentTheme');
        },

        setTheme(themeName: string): void {
            Validator.assertNonEmptyString(themeName, 'themeName');

            return ErrorUtils.wrapSync(() => {
                (theme as unknown as Theme).set(themeName);
            }, 'ui.setTheme');
        },

        toggleTheme(): void {
            return ErrorUtils.wrapSync(() => {
                (theme as unknown as Theme).toggle();
            }, 'ui.toggleTheme');
        },

        onThemeChanged(callback: (themeName: string) => void): IDisposable {
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                (theme as unknown as Theme).on('change', callback);
                return toDisposable(() => {
                    (theme as unknown as Theme).off('change', callback);
                });
            }, 'ui.onThemeChanged');
        },

        setCSSVariable(name: string, value: string): void {
            Validator.assertNonEmptyString(name, 'name');
            Validator.assertNonEmptyString(value, 'value');

            return ErrorUtils.wrapSync(() => {
                document.documentElement.style.setProperty(`--${name}`, value);
            }, 'ui.setCSSVariable');
        },

        getCSSVariable(name: string): string {
            Validator.assertNonEmptyString(name, 'name');

            return ErrorUtils.wrapSync(() => {
                return getComputedStyle(document.documentElement)
                    .getPropertyValue(`--${name}`).trim();
            }, 'ui.getCSSVariable');
        },

        registerSettingsSection(id: string, label: string, options: RegisterSectionOptions = {}): IDisposable {
            Validator.assertNonEmptyString(id, 'id');
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.registerSection(id, label, options);
            }, 'ui.registerSettingsSection');
        },

        registerSettingsPage(sectionId: string, renderFunction: (container: HTMLElement) => void): IDisposable {
            Validator.assertNonEmptyString(sectionId, 'sectionId');
            Validator.assertFunction(renderFunction, 'renderFunction');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.registerPage(sectionId, renderFunction);
            }, 'ui.registerSettingsPage');
        },

        createToggleSetting(label: string, description: string, defaultValue: boolean, onChange: (value: boolean) => void): HTMLElement {
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertNonEmptyString(description, 'description');
            Validator.assertBoolean(defaultValue, 'defaultValue');
            Validator.assertFunction(onChange, 'onChange');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.createToggleSetting(label, description, defaultValue, onChange);
            }, 'ui.createToggleSetting');
        },

        createSelectSetting(label: string, description: string, options: SelectOption[], defaultValue: string, onChange: (value: string) => void): HTMLElement {
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertNonEmptyString(description, 'description');
            Validator.assertNonEmptyArray(options, 'options');
            Validator.assertNonEmptyString(defaultValue, 'defaultValue');
            Validator.assertFunction(onChange, 'onChange');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.createSelectSetting(label, description, options, defaultValue, onChange);
            }, 'ui.createSelectSetting');
        },

        createInputSetting(label: string, description: string, defaultValue: string, onChange: (value: string) => void, options: InputSettingOptions = {}): HTMLElement {
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertNonEmptyString(description, 'description');
            Validator.assertString(defaultValue, 'defaultValue');
            Validator.assertFunction(onChange, 'onChange');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.createInputSetting(label, description, defaultValue, onChange, options);
            }, 'ui.createInputSetting');
        },

        createColorPickerSetting(label: string, description: string, defaultValue: string, onChange: (value: string) => void): HTMLElement {
            Validator.assertNonEmptyString(label, 'label');
            Validator.assertNonEmptyString(description, 'description');
            Validator.assertNonEmptyString(defaultValue, 'defaultValue');
            Validator.assertFunction(onChange, 'onChange');

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.createColorPickerSetting(label, description, defaultValue, onChange);
            }, 'ui.createColorPickerSetting');
        },

        createButtonSetting(label: string, description: string, buttonText: string, onClick: () => void, options: ButtonSettingOptions = {}): HTMLElement {
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
