/**
 * 插件管理模态框组件
 */

import {showToast} from "@utils";
import {Component} from "@components/base/Component";

class PluginManagerModal extends Component {
    constructor() {
        super('#plugin-manager-modal');
        this.isVisible = false;
        this.listenersSetup = false;
    }

    async show() {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }

        this.isVisible = true;
        this.element.style.display = 'flex';

        // 动画显示
        requestAnimationFrame(() => {
            this.element.classList.add('show');
        });

        // 加载插件列表
        await this.loadPluginList();
    }

    hide() {
        this.isVisible = false;
        this.element.classList.remove('show');
        setTimeout(() => {
            if (!this.isVisible) {
                this.element.style.display = 'none';
            }
        }, 300);
    }

    destroy() {
        this.isVisible = false;
        this.listenersSetup = false;
        super.destroy();
    }

    setupElements() {
        // 模态框元素
        this.closeBtn = this.element.querySelector('#plugin-manager-modal-close');
        this.installBtn = this.element.querySelector('#install-extension-modal-btn');

        // 插件列表元素
        this.pluginListLoading = this.element.querySelector('#plugin-list-loading');
        this.pluginList = this.element.querySelector('#plugin-list');
        this.pluginListEmpty = this.element.querySelector('#plugin-list-empty');
    }

    setupEventListeners() {
        // 关闭按钮
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.hide();
            });
        }

        // 安装按钮
        if (this.installBtn) {
            this.installBtn.addEventListener('click', async () => {
                await this.handleInstallExtension();
            });
        }

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * 加载插件列表
     */
    async loadPluginList() {
        try {
            if (!window.extensionService) {
                console.warn('⚠️ PluginManagerModal: 扩展服务未初始化');
                return;
            }

            // 显示加载状态
            this.pluginListLoading.style.display = 'block';
            this.pluginList.style.display = 'none';
            this.pluginListEmpty.style.display = 'none';

            // 获取所有扩展
            const extensions = window.extensionService.getExtensions();

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
            this.pluginListLoading.style.display = 'none';
            this.pluginListEmpty.style.display = 'block';
        }
    }

    /**
     * 渲染插件列表
     */
    renderPluginList(extensions) {
        this.pluginList.innerHTML = '';

        extensions.forEach(ext => {
            const pluginCard = this.createPluginCard(ext);
            this.pluginList.appendChild(pluginCard);
        });
    }

    /**
     * 创建插件卡片
     */
    createPluginCard(extension) {
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
                            <button class="btn-secondary" data-action="disable" data-id="${extension.id}">
                                禁用
                            </button>
                        ` : `
                            <button class="btn-primary" data-action="enable" data-id="${extension.id}">
                                启用
                            </button>
                        `}
                    ` : ''}
                    ${!isBuiltin ? `
                        <button class="btn-danger" data-action="uninstall" data-id="${extension.id}">
                            卸载
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        // 添加事件监听器
        const enableBtn = card.querySelector('[data-action="enable"]');
        if (enableBtn) {
            enableBtn.addEventListener('click', async () => {
                await this.handleEnableExtension(extension.id, extension.name);
            });
        }

        const disableBtn = card.querySelector('[data-action="disable"]');
        if (disableBtn) {
            disableBtn.addEventListener('click', async () => {
                await this.handleDisableExtension(extension.id, extension.name);
            });
        }

        const uninstallBtn = card.querySelector('[data-action="uninstall"]');
        if (uninstallBtn) {
            uninstallBtn.addEventListener('click', async () => {
                await this.handleUninstallExtension(extension.id, extension.name);
            });
        }

        return card;
    }

    /**
     * 处理安装扩展
     */
    async handleInstallExtension() {
        try {
            // 选择扩展包文件
            const filePath = await window.electronAPI.extensions.selectPackage();
            if (!filePath) {
                return;
            }

            console.log('📦 PluginManagerModal: 调用 ExtensionService.installExtensionFromFile');
            const extensionInfo = await window.extensionService.installExtensionFromFile(filePath);

            // 刷新插件列表
            await this.loadPluginList();
        } catch (error) {
            console.error('❌ PluginManagerModal: 安装扩展失败:', error);
            this.showNotification(`安装失败: ${error.message}`, 'error');
        }
    }

    /**
     * 处理启用扩展
     */
    async handleEnableExtension(extensionId, _extensionName) {
        try {
            await window.extensionService.enableExtension(extensionId);
            await this.loadPluginList();
        } catch (error) {
            console.error('❌ PluginManagerModal: 启用扩展失败:', error);
            this.showNotification(`启用失败: ${error.message}`, 'error');
        }
    }

    /**
     * 处理禁用扩展
     */
    async handleDisableExtension(extensionId, _extensionName) {
        try {
            await window.extensionService.disableExtension(extensionId);
            await this.loadPluginList();
        } catch (error) {
            console.error('❌ PluginManagerModal: 禁用扩展失败:', error);
            this.showNotification(`禁用失败: ${error.message}`, 'error');
        }
    }

    /**
     * 处理卸载扩展
     */
    async handleUninstallExtension(extensionId, extensionName) {
        try {
            const confirmed = confirm(`确定要卸载扩展 "${extensionName}" 吗？\n\n卸载后需要重启应用才能完全移除。`);
            if (!confirmed) {
                return;
            }

            await window.extensionService.uninstallExtensionFromDisk(extensionId);
            await this.loadPluginList();
        } catch (error) {
            console.error('❌ PluginManagerModal: 卸载扩展失败:', error);
            this.showNotification(`卸载失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示通知消息
     */
    showNotification(message, type = 'info') {
        showToast(message, type);
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export {PluginManagerModal};
