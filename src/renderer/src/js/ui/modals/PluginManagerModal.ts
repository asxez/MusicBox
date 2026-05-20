/**
 * 插件管理模态框组件
 */

import {showToast} from "@utils/index.js";
import {Component} from "@ui/base/Component";
import {
    pluginManagerService,
    type PluginExtension
} from "@js/features/extensions/service";
import {appConfirmationService} from "@js/features/appShell/service";
import type {ConfirmOptions} from "@js/shared/types/AppContracts";

type ToastType = 'info' | 'success' | 'error' | 'warning';

class PluginManagerModal extends Component {
    isVisible: boolean;
    listenersSetup: boolean;
    closeBtn!: HTMLElement | null;
    installBtn!: HTMLElement | null;
    pluginListLoading!: HTMLElement | null;
    pluginList!: HTMLElement | null;
    pluginListEmpty!: HTMLElement | null;

    constructor() {
        super('#plugin-manager-modal');
        this.isVisible = false;
        this.listenersSetup = false;
    }

    async show(): Promise<void> {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }

        this.isVisible = true;
        const modal = this.element as HTMLElement;
        modal.style.display = 'flex';

        // 动画显示
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });

        // 加载插件列表
        await this.loadPluginList();
    }

    hide(): void {
        this.isVisible = false;
        const modal = this.element as HTMLElement;
        modal.classList.remove('show');
        setTimeout(() => {
            if (!this.isVisible) {
                modal.style.display = 'none';
            }
        }, 300);
    }

    destroy(): void {
        this.isVisible = false;
        this.listenersSetup = false;
        super.destroy();
    }

    setupElements(): void {
        const modal = this.element as HTMLElement;

        // 模态框元素
        this.closeBtn = modal.querySelector('#plugin-manager-modal-close');
        this.installBtn = modal.querySelector('#install-extension-modal-btn');

        // 插件列表元素
        this.pluginListLoading = modal.querySelector('#plugin-list-loading');
        this.pluginList = modal.querySelector('#plugin-list');
        this.pluginListEmpty = modal.querySelector('#plugin-list-empty');
    }

    setupEventListeners(): void {
        // 关闭按钮
        if (this.closeBtn) {
            this.addEventListenerManaged(this.closeBtn, 'click', () => {
                this.hide();
            });
        }

        // 安装按钮
        if (this.installBtn) {
            this.addEventListenerManaged(this.installBtn, 'click', async () => {
                await this.handleInstallExtension();
            });
        }

        if (this.pluginList) {
            this.addEventListenerManaged(this.pluginList, 'click', async (event: Event) => {
                await this.handlePluginListAction(event.target);
            });
        }

        // ESC 键关闭
        this.addEventListenerManaged(document, 'keydown', (event) => {
            const keyboardEvent = event as KeyboardEvent;
            if (keyboardEvent.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * 加载插件列表
     */
    async loadPluginList(): Promise<void> {
        try {
            if (!pluginManagerService.isAvailable()) {
                console.warn('⚠️ PluginManagerModal: 扩展服务未初始化');
                return;
            }

            if (!this.pluginListLoading || !this.pluginList || !this.pluginListEmpty) {
                return;
            }

            // 显示加载状态
            this.pluginListLoading.style.display = 'block';
            this.pluginList.style.display = 'none';
            this.pluginListEmpty.style.display = 'none';

            // 获取所有扩展
            const extensions = pluginManagerService.getExtensions();

            if (extensions.length === 0) {
                this.pluginListLoading.style.display = 'none';
                this.pluginListEmpty.style.display = 'block';
                return;
            }

            // 渲染扩展列表
            this.renderPluginList(extensions);

            this.pluginListLoading.style.display = 'none';
            this.pluginList.style.display = 'block';

        } catch (error) {
            console.error('❌ PluginManagerModal: 加载插件列表失败:', error);
            if (this.pluginListLoading) {
                this.pluginListLoading.style.display = 'none';
            }
            if (this.pluginListEmpty) {
                this.pluginListEmpty.style.display = 'block';
            }
        }
    }

    /**
     * 渲染插件列表
     */
    renderPluginList(extensions: PluginExtension[]): void {
        if (!this.pluginList) {
            return;
        }

        const pluginList = this.pluginList;
        pluginList.innerHTML = '';

        extensions.forEach(ext => {
            const pluginCard = this.createPluginCard(ext);
            pluginList.appendChild(pluginCard);
        });
    }

    /**
     * 创建插件卡片
     */
    createPluginCard(extension: PluginExtension): HTMLElement {
        const card = document.createElement('div');
        card.className = 'plugin-card';

        const isActive = extension.isActive || false;
        const isBuiltin = extension.isBuiltin || false;
        const isEnabled = extension.enabled !== false;
        // canDisable: 是否允许被禁用（内置扩展需要检查此属性，外部扩展始终可禁用）
        const canDisable = extension.canDisable !== false;

        card.innerHTML = `
            <div class="plugin-card-content">
                <div class="plugin-info">
                    <div class="plugin-header">
                        <h3 class="plugin-name">
                            ${this.escapeHtml(extension.name || extension.id)}
                        </h3>
                        ${isBuiltin ? '<span class="plugin-badge plugin-badge-builtin">内置</span>' : ''}
                        ${isActive ? '<span class="plugin-badge plugin-badge-active">已激活</span>' : '<span class="plugin-badge plugin-badge-inactive">未激活</span>'}
                        ${!isEnabled ? '<span class="plugin-badge plugin-badge-disabled">已禁用</span>' : ''}
                    </div>
                    <p class="plugin-description">
                        ${this.escapeHtml(extension.description || '无描述')}
                    </p>
                    <div class="plugin-meta">
                        <span class="plugin-meta-item">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                            </svg>
                            版本 ${this.escapeHtml(extension.version || '未知')}
                        </span>
                        ${extension.author ? `
                            <span class="plugin-meta-item">
                                <svg class="icon" viewBox="0 0 24 24">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                                </svg>
                                ${this.escapeHtml(extension.author)}
                            </span>
                        ` : ''}
                    </div>
                </div>
                <div class="plugin-actions">
                    ${canDisable ? `
                        ${isEnabled ? `
                            <button class="btn-secondary" data-action="disable" data-id="${this.escapeAttribute(extension.id)}">
                                禁用
                            </button>
                        ` : `
                            <button class="btn-primary" data-action="enable" data-id="${this.escapeAttribute(extension.id)}">
                                启用
                            </button>
                        `}
                    ` : ''}
                    ${!isBuiltin ? `
                        <button class="btn-danger" data-action="uninstall" data-id="${this.escapeAttribute(extension.id)}">
                            卸载
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        return card;
    }

    private async handlePluginListAction(target: EventTarget | null): Promise<void> {
        const actionButton = target instanceof Element ?
            target.closest<HTMLElement>('[data-action][data-id]') :
            null;

        if (!actionButton) {
            return;
        }

        const extensionId = actionButton.dataset.id;
        const action = actionButton.dataset.action;
        if (!extensionId || !action) {
            return;
        }

        const extensionName = this.getExtensionName(extensionId);
        switch (action) {
            case 'enable':
                await this.handleEnableExtension(extensionId, extensionName);
                break;
            case 'disable':
                await this.handleDisableExtension(extensionId, extensionName);
                break;
            case 'uninstall':
                await this.handleUninstallExtension(extensionId, extensionName);
                break;
        }
    }

    /**
     * 处理安装扩展
     */
    async handleInstallExtension(): Promise<void> {
        try {
            if (!pluginManagerService.isAvailable()) {
                this.showNotification('扩展服务未初始化', 'error');
                return;
            }

            await pluginManagerService.selectAndInstallExtension();

            // 刷新插件列表
            await this.loadPluginList();
        } catch (error) {
            console.error('❌ PluginManagerModal: 安装扩展失败:', error);
            this.showNotification(`安装失败: ${this.getErrorMessage(error)}`, 'error');
        }
    }

    /**
     * 处理启用扩展
     */
    async handleEnableExtension(extensionId: string, _extensionName: string): Promise<void> {
        try {
            if (!pluginManagerService.isAvailable()) {
                this.showNotification('扩展服务未初始化', 'error');
                return;
            }

            await pluginManagerService.enableExtension(extensionId);
            await this.loadPluginList();
        } catch (error) {
            console.error('❌ PluginManagerModal: 启用扩展失败:', error);
            this.showNotification(`启用失败: ${this.getErrorMessage(error)}`, 'error');
        }
    }

    /**
     * 处理禁用扩展
     */
    async handleDisableExtension(extensionId: string, _extensionName: string): Promise<void> {
        try {
            if (!pluginManagerService.isAvailable()) {
                this.showNotification('扩展服务未初始化', 'error');
                return;
            }

            await pluginManagerService.disableExtension(extensionId);
            await this.loadPluginList();
        } catch (error) {
            console.error('❌ PluginManagerModal: 禁用扩展失败:', error);
            this.showNotification(`禁用失败: ${this.getErrorMessage(error)}`, 'error');
        }
    }

    /**
     * 处理卸载扩展
     */
    async handleUninstallExtension(extensionId: string, extensionName: string): Promise<void> {
        try {
            if (!pluginManagerService.isAvailable()) {
                this.showNotification('扩展服务未初始化', 'error');
                return;
            }

            const confirmOptions: ConfirmOptions = {
                title: '卸载扩展',
                message: `确定要卸载扩展 "${extensionName}" 吗？\n\n卸载后需要重启应用才能完全移除。`,
                confirmText: '卸载',
                type: 'warning'
            };
            const confirmed = await appConfirmationService.confirm(confirmOptions);

            if (!confirmed) {
                return;
            }

            await pluginManagerService.uninstallExtension(extensionId);
            await this.loadPluginList();
        } catch (error) {
            console.error('❌ PluginManagerModal: 卸载扩展失败:', error);
            this.showNotification(`卸载失败: ${this.getErrorMessage(error)}`, 'error');
        }
    }

    /**
     * 显示通知消息
     */
    showNotification(message: string, type: ToastType = 'info'): void {
        showToast(message, type);
    }

    /**
     * HTML转义
     */
    escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeAttribute(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private getExtensionName(extensionId: string): string {
        const extension = pluginManagerService.getExtensions().find((item) => item.id === extensionId);
        return extension?.name || extension?.id || extensionId;
    }

    getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export {PluginManagerModal};
