/**
 * 更新检查模态窗口组件
 */

class UpdateModal extends Component {
    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentVersion = null;
        this.latestVersion = null;
        this.releaseInfo = null;
        this.modal = null;
        this.listenersSetup = false; // 事件监听器是否已设置
    }

    show() {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }
        this.isVisible = true;
        this.modal.style.display = 'flex';

        // 动画显示
        requestAnimationFrame(() => {
            this.modal.classList.add('show');
        });

        // 自动开始检查更新
        this.checkForUpdates();
    }

    hide() {
        this.isVisible = false;
        this.modal.classList.remove('show');
        setTimeout(() => {
            if (!this.isVisible) {
                this.modal.style.display = 'none';
            }
        }, 300);
    }

    destroy() {
        this.currentVersion = null;
        this.latestVersion = null;
        this.releaseInfo = null;
        this.modal = null;
        this.listenersSetup = false;
        return super.destroy();
    }

    setupElements() {
        // 检查是否已经存在模态窗口
        if (document.getElementById('update-modal')) {
            this.modal = document.getElementById('update-modal');
        } else {
            // 创建模态窗口HTML结构
            const modalHTML = `
                <div id="update-modal" class="modal-overlay" style="display: none;">
                    <div class="modal-dialog update-modal-dialog">
                        <div class="modal-header">
                            <h3 class="modal-title">检查更新</h3>
                            <button class="modal-close-btn" id="update-modal-close">
                                <svg class="icon" viewBox="0 0 24 24">
                                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                                </svg>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="update-content">
                                <!-- 检查中状态 -->
                                <div class="update-checking" id="update-checking">
                                    <div class="loading-spinner"></div>
                                    <p class="update-message">正在检查更新...</p>
                                </div>

                                <!-- 有新版本 -->
                                <div class="update-available" id="update-available" style="display: none;">
                                    <div class="update-icon success">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.41,10.09L6,11.5L11,16.5Z"/>
                                        </svg>
                                    </div>
                                    <h4 class="update-title">发现新版本</h4>
                                    <div class="version-info">
                                        <div class="version-item">
                                            <span class="version-label">当前版本：</span>
                                            <span class="version-value current" id="current-version"></span>
                                        </div>
                                        <div class="version-item">
                                            <span class="version-label">最新版本：</span>
                                            <span class="version-value latest" id="latest-version"></span>
                                        </div>
                                    </div>
                                    <div class="release-notes" id="release-notes">
                                        <h5>更新内容：</h5>
                                        <div class="notes-content" id="notes-content"></div>
                                    </div>
                                </div>

                                <!-- 已是最新版本 -->
                                <div class="update-latest" id="update-latest" style="display: none;">
                                    <div class="update-icon info">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                                        </svg>
                                    </div>
                                    <h4 class="update-title">已是最新版本</h4>
                                    <p class="update-message">您当前使用的版本 <strong id="current-version-latest"></strong> 已是最新版本。</p>
                                </div>

                                <!-- 检查失败 -->
                                <div class="update-error" id="update-error" style="display: none;">
                                    <div class="update-icon error">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                                        </svg>
                                    </div>
                                    <h4 class="update-title">检查更新失败</h4>
                                    <p class="update-message" id="error-message">无法连接到更新服务器，请检查网络连接后重试。</p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <div class="modal-actions">
                                <button class="btn btn-secondary" id="update-later">稍后提醒</button>
                                <button class="btn btn-primary" id="update-now" style="display: none;">立即更新</button>
                                <button class="btn btn-secondary" id="update-retry" style="display: none;">重试</button>
                                <button class="btn btn-primary" id="update-ok" style="display: none;">确定</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.modal = document.getElementById('update-modal');
        }

        // 获取元素引用
        this.closeBtn = document.getElementById('update-modal-close');
        this.laterBtn = document.getElementById('update-later');
        this.nowBtn = document.getElementById('update-now');
        this.retryBtn = document.getElementById('update-retry');
        this.okBtn = document.getElementById('update-ok');

        // 状态元素
        this.checkingEl = document.getElementById('update-checking');
        this.availableEl = document.getElementById('update-available');
        this.latestEl = document.getElementById('update-latest');
        this.errorEl = document.getElementById('update-error');

        // 信息元素
        this.currentVersionEl = document.getElementById('current-version');
        this.latestVersionEl = document.getElementById('latest-version');
        this.currentVersionLatestEl = document.getElementById('current-version-latest');
        this.notesContentEl = document.getElementById('notes-content');
        this.errorMessageEl = document.getElementById('error-message');
    }

    setupEventListeners() {
        // 关闭按钮
        this.closeBtn.addEventListener('click', () => this.hide());

        // 稍后提醒按钮
        this.laterBtn.addEventListener('click', () => this.hide());

        // 立即更新按钮
        this.nowBtn.addEventListener('click', () => {
            this.openRepository();
        });

        // 重试按钮
        this.retryBtn.addEventListener('click', async () => {
            await this.checkForUpdates();
        });

        // 确定按钮
        this.okBtn.addEventListener('click', () => this.hide());

        // 点击背景关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    async checkForUpdates() {
        try {
            // 显示检查中状态
            this.showCheckingState();

            // 获取当前版本
            this.currentVersion = await this.getCurrentVersion();

            // 获取最新版本信息
            const releaseInfo = await this.getLatestRelease();
            this.latestVersion = releaseInfo.tag_name.replace(/^v/, ''); // 移除v前缀
            this.releaseInfo = releaseInfo;

            // 比较版本
            if (this.isNewerVersion(this.latestVersion, this.currentVersion)) {
                this.showUpdateAvailable();
            } else {
                this.showLatestVersion();
            }

        } catch (error) {
            this.showError(error.message);
        }
    }

    async getCurrentVersion() {
        try {
            const response = await fetch('../../../package.json');
            const packageInfo = await response.json();
            return packageInfo.version;
        } catch (error) {
            return '';
        }
    }

    async getLatestRelease() {
        const response = await fetch('https://api.github.com/repos/asxez/MusicBox/releases/latest');

        if (!response.ok) {
            throw new Error(`GitHub API请求失败: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    isNewerVersion(latest, current) {
        // 简单的版本比较逻辑
        const parseVersion = (version) => {
            const parts = version.replace(/-(alpha|beta|rc).*$/, '').split('.');
            return parts.map(part => parseInt(part, 10));
        };

        const latestParts = parseVersion(latest);
        const currentParts = parseVersion(current);

        for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
            const latestPart = latestParts[i] || 0;
            const currentPart = currentParts[i] || 0;

            if (latestPart > currentPart) return true;
            if (latestPart < currentPart) return false;
        }

        return false;
    }

    showCheckingState() {
        this.hideAllStates();
        this.checkingEl.style.display = 'block';
        this.hideAllButtons();
        this.laterBtn.style.display = 'inline-block';
    }

    showUpdateAvailable() {
        this.hideAllStates();
        this.availableEl.style.display = 'block';

        // 填充版本信息
        this.currentVersionEl.textContent = this.currentVersion;
        this.latestVersionEl.textContent = this.latestVersion;

        // 填充更新说明
        if (this.releaseInfo.body) {
            this.notesContentEl.innerHTML = this.formatReleaseNotes(this.releaseInfo.body);
        } else {
            this.notesContentEl.textContent = '暂无更新说明';
        }

        this.hideAllButtons();
        this.laterBtn.style.display = 'inline-block';
        this.nowBtn.style.display = 'inline-block';
    }

    showLatestVersion() {
        this.hideAllStates();
        this.latestEl.style.display = 'block';
        this.currentVersionLatestEl.textContent = this.currentVersion;

        this.hideAllButtons();
        this.okBtn.style.display = 'inline-block';
    }

    showError(message) {
        this.hideAllStates();
        this.errorEl.style.display = 'block';
        this.errorMessageEl.textContent = message;

        this.hideAllButtons();
        this.laterBtn.style.display = 'inline-block';
        this.retryBtn.style.display = 'inline-block';
    }

    hideAllStates() {
        this.checkingEl.style.display = 'none';
        this.availableEl.style.display = 'none';
        this.latestEl.style.display = 'none';
        this.errorEl.style.display = 'none';
    }

    hideAllButtons() {
        this.laterBtn.style.display = 'none';
        this.nowBtn.style.display = 'none';
        this.retryBtn.style.display = 'none';
        this.okBtn.style.display = 'none';
    }

    formatReleaseNotes(notes) {
        // 简单的Markdown格式化
        return notes
            .replace(/^### (.*$)/gim, '<h6>$1</h6>')
            .replace(/^## (.*$)/gim, '<h5>$1</h5>')
            .replace(/^# (.*$)/gim, '<h4>$1</h4>')
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.*)$/gim, '<p>$1</p>')
            .replace(/<p><li>/g, '<ul><li>')
            .replace(/<\/li><\/p>/g, '</li></ul>');
    }

    openRepository() {
        window.open('https://github.com/asxez/MusicBox', '_blank');
        this.hide();
    }
}

window.components.component.UpdateModal = UpdateModal;
