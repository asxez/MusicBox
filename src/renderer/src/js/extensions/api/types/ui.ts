import {NotificationType} from "@extensions/api";
import {IDisposable} from "@extensions/core";

export type NotificationTypeValue = typeof NotificationType[keyof typeof NotificationType];

/**
 * 设置页导航项配置
 */
export interface SectionConfig {
    id: string;
    label: string;
    order: number;
    icon: string | null;
}

/**
 * 设置页注册选项
 */
export interface RegisterSectionOptions {
    order?: number;
    icon?: string;
}

/**
 * 确认对话框选项
 */
export interface ConfirmDialogOptions {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    type?: string;
}

/**
 * 输入框选项
 */
export interface InputBoxOptions {
    prompt?: string;
    value?: string;
    placeholder?: string;
}

/**
 * 文本输入设置项选项
 */
export interface InputSettingOptions {
    type?: string;
    placeholder?: string;
    min?: number | string;
    max?: number | string;
    step?: number | string;
}

/**
 * 按钮设置项选项
 */
export interface ButtonSettingOptions {
    secondary?: boolean;
}

/**
 * 选择选项
 */
export type SelectOption = string | { value: string; label?: string };

/**
 * 网格选择项
 */
export interface ChoiceGridOption {
    value: string;
    label: string;
    description?: string;
    swatches?: string[];
}

/**
 * 可序列化设置页贡献项类型
 */
export type SettingsContributionItemType = 'toggle' | 'select' | 'input' | 'color' | 'button' | 'choiceGrid';

/**
 * 可序列化设置页贡献项
 */
export interface SettingsContributionItem {
    id: string;
    type: SettingsContributionItemType;
    label: string;
    description?: string;
    value?: boolean | string;
    defaultValue?: boolean | string;
    options?: SelectOption[];
    choices?: ChoiceGridOption[];
    inputType?: string;
    placeholder?: string;
    min?: number | string;
    max?: number | string;
    step?: number | string;
    buttonText?: string;
    secondary?: boolean;
    onChange?: (value: boolean | string) => void | Promise<void>;
    onClick?: () => void | Promise<void>;
}

/**
 * 可序列化设置页贡献
 */
export interface SettingsContributionPage {
    items: SettingsContributionItem[];
}

/**
 * 主题对象类型
 */
export interface Theme {
    current: string;

    set(themeName: string): void;

    toggle(): void;

    on(event: string, callback: (themeName: string) => void): void;

    off(event: string, callback: (themeName: string) => void): void;
}

/**
 * 应用对象类型
 */
export interface App {
    confirm(options: {
        title: string;
        message: string;
        confirmText: string;
        cancelText: string;
        type: string;
    }): Promise<boolean>;
}

/**
 * UI API 接口
 */
export interface UIAPI {
    /**
     * 显示通知
     * @param message - 消息内容
     * @param type - 类型 (info, success, warning, error)
     * @returns undefined
     */
    showNotification(message: string, type?: NotificationTypeValue): void;

    /**
     * 显示信息通知
     * @param message - 消息内容
     * @returns undefined
     */
    showInformationMessage(message: string): void;

    /**
     * 显示成功通知
     * @param message - 消息内容
     * @returns undefined
     */
    showSuccessMessage(message: string): void;

    /**
     * 显示警告通知
     * @param message - 消息内容
     * @returns undefined
     */
    showWarningMessage(message: string): void;

    /**
     * 显示错误通知
     * @param message - 消息内容
     * @returns undefined
     */
    showErrorMessage(message: string): void;

    /**
     * 显示确认对话框
     * @param message - 消息内容
     * @param options - 对话框选项
     * @returns 用户是否确认
     */
    showConfirmDialog(message: string, options?: ConfirmDialogOptions): Promise<boolean>;

    /**
     * 显示输入框
     * @param options - 输入框选项
     * @returns 用户输入的内容，取消则返回 null
     */
    showInputBox(options?: InputBoxOptions): Promise<string | null>;

    /**
     * 获取当前主题
     * @returns 当前主题名称 ('light' 或 'dark')
     */
    getCurrentTheme(): string;

    /**
     * 设置主题
     * @param themeName - 主题名称 ('light' 或 'dark')
     * @returns undefined
     */
    setTheme(themeName: string): void;

    /**
     * 切换主题
     * @returns undefined
     */
    toggleTheme(): void;

    /**
     * 监听主题变化
     * @param callback - 回调函数，接收新主题名称作为参数
     * @returns 可释放对象
     */
    onThemeChanged(callback: (themeName: string) => void): IDisposable;

    /**
     * 设置 CSS 变量
     * @param name - CSS 变量名（不包含 --）
     * @param value - CSS 变量值
     * @returns undefined
     */
    setCSSVariable(name: string, value: string): void;

    /**
     * 获取 CSS 变量
     * @param name - CSS 变量名（不包含 --）
     * @returns CSS 变量值
     */
    getCSSVariable(name: string): string;

    /**
     * 注册设置页导航项
     * @param id - 导航项唯一标识
     * @param label - 导航项显示文本
     * @param options - 可选配置
     * @returns 可释放对象
     */
    registerSettingsSection(id: string, label: string, options?: RegisterSectionOptions): IDisposable;

    /**
     * 注册设置页内容
     * @param sectionId - 对应的导航项ID
     * @param renderFunction - 渲染函数，接收容器元素作为参数
     * @returns 可释放对象
     */
    registerSettingsPage(sectionId: string, renderFunction: (container: HTMLElement) => void): IDisposable;

    /**
     * 注册可序列化设置页内容
     * @param sectionId - 对应的导航项ID
     * @param page - 设置页 schema
     * @returns 可释放对象
     */
    registerSettingsPageSchema(sectionId: string, page: SettingsContributionPage): IDisposable;

    /**
     * 创建开关设置项
     * @param label - 设置项标签
     * @param description - 设置项描述
     * @param defaultValue - 默认值
     * @param onChange - 值变化回调
     * @returns 设置项DOM元素
     */
    createToggleSetting(label: string, description: string, defaultValue: boolean, onChange: (value: boolean) => void): HTMLElement;

    /**
     * 创建下拉选择设置项
     * @param label - 设置项标签
     * @param description - 设置项描述
     * @param options - 选项列表
     * @param defaultValue - 默认值
     * @param onChange - 值变化回调
     * @returns 设置项DOM元素
     */
    createSelectSetting(label: string, description: string, options: SelectOption[], defaultValue: string, onChange: (value: string) => void): HTMLElement;

    /**
     * 创建文本输入设置项
     * @param label - 设置项标签
     * @param description - 设置项描述
     * @param defaultValue - 默认值
     * @param onChange - 值变化回调
     * @param options - 可选配置
     * @returns 设置项DOM元素
     */
    createInputSetting(label: string, description: string, defaultValue: string, onChange: (value: string) => void, options?: InputSettingOptions): HTMLElement;

    /**
     * 创建颜色选择器设置项
     * @param label - 设置项标签
     * @param description - 设置项描述
     * @param defaultValue - 默认颜色值（十六进制）
     * @param onChange - 值变化回调
     * @returns 设置项DOM元素
     */
    createColorPickerSetting(label: string, description: string, defaultValue: string, onChange: (value: string) => void): HTMLElement;

    /**
     * 创建按钮设置项
     * @param label - 设置项标签
     * @param description - 设置项描述
     * @param buttonText - 按钮文本
     * @param onClick - 点击回调
     * @param options - 可选配置
     * @returns 设置项DOM元素
     */
    createButtonSetting(label: string, description: string, buttonText: string, onClick: () => void, options?: ButtonSettingOptions): HTMLElement;
}
