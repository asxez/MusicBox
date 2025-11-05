/**
 * 网络磁盘配置模态框组件
 */

import {Component} from "@components/base/Component";
import {api} from "@js/api";

class NetworkDiskModal extends Component {
    constructor() {
        super('#network-drive-modal');
        this.isVisible = false;
        this.listenersSetup = false; // 事件监听器是否已设置

        this.setupSettingsElements();
        this.initializeNetworkDriveManagement();
    }

    show() {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }

        this.isVisible = true;
        this.resetNetworkDriveForm();
        this.element.style.display = 'flex';

        // 动画显示
        requestAnimationFrame(() => {
            this.element.classList.add('show');
        });

        // 焦点管理
        if (this.driveNameInput) {
            this.driveNameInput.focus();
        }
    }

    hide() {
        this.isVisible = false;
        this.element.classList.remove('show');
        setTimeout(() => {
            if (!this.isVisible) {
                this.element.style.display = 'none';
                this.resetNetworkDriveForm();
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
        this.networkDriveForm = this.element.querySelector('#network-drive-form');
        this.networkDriveModalClose = this.element.querySelector('#network-drive-modal-close');
        this.networkDriveCancel = this.element.querySelector('#network-drive-cancel');
        this.networkDriveConfirm = this.element.querySelector('#network-drive-confirm');
        this.testConnectionBtn = this.element.querySelector('#test-connection-btn');

        // 表单元素
        this.driveNameInput = this.element.querySelector('#drive-name');
        this.driveProtocolSelect = this.element.querySelector('#drive-protocol');
        this.driveUsernameInput = this.element.querySelector('#drive-username');
        this.drivePasswordInput = this.element.querySelector('#drive-password');

        // SMB配置元素
        this.smbConfig = this.element.querySelector('#smb-config');
        this.smbHostInput = this.element.querySelector('#smb-host');
        this.smbShareInput = this.element.querySelector('#smb-share');
        this.smbDomainInput = this.element.querySelector('#smb-domain');

        // WebDAV配置元素
        this.webdavConfig = this.element.querySelector('#webdav-config');
        this.webdavUrlInput = this.element.querySelector('#webdav-url');

        // 连接测试结果元素
        this.connectionTestResult = this.element.querySelector('#connection-test-result');
        this.testStatus = this.connectionTestResult?.querySelector('.test-status');
        this.testMessage = this.connectionTestResult?.querySelector('.test-message');
    }

    setupSettingsElements() {
        // 网络磁盘管理相关元素
        this.mountedDrivesList = document.querySelector('#mounted-drives-list');
        this.refreshDrivesBtn = document.querySelector('#refresh-drives-btn');
    }

    setupEventListeners() {
        // 模态框关闭事件
        if (this.networkDriveModalClose) {
            this.networkDriveModalClose.addEventListener('click', () => {
                this.hide();
            });
        }

        // 取消按钮
        if (this.networkDriveCancel) {
            this.networkDriveCancel.addEventListener('click', () => {
                this.hide();
            });
        }

        // 协议选择变化事件
        if (this.driveProtocolSelect) {
            this.driveProtocolSelect.addEventListener('change', (e) => {
                this.toggleProtocolConfig(e.target.value);
            });
        }

        // 测试连接按钮
        if (this.testConnectionBtn) {
            this.testConnectionBtn.addEventListener('click', async () => {
                await this.testConnection();
            });
        }

        // 表单提交事件
        if (this.networkDriveForm) {
            this.networkDriveForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.addNetworkDrive();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    // 重置网络磁盘表单
    resetNetworkDriveForm() {
        if (this.networkDriveForm) {
            this.networkDriveForm.reset();
        }
        this.toggleProtocolConfig('');
        this.hideConnectionTestResult();
    }

    // 切换协议配置显示
    toggleProtocolConfig(protocol) {
        if (this.smbConfig) {
            this.smbConfig.style.display = protocol === 'smb' ? 'block' : 'none';
        }
        if (this.webdavConfig) {
            this.webdavConfig.style.display = protocol === 'webdav' ? 'block' : 'none';
        }
    }

    // 显示连接测试结果
    showConnectionTestResult(success, message) {
        if (!this.connectionTestResult || !this.testStatus || !this.testMessage) {
            return;
        }

        this.testStatus.className = `test-status ${success ? 'success' : 'error'}`;
        this.testStatus.textContent = success ? '✓' : '✗';
        this.testMessage.textContent = message;
        this.connectionTestResult.style.display = 'block';
    }

    // 隐藏连接测试结果
    hideConnectionTestResult() {
        if (this.connectionTestResult) {
            this.connectionTestResult.style.display = 'none';
        }
    }

    // 显示通知消息
    showNotification(message, type = 'info') {
        this.emit('notification', {message, type});
    }

    // 获取网络磁盘配置
    getNetworkDriveConfig() {
        const protocol = this.driveProtocolSelect.value;
        const name = this.driveNameInput.value.trim();
        const username = this.driveUsernameInput.value.trim();
        const password = this.drivePasswordInput.value;

        if (!protocol || !name || !username || !password) {
            return null;
        }

        const config = {
            id: `${protocol}_${Date.now()}`,
            type: protocol,
            displayName: name,
            username: username,
            password: password
        };

        if (protocol === 'smb') {
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
            const url = this.webdavUrlInput.value.trim();

            if (!url) {
                return null;
            }

            config.url = url;
        }

        return config;
    }

    // 测试连接
    async testConnection() {
        const config = this.getNetworkDriveConfig();
        if (!config) {
            this.showConnectionTestResult(false, '请填写完整的配置信息');
            return;
        }

        this.testConnectionBtn.disabled = true;
        this.testConnectionBtn.textContent = '测试中...';

        try {
            const success = await window.electronAPI.networkDrive.testConnection(config);
            if (success) {
                this.showConnectionTestResult(true, '连接测试成功');
            } else {
                this.showConnectionTestResult(false, '连接测试失败');
            }
        } catch (error) {
            this.showConnectionTestResult(false, `连接测试失败: ${error.message}`);
        } finally {
            this.testConnectionBtn.disabled = false;
            this.testConnectionBtn.textContent = '测试连接';
        }
    }

    // 添加网络磁盘
    async addNetworkDrive() {
        const config = this.getNetworkDriveConfig();
        if (!config) {
            this.showConnectionTestResult(false, '请填写完整的配置信息');
            return;
        }

        this.networkDriveConfirm.disabled = true;
        this.networkDriveConfirm.textContent = '添加中...';

        try {
            let success = false;
            if (config.type === 'smb') {
                success = await window.electronAPI.networkDrive.mountSMB(config);
            } else if (config.type === 'webdav') {
                success = await window.electronAPI.networkDrive.mountWebDAV(config);
            }

            if (success) {
                this.hide();
                this.emit('driveAdded', config);
                this.showNotification(`网络磁盘 "${config.displayName}" 添加成功`, 'success');
            } else {
                this.showConnectionTestResult(false, '网络磁盘添加失败');
            }
        } catch (error) {
            this.showConnectionTestResult(false, `添加失败: ${error.message}`);
        } finally {
            this.networkDriveConfirm.disabled = false;
            this.networkDriveConfirm.textContent = '添加磁盘';
        }
    }

    // -------- 网络磁盘管理方法 --------

    // 初始化网络磁盘管理功能
    initializeNetworkDriveManagement() {
        // 设置刷新按钮事件监听器
        if (this.refreshDrivesBtn) {
            this.refreshDrivesBtn.addEventListener('click', async () => {
                await this.refreshNetworkDrivesStatus();
            });
        }

        // 监听网络磁盘事件
        window.electronAPI.networkDrive.onConnected(async (event, driveId, config) => {
            await this.refreshMountedDrivesList();
            this.emit('driveConnected', driveId, config);
        });

        window.electronAPI.networkDrive.onDisconnected(async (event, driveId, config) => {
            await this.refreshMountedDrivesList();
            this.emit('driveDisconnected', driveId, config);
        });

        window.electronAPI.networkDrive.onError((event, driveId, error) => {
            this.showNotification(`网络磁盘错误: ${error}`, 'error');
        });

        // 初始加载磁盘列表
        this.refreshMountedDrivesList();
    }

    // 刷新已挂载的磁盘列表
    async refreshMountedDrivesList() {
        try {
            const mountedDrives = await window.electronAPI.networkDrive.getMountedDrives();
            this.renderMountedDrivesList(mountedDrives);
        } catch (error) {
            console.error('❌ 获取挂载磁盘列表失败:', error);
        }
    }

    // 渲染已挂载的磁盘列表
    renderMountedDrivesList(drives) {
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

            return `
                <div class="mounted-drive-item" data-drive-id="${drive.id}">
                    <div class="drive-info">
                        <div class="drive-name">${drive.config.displayName}</div>
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
        this.mountedDrivesList.querySelectorAll('.scan-drive-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const driveId = e.target.getAttribute('data-drive-id');
                await this.scanNetworkDrive(driveId);
            });
        });

        // 添加卸载按钮事件监听器
        this.mountedDrivesList.querySelectorAll('.unmount-drive-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const driveId = e.target.getAttribute('data-drive-id');
                await this.unmountNetworkDrive(driveId);
            });
        });
    }

    // 扫描网络磁盘
    async scanNetworkDrive(driveId) {
        try {
            this.showNotification('正在扫描网络磁盘...', 'info');

            // 使用API层的统一方法
            const success = await api.scanNetworkDrive(driveId, '/');
            if (success) {
                this.showNotification('网络磁盘扫描完成', 'success');
            } else {
                this.showNotification('网络磁盘扫描失败', 'error');
            }
        } catch (error) {
            this.showNotification(`扫描失败: ${error.message}`, 'error');
        }
    }

    // 卸载网络磁盘
    async unmountNetworkDrive(driveId) {
        try {
            console.log(`🔄 NetworkDiskModal: 开始卸载网络磁盘 ${driveId}`);

            const success = await window.electronAPI.networkDrive.unmount(driveId);
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
            this.showNotification(`卸载失败: ${error.message}`, 'error');
        }
    }

    // 刷新网络磁盘状态
    async refreshNetworkDrivesStatus() {
        if (!this.refreshDrivesBtn) {
            return;
        }

        try {
            this.refreshDrivesBtn.disabled = true;
            this.refreshDrivesBtn.textContent = '刷新中...';

            const success = await window.electronAPI.networkDrive.refreshConnections();
            if (success) {
                this.showNotification('网络磁盘状态刷新完成', 'success');
                // 刷新显示列表
                await this.refreshMountedDrivesList();
            } else {
                this.showNotification('刷新网络磁盘状态失败', 'error');
            }
        } catch (error) {
            this.showNotification(`刷新失败: ${error.message}`, 'error');
        } finally {
            this.refreshDrivesBtn.disabled = false;
            this.refreshDrivesBtn.textContent = '刷新状态';
        }
    }
}

export { NetworkDiskModal };
