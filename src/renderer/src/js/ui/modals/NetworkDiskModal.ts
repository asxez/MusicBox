/**
 * 网络磁盘配置模态框组件
 */

import {Component} from "@components/base/Component";
import {networkDriveManagementService} from "@services/networkDrive/NetworkDriveManagementService";
import type {ScanProgress} from "@api/types/events";
import type {MountedNetworkDrive, NetworkDriveConfig} from "@api/types/electron";
import type {Unsubscribe} from "@api/types/common";

type NotificationType = 'info' | 'success' | 'error' | 'warning';
type NetworkDriveProtocol = 'smb' | 'webdav' | string;

interface NetworkDriveNotification {
    message: string;
    type: NotificationType;
}

class NetworkDiskModal extends Component {
    isVisible: boolean;
    listenersSetup: boolean;
    networkDriveForm!: HTMLFormElement | null;
    networkDriveModalClose!: HTMLElement | null;
    networkDriveCancel!: HTMLElement | null;
    networkDriveConfirm!: HTMLButtonElement | null;
    testConnectionBtn!: HTMLButtonElement | null;
    driveNameInput!: HTMLInputElement | null;
    driveProtocolSelect!: HTMLSelectElement | null;
    driveUsernameInput!: HTMLInputElement | null;
    drivePasswordInput!: HTMLInputElement | null;
    smbConfig!: HTMLElement | null;
    smbHostInput!: HTMLInputElement | null;
    smbShareInput!: HTMLInputElement | null;
    smbDomainInput!: HTMLInputElement | null;
    webdavConfig!: HTMLElement | null;
    webdavUrlInput!: HTMLInputElement | null;
    connectionTestResult!: HTMLElement | null;
    testStatus!: HTMLElement | null;
    testMessage!: HTMLElement | null;
    mountedDrivesList!: HTMLElement | null;
    refreshDrivesBtn!: HTMLButtonElement | null;
    private networkDriveUnsubscribers: Unsubscribe[];

    constructor() {
        super('#network-drive-modal');
        this.isVisible = false;
        this.listenersSetup = false; // 事件监听器是否已设置
        this.networkDriveUnsubscribers = [];

        this.setupSettingsElements();
        this.initializeNetworkDriveManagement();
    }

    show(): void {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }

        this.isVisible = true;
        this.resetNetworkDriveForm();
        const modal = this.element as HTMLElement;
        modal.style.display = 'flex';

        // 动画显示
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });

        // 焦点管理
        if (this.driveNameInput) {
            this.driveNameInput.focus();
        }
    }

    hide(): void {
        this.isVisible = false;
        const modal = this.element as HTMLElement;
        modal.classList.remove('show');
        setTimeout(() => {
            if (!this.isVisible) {
                modal.style.display = 'none';
                this.resetNetworkDriveForm();
            }
        }, 300);
    }

    destroy(): void {
        this.isVisible = false;
        this.listenersSetup = false;
        this.networkDriveUnsubscribers.forEach(unsubscribe => unsubscribe());
        this.networkDriveUnsubscribers = [];
        super.destroy();
    }

    setupElements(): void {
        const modal = this.element as HTMLElement;

        // 模态框元素
        this.networkDriveForm = modal.querySelector('#network-drive-form');
        this.networkDriveModalClose = modal.querySelector('#network-drive-modal-close');
        this.networkDriveCancel = modal.querySelector('#network-drive-cancel');
        this.networkDriveConfirm = modal.querySelector('#network-drive-confirm');
        this.testConnectionBtn = modal.querySelector('#test-connection-btn');

        // 表单元素
        this.driveNameInput = modal.querySelector('#drive-name');
        this.driveProtocolSelect = modal.querySelector('#drive-protocol');
        this.driveUsernameInput = modal.querySelector('#drive-username');
        this.drivePasswordInput = modal.querySelector('#drive-password');

        // SMB配置元素
        this.smbConfig = modal.querySelector('#smb-config');
        this.smbHostInput = modal.querySelector('#smb-host');
        this.smbShareInput = modal.querySelector('#smb-share');
        this.smbDomainInput = modal.querySelector('#smb-domain');

        // WebDAV配置元素
        this.webdavConfig = modal.querySelector('#webdav-config');
        this.webdavUrlInput = modal.querySelector('#webdav-url');

        // 连接测试结果元素
        this.connectionTestResult = modal.querySelector('#connection-test-result');
        this.testStatus = this.connectionTestResult?.querySelector('.test-status') ?? null;
        this.testMessage = this.connectionTestResult?.querySelector('.test-message') ?? null;
    }

    setupSettingsElements(): void {
        // 网络磁盘管理相关元素
        this.mountedDrivesList = document.querySelector('#mounted-drives-list');
        this.refreshDrivesBtn = document.querySelector('#refresh-drives-btn');
    }

    setupEventListeners(): void {
        // 模态框关闭事件
        if (this.networkDriveModalClose) {
            this.addEventListenerManaged(this.networkDriveModalClose, 'click', () => {
                this.hide();
            });
        }

        // 取消按钮
        if (this.networkDriveCancel) {
            this.addEventListenerManaged(this.networkDriveCancel, 'click', () => {
                this.hide();
            });
        }

        // 协议选择变化事件
        if (this.driveProtocolSelect) {
            this.addEventListenerManaged(this.driveProtocolSelect, 'change', (e) => {
                const target = e.target as HTMLSelectElement;
                this.toggleProtocolConfig(target.value);
            });
        }

        // 测试连接按钮
        if (this.testConnectionBtn) {
            this.addEventListenerManaged(this.testConnectionBtn, 'click', async () => {
                await this.testConnection();
            });
        }

        // 表单提交事件
        if (this.networkDriveForm) {
            this.addEventListenerManaged(this.networkDriveForm, 'submit', async (e) => {
                e.preventDefault();
                await this.addNetworkDrive();
            });
        }

        this.addEventListenerManaged(document, 'keydown', (e) => {
            const event = e as KeyboardEvent;
            if (event.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    // 重置网络磁盘表单
    resetNetworkDriveForm(): void {
        if (this.networkDriveForm) {
            this.networkDriveForm.reset();
        }
        this.toggleProtocolConfig('');
        this.hideConnectionTestResult();
    }

    // 切换协议配置显示
    toggleProtocolConfig(protocol: NetworkDriveProtocol): void {
        if (this.smbConfig) {
            this.smbConfig.style.display = protocol === 'smb' ? 'block' : 'none';
        }
        if (this.webdavConfig) {
            this.webdavConfig.style.display = protocol === 'webdav' ? 'block' : 'none';
        }
    }

    // 显示连接测试结果
    showConnectionTestResult(success: boolean, message: string): void {
        if (!this.connectionTestResult || !this.testStatus || !this.testMessage) {
            return;
        }

        this.testStatus.className = `test-status ${success ? 'success' : 'error'}`;
        this.testStatus.textContent = success ? '✓' : '✗';
        this.testMessage.textContent = message;
        this.connectionTestResult.style.display = 'block';
    }

    // 隐藏连接测试结果
    hideConnectionTestResult(): void {
        if (this.connectionTestResult) {
            this.connectionTestResult.style.display = 'none';
        }
    }

    // 显示通知消息
    showNotification(message: string, type: NotificationType = 'info'): void {
        const notification: NetworkDriveNotification = {message, type};
        this.emit('notification', notification);
    }

    // 获取网络磁盘配置
    getNetworkDriveConfig(): NetworkDriveConfig | null {
        if (
            !this.driveProtocolSelect ||
            !this.driveNameInput ||
            !this.driveUsernameInput ||
            !this.drivePasswordInput
        ) {
            return null;
        }

        const protocol = this.driveProtocolSelect.value;
        const name = this.driveNameInput.value.trim();
        const username = this.driveUsernameInput.value.trim();
        const password = this.drivePasswordInput.value;

        if (!protocol || !name || !username || !password) {
            return null;
        }

        const config: NetworkDriveConfig = {
            id: `${protocol}_${Date.now()}`,
            type: protocol,
            displayName: name,
            username: username,
            password: password
        };

        if (protocol === 'smb') {
            if (!this.smbHostInput || !this.smbShareInput || !this.smbDomainInput) {
                return null;
            }

            const host = this.smbHostInput.value.trim();
            const share = this.smbShareInput.value.trim();
            const domain = this.smbDomainInput.value.trim();

            if (!host || !share) {
                return null;
            }

            config.host = host;
            config.share = share;
            config.domain = domain || 'WORKGROUP';
        } else if (protocol === 'webdav') {
            if (!this.webdavUrlInput) {
                return null;
            }

            const url = this.webdavUrlInput.value.trim();

            if (!url) {
                return null;
            }

            config.url = url;
        }

        return config;
    }

    // 测试连接
    async testConnection(): Promise<void> {
        const config = this.getNetworkDriveConfig();
        if (!config || !this.testConnectionBtn) {
            this.showConnectionTestResult(false, '请填写完整的配置信息');
            return;
        }

        this.testConnectionBtn.disabled = true;
        this.testConnectionBtn.textContent = '测试中...';

        try {
            const success = await networkDriveManagementService.testConnection(config);
            if (success) {
                this.showConnectionTestResult(true, '连接测试成功');
            } else {
                this.showConnectionTestResult(false, '连接测试失败');
            }
        } catch (error) {
            this.showConnectionTestResult(false, `连接测试失败: ${this.getErrorMessage(error)}`);
        } finally {
            this.testConnectionBtn.disabled = false;
            this.testConnectionBtn.textContent = '测试连接';
        }
    }

    // 添加网络磁盘
    async addNetworkDrive(): Promise<void> {
        const config = this.getNetworkDriveConfig();
        if (!config || !this.networkDriveConfirm) {
            this.showConnectionTestResult(false, '请填写完整的配置信息');
            return;
        }

        this.networkDriveConfirm.disabled = true;
        this.networkDriveConfirm.textContent = '添加中...';

        try {
            const success = await networkDriveManagementService.mount(config);

            if (success) {
                this.hide();
                this.emit('driveAdded', config);
                this.showNotification(`网络磁盘 "${config.displayName}" 添加成功`, 'success');
            } else {
                this.showConnectionTestResult(false, '网络磁盘添加失败');
            }
        } catch (error) {
            this.showConnectionTestResult(false, `添加失败: ${this.getErrorMessage(error)}`);
        } finally {
            this.networkDriveConfirm.disabled = false;
            this.networkDriveConfirm.textContent = '添加磁盘';
        }
    }

    // -------- 网络磁盘管理方法 --------

    // 初始化网络磁盘管理功能
    initializeNetworkDriveManagement(): void {
        // 设置刷新按钮事件监听器
        if (this.refreshDrivesBtn) {
            this.addEventListenerManaged(this.refreshDrivesBtn, 'click', async () => {
                await this.refreshNetworkDrivesStatus();
            });
        }

        // 监听网络磁盘事件
        this.networkDriveUnsubscribers.push(networkDriveManagementService.onConnected(async (driveId, config) => {
            await this.refreshMountedDrivesList();
            this.emit('driveConnected', driveId, config);
        }));

        this.networkDriveUnsubscribers.push(networkDriveManagementService.onDisconnected(async (driveId, config) => {
            await this.refreshMountedDrivesList();
            this.emit('driveDisconnected', driveId, config);
        }));

        this.networkDriveUnsubscribers.push(networkDriveManagementService.onError((_driveId, error) => {
            this.showNotification(`网络磁盘错误: ${error}`, 'error');
        }));

        // 初始加载磁盘列表
        this.refreshMountedDrivesList();
    }

    // 刷新已挂载的磁盘列表
    async refreshMountedDrivesList(): Promise<void> {
        try {
            const mountedDrives = await networkDriveManagementService.getMountedDrives();
            this.renderMountedDrivesList(mountedDrives);
        } catch (error) {
            console.error('❌ 获取挂载磁盘列表失败:', error);
        }
    }

    // 渲染已挂载的磁盘列表
    renderMountedDrivesList(drives: MountedNetworkDrive[] | null | undefined): void {
        if (!this.mountedDrivesList) {
            return;
        }

        if (!drives || drives.length === 0) {
            this.mountedDrivesList.innerHTML = '<div class="no-drives-message">暂无已挂载的网络磁盘</div>';
            return;
        }

        this.mountedDrivesList.innerHTML = drives.map(drive => {
            const statusClass = drive.connected ? 'connected' : 'disconnected';
            const statusText = drive.connected ? '已连接' : '已断开';
            const protocolText = drive.type === 'smb' ? 'SMB' : 'WebDAV';
            const displayName = drive.config?.displayName || drive.displayName || '未命名磁盘';

            return `
                <div class="mounted-drive-item" data-drive-id="${drive.id}">
                    <div class="drive-info">
                        <div class="drive-name">${this.escapeHtml(displayName)}</div>
                        <div class="drive-details">
                            <span class="drive-protocol">${protocolText}</span>
                            <span class="drive-status ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                    <div class="drive-actions">
                        <button class="btn btn-small btn-primary scan-drive-btn" data-drive-id="${drive.id}" ${!drive.connected ? 'disabled' : ''}>
                            扫描
                        </button>
                        <button class="btn btn-small btn-secondary unmount-drive-btn" data-drive-id="${drive.id}">
                            卸载
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 添加扫描按钮事件监听器
        this.mountedDrivesList.querySelectorAll<HTMLButtonElement>('.scan-drive-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const driveId = target.getAttribute('data-drive-id');
                await this.scanNetworkDrive(driveId);
            });
        });

        // 添加卸载按钮事件监听器
        this.mountedDrivesList.querySelectorAll<HTMLButtonElement>('.unmount-drive-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const driveId = target.getAttribute('data-drive-id');
                await this.unmountNetworkDrive(driveId);
            });
        });
    }

    // 扫描网络磁盘
    async scanNetworkDrive(driveId: string | null): Promise<void> {
        if (!driveId) {
            return;
        }

        // 禁用扫描按钮并显示进度提示
        this.showScanTip(driveId);

        // 监听扫描进度
        const removeListener = networkDriveManagementService.onScanProgress((progress) => {
            this.updateScanTip(driveId, progress);
        });

        try {
            const success = await networkDriveManagementService.scanNetworkDrive(driveId, '/');

            if (success) {
                this.showNotification('网络磁盘扫描完成', 'success');
            } else {
                this.showNotification('网络磁盘扫描失败', 'error');
            }
        } catch (error) {
            this.showNotification(`扫描失败: ${this.getErrorMessage(error)}`, 'error');
        } finally {
            removeListener();
            this.hideScanTip(driveId);
        }
    }

    showScanTip(driveId: string): void {
        const btn = this.mountedDrivesList?.querySelector<HTMLButtonElement>(`.scan-drive-btn[data-drive-id="${driveId}"]`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = '扫描中...';
        }

        const driveItem = this.mountedDrivesList?.querySelector(`.mounted-drive-item[data-drive-id="${driveId}"]`);
        if (!driveItem) return;

        const tip = document.createElement('div');
        tip.className = 'scan-tip';
        tip.dataset.scanTipDriveId = driveId;
        tip.innerHTML = `
            <div class="scan-tip-bar">
                <div class="scan-tip-fill" data-scan-fill="${driveId}"></div>
            </div>
            <p class="scan-tip-text" data-scan-text="${driveId}">⏳ 正在扫描网络磁盘...</p>
        `;
        driveItem.appendChild(tip);
    }

    updateScanTip(driveId: string, progress: ScanProgress): void {
        const fill = this.mountedDrivesList?.querySelector<HTMLElement>(`[data-scan-fill="${driveId}"]`);
        const text = this.mountedDrivesList?.querySelector<HTMLElement>(`[data-scan-text="${driveId}"]`);

        if (fill && text) {
            const {current, total} = this.normalizeScanProgress(progress);
            const percent = total > 0 ?
                (current / total) * 100 : 0;
            fill.style.width = `${percent}%`;
            text.textContent = `⏳ 扫描中: ${current}/${total}`;
        }
    }

    hideScanTip(driveId: string): void {
        const tip = this.mountedDrivesList?.querySelector(`[data-scan-tip-drive-id="${driveId}"]`);
        if (tip) tip.remove();

        const btn = this.mountedDrivesList?.querySelector<HTMLButtonElement>(`.scan-drive-btn[data-drive-id="${driveId}"]`);
        if (btn) {
            btn.disabled = false;
            btn.textContent = '扫描';
        }
    }

    // 卸载网络磁盘
    async unmountNetworkDrive(driveId: string | null): Promise<void> {
        if (!driveId) {
            return;
        }

        try {
            console.log(`🔄 NetworkDiskModal: 开始卸载网络磁盘 ${driveId}`);

            const success = await networkDriveManagementService.unmount(driveId);
            if (success) {
                console.log(`✅ NetworkDiskModal: 网络磁盘 ${driveId} 卸载成功`);

                // 刷新磁盘列表显示
                await this.refreshMountedDrivesList();

                // 显示成功通知
                this.showNotification('网络磁盘卸载成功', 'success');

                // 发送卸载事件
                this.emit('driveUnmounted', driveId);
            } else {
                console.error(`❌ NetworkDiskModal: 网络磁盘 ${driveId} 卸载失败`);
                this.showNotification('网络磁盘卸载失败', 'error');
            }
        } catch (error) {
            console.error(`❌ NetworkDiskModal: 卸载网络磁盘 ${driveId} 时发生异常:`, error);
            this.showNotification(`卸载失败: ${this.getErrorMessage(error)}`, 'error');
        }
    }

    // 刷新网络磁盘状态
    async refreshNetworkDrivesStatus(): Promise<void> {
        if (!this.refreshDrivesBtn) {
            return;
        }

        try {
            this.refreshDrivesBtn.disabled = true;
            this.refreshDrivesBtn.textContent = '刷新中...';

            const success = await networkDriveManagementService.refreshConnections();
            if (success) {
                this.showNotification('网络磁盘状态刷新完成', 'success');
                // 刷新显示列表
                await this.refreshMountedDrivesList();
            } else {
                this.showNotification('刷新网络磁盘状态失败', 'error');
            }
        } catch (error) {
            this.showNotification(`刷新失败: ${this.getErrorMessage(error)}`, 'error');
        } finally {
            this.refreshDrivesBtn.disabled = false;
            this.refreshDrivesBtn.textContent = '刷新状态';
        }
    }

    escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    normalizeScanProgress(progress: ScanProgress): {current: number; total: number} {
        return {
            current: progress.processedFiles ?? progress.current ?? 0,
            total: progress.totalFiles ?? progress.total ?? 0
        };
    }
}

export { NetworkDiskModal };
