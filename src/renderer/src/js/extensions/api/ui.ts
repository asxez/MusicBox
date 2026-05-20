/**
 * UI API - 用户界面 API
 * 提供通知、对话框、状态栏、进度提示等 UI 交互功能
 */

import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils} from '@extensions/api/common/errors';
import {IDisposable, toDisposable} from '@extensions/core/Lifecycle';
import {onDOMReady, showToast, theme} from '@js/utils';
import {appConfirmationService} from "@js/features/appShell/service";
import {settingsExtensionNavigationService} from "@js/features/settings/service";
import {ExtensionContext} from "@extensions/core";
import {
    ButtonSettingOptions,
    ChoiceGridOption,
    ConfirmDialogOptions,
    FloatingPanelItem,
    FloatingPanelOptions,
    InputBoxOptions,
    InputSettingOptions,
    NotificationTypeValue,
    RegisterSectionOptions,
    SectionConfig,
    SelectOption,
    SettingsContributionItem,
    SettingsContributionPage,
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

class FloatingPanelManagerClass {
    private panels: Map<string, FloatingPanelOptions> = new Map();
    private container: HTMLElement | null = null;
    private openPanelId: string | null = null;
    private documentClickHandler: ((event: MouseEvent) => void) | null = null;

    registerPanel(options: FloatingPanelOptions): IDisposable {
        if (this.panels.has(options.id)) {
            console.warn(`浮动面板 ${options.id} 已存在，将被覆盖`);
        }

        this.panels.set(options.id, options);
        this._render();

        return toDisposable(() => {
            this.panels.delete(options.id);
            if (this.openPanelId === options.id) {
                this.openPanelId = null;
            }
            this._render();
        });
    }

    private _render(): void {
        const container = this._getContainer();
        container.innerHTML = '';

        const panels = Array.from(this.panels.values()).sort((a, b) => (a.order || 100) - (b.order || 100));
        container.hidden = panels.length === 0;

        for (const panel of panels) {
            const shell = document.createElement('div');
            shell.className = 'extension-floating-panel-shell';
            shell.dataset.panelId = panel.id;

            const panelElement = this._createPanelElement(panel);
            shell.appendChild(panelElement);

            const button = this._createButton(panel);
            shell.appendChild(button);

            container.appendChild(shell);
        }
    }

    private _createButton(panel: FloatingPanelOptions): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'extension-floating-panel-button';
        button.title = panel.buttonTitle || panel.title;
        button.setAttribute('aria-label', panel.buttonTitle || panel.title);
        button.setAttribute('aria-expanded', String(this.openPanelId === panel.id));

        const icon = document.createElement('span');
        icon.className = 'extension-floating-panel-button-label';
        icon.textContent = panel.buttonLabel || '•';
        button.appendChild(icon);

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.openPanelId = this.openPanelId === panel.id ? null : panel.id;
            this._render();
        });

        return button;
    }

    private _createPanelElement(panel: FloatingPanelOptions): HTMLElement {
        const panelElement = document.createElement('div');
        panelElement.className = 'extension-floating-panel';
        panelElement.hidden = this.openPanelId !== panel.id;

        const header = document.createElement('div');
        header.className = 'extension-floating-panel-header';

        const title = document.createElement('h3');
        title.className = 'extension-floating-panel-title';
        title.textContent = panel.panelTitle || panel.title;
        header.appendChild(title);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'extension-floating-panel-close';
        closeButton.textContent = 'x';
        closeButton.setAttribute('aria-label', '关闭');
        closeButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.openPanelId = null;
            this._render();
        });
        header.appendChild(closeButton);

        panelElement.appendChild(header);

        const list = document.createElement('div');
        list.className = 'extension-floating-panel-list';

        for (const item of panel.items) {
            list.appendChild(this._createPanelItem(panel, item));
        }

        panelElement.appendChild(list);

        return panelElement;
    }

    private _createPanelItem(panel: FloatingPanelOptions, item: FloatingPanelItem): HTMLButtonElement {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'extension-floating-panel-item';
        option.classList.toggle('active', panel.selectionMode === 'single' && !!item.selected);
        option.dataset.itemId = item.id;

        const swatches = this._getSafeFloatingPanelSwatches(item);
        if (swatches.length > 0) {
            const preview = document.createElement('span');
            preview.className = 'extension-floating-panel-swatches';

            for (const color of swatches.slice(0, 4)) {
                const swatch = document.createElement('span');
                swatch.className = 'extension-floating-panel-swatch';
                swatch.style.background = color;
                preview.appendChild(swatch);
            }

            option.appendChild(preview);
        }

        const content = document.createElement('span');
        content.className = 'extension-floating-panel-item-content';

        const label = document.createElement('span');
        label.className = 'extension-floating-panel-item-label';
        label.textContent = item.label;
        content.appendChild(label);

        if (item.description) {
            const description = document.createElement('span');
            description.className = 'extension-floating-panel-item-description';
            description.textContent = item.description;
            content.appendChild(description);
        }

        option.appendChild(content);

        if (panel.selectionMode === 'single' && item.selected) {
            const check = document.createElement('span');
            check.className = 'extension-floating-panel-check';
            check.textContent = '✓';
            option.appendChild(check);
        }

        option.addEventListener('click', () => {
            Promise.resolve(this._runPanelItem(panel, item)).catch(error => {
                console.error(`执行浮动面板条目 ${panel.id}/${item.id} 失败:`, error);
            });
        });

        return option;
    }

    private async _runPanelItem(panel: FloatingPanelOptions, item: FloatingPanelItem): Promise<void> {
        if (typeof item.onClick === 'function') {
            await item.onClick(item.id);
        }

        if (panel.selectionMode === 'single') {
            for (const candidate of panel.items) {
                candidate.selected = candidate.id === item.id;
            }
        }

        if (panel.closeOnSelect !== false) {
            this.openPanelId = null;
        }

        this._render();
    }

    private _getContainer(): HTMLElement {
        if (this.container && document.body.contains(this.container)) {
            return this.container;
        }

        this.container = document.createElement('div');
        this.container.className = 'extension-floating-panels';
        this.container.hidden = true;
        document.body.appendChild(this.container);
        this._ensureDocumentClickHandler();
        return this.container;
    }

    private _ensureDocumentClickHandler(): void {
        if (this.documentClickHandler) {
            return;
        }

        this.documentClickHandler = (event: MouseEvent) => {
            if (!this.openPanelId || !this.container || this.container.contains(event.target as Node)) {
                return;
            }

            this.openPanelId = null;
            this._render();
        };

        document.addEventListener('click', this.documentClickHandler);
    }

    private _getSafeFloatingPanelSwatches(item: FloatingPanelItem): string[] {
        if (!Array.isArray(item.swatches)) {
            return [];
        }

        return item.swatches
            .filter(color => this._isSafeColor(color))
            .slice(0, 4);
    }

    private _isSafeColor(value: unknown): value is string {
        if (typeof value !== 'string') {
            return false;
        }

        const color = value.trim();
        return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)
            || /^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(color)
            || /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(color)
            || /^var\(--[a-zA-Z0-9-_]+\)$/.test(color);
    }
}

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
     * 注册可序列化设置页内容
     */
    registerPageSchema(sectionId: string, page: SettingsContributionPage): IDisposable {
        return this.registerPage(sectionId, (container) => this._renderSchemaPage(container, page));
    }

    /**
     * 渲染导航项到设置页侧边栏
     */
    private _renderSection(section: SectionConfig): void {
        const navList = document.querySelector('.settings-nav-list');
        if (!navList) return;

        // 检查是否已存在
        let navItem = this._findNavButton(section.id)?.parentElement;
        if (navItem && !(navItem as HTMLElement).dataset.extensionSection) {
            console.warn(`设置页导航项 ${section.id} 已存在于宿主设置页，已拒绝扩展覆盖`);
            return;
        }

        if (!navItem) {
            navItem = document.createElement('li');
            navItem.className = 'settings-nav-item';
            navItem.dataset.extensionSection = 'true';
        }

        const navBtn = document.createElement('button');
        navBtn.className = 'settings-nav-btn';
        navBtn.dataset.section = section.id;

        const navText = document.createElement('span');
        navText.className = 'nav-text';
        navText.textContent = section.label;
        navBtn.appendChild(navText);

        navItem.innerHTML = '';
        navItem.appendChild(navBtn);

        // 按order排序插入
        const sections = Array.from(this.sections.values()).sort((a, b) => a.order - b.order);
        const index = sections.findIndex(s => s.id === section.id);

        if (index === sections.length - 1) {
            navList.appendChild(navItem);
        } else {
            const nextSection = sections[index + 1];
            const nextNavItem = this._findNavButton(nextSection.id)?.parentElement;
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
        let sectionElement = this._findSectionElement(sectionId);
        if (sectionElement && !sectionElement.dataset.extensionSection) {
            console.warn(`设置页内容 ${sectionId} 已存在于宿主设置页，已拒绝扩展覆盖`);
            return;
        }

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
        const navItem = this._findNavButton(id)?.parentElement as HTMLElement;
        if (navItem && navItem.dataset.extensionSection) {
            navItem.remove();
        }
    }

    /**
     * 移除页面内容
     */
    private _removePage(id: string): void {
        const sectionElement = this._findSectionElement(id);
        if (sectionElement && sectionElement.dataset.extensionSection) {
            sectionElement.remove();
        }
    }

    private _findNavButton(sectionId: string): HTMLButtonElement | null {
        const buttons = document.querySelectorAll<HTMLButtonElement>('.settings-nav-btn');
        return Array.from(buttons).find(button => button.dataset.section === sectionId) || null;
    }

    private _findSectionElement(sectionId: string): HTMLElement | null {
        const sections = document.querySelectorAll<HTMLElement>('.settings-section');
        return Array.from(sections).find(section => section.dataset.section === sectionId) || null;
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

    private _renderSchemaPage(container: HTMLElement, page: SettingsContributionPage): void {
        for (const item of page.items) {
            const element = this._createSchemaSettingElement(item);
            if (element) {
                container.appendChild(element);
            }
        }
    }

    private _createSchemaSettingElement(item: SettingsContributionItem): HTMLElement | null {
        const label = item.label;
        const description = item.description || '';
        const value = item.value ?? item.defaultValue;

        switch (item.type) {
            case 'toggle':
                return this.createToggleSetting(
                    label,
                    description,
                    typeof value === 'boolean' ? value : false,
                    nextValue => this._runContributionCallback(item.onChange, nextValue)
                );
            case 'select': {
                const options = Array.isArray(item.options) ? item.options : [];
                const defaultValue = typeof value === 'string' ? value : this._getFirstSelectValue(options);
                return this.createSelectSetting(
                    label,
                    description,
                    options,
                    defaultValue,
                    nextValue => this._runContributionCallback(item.onChange, nextValue)
                );
            }
            case 'input':
                return this.createInputSetting(
                    label,
                    description,
                    typeof value === 'string' ? value : '',
                    nextValue => this._runContributionCallback(item.onChange, nextValue),
                    {
                        type: item.inputType,
                        placeholder: item.placeholder,
                        min: item.min,
                        max: item.max,
                        step: item.step
                    }
                );
            case 'color':
                return this.createColorPickerSetting(
                    label,
                    description,
                    typeof value === 'string' ? value : '#000000',
                    nextValue => this._runContributionCallback(item.onChange, nextValue)
                );
            case 'button':
                return this.createButtonSetting(
                    label,
                    description,
                    item.buttonText || label,
                    () => this._runContributionCallback(item.onClick),
                    {secondary: item.secondary}
                );
            case 'choiceGrid':
                return this.createChoiceGridSetting(
                    label,
                    description,
                    Array.isArray(item.choices) ? item.choices : [],
                    typeof value === 'string' ? value : '',
                    nextValue => this._runContributionCallback(item.onChange, nextValue)
                );
            default:
                console.warn(`不支持的设置页贡献项类型: ${(item as SettingsContributionItem).type}`);
                return null;
        }
    }

    private _getFirstSelectValue(options: SelectOption[]): string {
        const first = options[0];
        if (!first) return '';
        return typeof first === 'string' ? first : first.value;
    }

    private _runContributionCallback(
        callback: ((value: boolean | string) => void | Promise<void>) | (() => void | Promise<void>) | undefined,
        value?: boolean | string
    ): void {
        if (typeof callback !== 'function') {
            return;
        }

        const result = value === undefined
            ? (callback as () => void | Promise<void>)()
            : (callback as (value: boolean | string) => void | Promise<void>)(value);

        Promise.resolve(result).catch(error => {
            console.error('执行设置页贡献回调失败:', error);
        });
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

    /**
     * 创建网格选择设置项
     */
    createChoiceGridSetting(
        label: string,
        description: string,
        choices: ChoiceGridOption[],
        defaultValue: string,
        onChange: (value: string) => void
    ): HTMLElement {
        const settingsItem = document.createElement('div');
        settingsItem.className = 'settings-item settings-choice-grid-item';

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

        const grid = document.createElement('div');
        grid.className = 'settings-choice-grid';

        const updateSelection = (selectedValue: string) => {
            grid.querySelectorAll<HTMLButtonElement>('.settings-choice-card').forEach(card => {
                card.classList.toggle('active', card.dataset.value === selectedValue);
            });
        };

        choices.forEach(choice => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'settings-choice-card';
            card.dataset.value = choice.value;

            const swatches = document.createElement('div');
            swatches.className = 'settings-choice-swatches';

            const colors = this._getSafeChoiceSwatches(choice);

            colors.slice(0, 4).forEach(color => {
                const swatch = document.createElement('span');
                swatch.className = 'settings-choice-swatch';
                swatch.style.background = color;
                swatches.appendChild(swatch);
            });

            const title = document.createElement('span');
            title.className = 'settings-choice-title';
            title.textContent = choice.label;

            card.appendChild(swatches);
            card.appendChild(title);

            if (choice.description) {
                const desc = document.createElement('span');
                desc.className = 'settings-choice-description';
                desc.textContent = choice.description;
                card.appendChild(desc);
            }

            card.addEventListener('click', () => {
                updateSelection(choice.value);
                onChange(choice.value);
            });

            grid.appendChild(card);
        });

        updateSelection(defaultValue);

        settingsItem.appendChild(itemInfo);
        settingsItem.appendChild(grid);

        return settingsItem;
    }

    private _getSafeChoiceSwatches(choice: ChoiceGridOption): string[] {
        const fallback = ['var(--color-primary)', 'var(--color-secondary-bg)'];
        if (!Array.isArray(choice.swatches)) {
            return fallback;
        }

        const safeColors = choice.swatches
            .filter(color => this._isSafeChoiceSwatchColor(color))
            .slice(0, 4);

        return safeColors.length > 0 ? safeColors : fallback;
    }

    private _isSafeChoiceSwatchColor(value: unknown): value is string {
        if (typeof value !== 'string') {
            return false;
        }

        const color = value.trim();
        return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)
            || /^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(color)
            || /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(color)
            || /^var\(--[a-zA-Z0-9-_]+\)$/.test(color);
    }
}

// 创建单例
const SettingsManager = new SettingsManagerClass();
const FloatingPanelManager = new FloatingPanelManagerClass();

// 初始化设置页管理器
onDOMReady(() => SettingsManager.initialize());

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
                const type = options.type === 'warning' || options.type === 'danger' || options.type === 'default'
                    ? options.type
                    : 'default';

                return await appConfirmationService.confirm({
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

        registerSettingsPageSchema(sectionId: string, page: SettingsContributionPage): IDisposable {
            Validator.assertNonEmptyString(sectionId, 'sectionId');
            Validator.assertObject(page, 'page');
            Validator.assertNonEmptyArray(page.items, 'page.items');

            for (const [index, item] of page.items.entries()) {
                Validator.assertObject(item, `page.items[${index}]`);
                Validator.assertNonEmptyString(item.id, `page.items[${index}].id`);
                Validator.assertEnum(
                    item.type,
                    ['toggle', 'select', 'input', 'color', 'button', 'choiceGrid'],
                    `page.items[${index}].type`
                );
                Validator.assertNonEmptyString(item.label, `page.items[${index}].label`);

                if (item.description !== undefined) {
                    Validator.assertString(item.description, `page.items[${index}].description`);
                }

                if (item.type === 'select') {
                    Validator.assertNonEmptyArray(item.options, `page.items[${index}].options`);
                }

                if (item.type === 'choiceGrid') {
                    Validator.assertNonEmptyArray(item.choices, `page.items[${index}].choices`);
                }
            }

            return ErrorUtils.wrapSync(() => {
                return SettingsManager.registerPageSchema(sectionId, page);
            }, 'ui.registerSettingsPageSchema');
        },

        registerFloatingPanel(options: FloatingPanelOptions): IDisposable {
            Validator.assertObject(options, 'options');
            Validator.assertNonEmptyString(options.id, 'options.id');
            Validator.assertNonEmptyString(options.title, 'options.title');
            Validator.assertNonEmptyArray(options.items, 'options.items');

            if (options.buttonLabel !== undefined) {
                Validator.assertNonEmptyString(options.buttonLabel, 'options.buttonLabel');
            }

            if (options.buttonTitle !== undefined) {
                Validator.assertNonEmptyString(options.buttonTitle, 'options.buttonTitle');
            }

            if (options.panelTitle !== undefined) {
                Validator.assertNonEmptyString(options.panelTitle, 'options.panelTitle');
            }

            if (options.order !== undefined) {
                Validator.assertNumber(options.order, 'options.order');
            }

            if (options.selectionMode !== undefined) {
                Validator.assertEnum(options.selectionMode, ['none', 'single'], 'options.selectionMode');
            }

            if (options.closeOnSelect !== undefined) {
                Validator.assertBoolean(options.closeOnSelect, 'options.closeOnSelect');
            }

            options.items.forEach((item, index) => {
                Validator.assertObject(item, `options.items[${index}]`);
                Validator.assertNonEmptyString(item.id, `options.items[${index}].id`);
                Validator.assertNonEmptyString(item.label, `options.items[${index}].label`);

                if (item.description !== undefined) {
                    Validator.assertString(item.description, `options.items[${index}].description`);
                }

                if (item.swatches !== undefined) {
                    Validator.assertArray(item.swatches, `options.items[${index}].swatches`);
                    Validator.assertArrayOfType(item.swatches, 'string', `options.items[${index}].swatches`);
                }

                if (item.selected !== undefined) {
                    Validator.assertBoolean(item.selected, `options.items[${index}].selected`);
                }

                if (item.onClick !== undefined) {
                    Validator.assertFunction(item.onClick, `options.items[${index}].onClick`);
                }
            });

            return ErrorUtils.wrapSync(() => {
                return FloatingPanelManager.registerPanel(options);
            }, 'ui.registerFloatingPanel');
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
