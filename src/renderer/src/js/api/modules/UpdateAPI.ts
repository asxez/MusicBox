/**
 * 更新 API
 * 提供应用更新检查、版本比较等功能
 */

import {showToast} from '@js/utils';
import {BaseAPI, Logger} from "@api/core";

/**
 * GitHub Release 响应类型
 */
interface GitHubRelease {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    html_url: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
        size: number;
    }>;
}

/**
 * 更新 API 类
 */
export class UpdateAPI extends BaseAPI {
    private readonly GITHUB_REPO = 'asxez/MusicBox';
    private readonly GITHUB_API_URL = `https://api.github.com/repos/${this.GITHUB_REPO}/releases/latest`;

    constructor() {
        super('UpdateAPI');
    }

    /**
     * 初始化（更新版本显示）
     */
    async init(): Promise<void> {
        try {
            const versionEle = document.querySelector('#app-version-info');
            if (versionEle) {
                const currentVersion = await this.getCurrentVersion();
                versionEle.textContent = `MusicBox v${currentVersion}`;
                this.log(`当前版本: v${currentVersion}`);
            }
        } catch (error) {
            this.logError('初始化版本信息失败', error as Error);
        }
    }

    /**
     * 自动检查更新
     */
    async autoCheckForUpdates(): Promise<void> {
        try {
            this.log('开始检查更新');

            // 获取版本信息
            const currentVersion = await this.getCurrentVersion();
            const releaseInfo = await this.getLatestRelease();
            const latestVersion = releaseInfo.tag_name.replace(/^v/, ''); // 移除v前缀

            this.log(`当前版本: v${currentVersion}, 最新版本: v${latestVersion}`);

            // 比较版本
            if (this.isNewerVersion(latestVersion, currentVersion)) {
                Logger.success('发现新版本');
                this.showUpdateNotification(currentVersion, latestVersion, releaseInfo);
            } else {
                this.log('当前已是最新版本');
            }
        } catch (error) {
            this.logError('检查更新失败', error as Error);
            showToast('检查更新失败，请检查网络连接', 'error');
        }
    }

    /**
     * 获取当前版本
     * @returns 当前版本号
     */
    async getCurrentVersion(): Promise<string> {
        try {
            const response = await fetch('../../../package.json');
            const packageInfo = await response.json();
            return packageInfo.version;
        } catch (error) {
            this.logError('获取当前版本失败', error as Error);
            throw error;
        }
    }

    /**
     * 获取最新版本
     * @returns GitHub Release 信息
     */
    async getLatestRelease(): Promise<GitHubRelease> {
        try {
            const response = await fetch(this.GITHUB_API_URL);
            if (!response.ok) {
                throw new Error(`GitHub API请求失败: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            this.logError('获取最新版本失败', error as Error);
            throw error;
        }
    }

    /**
     * 比较版本号
     * @param latest - 最新版本
     * @param current - 当前版本
     * @returns 是否有更新
     */
    isNewerVersion(latest: string, current: string): boolean {
        const parseVersion = (version: string): number[] => {
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

    /**
     * 显示更新通知
     * @param currentVersion - 当前版本
     * @param latestVersion - 最新版本
     * @param releaseInfo - 发布信息
     */
    showUpdateNotification(
        currentVersion: string,
        latestVersion: string,
        releaseInfo?: GitHubRelease
    ): void {
        const message = `发现新版本 v${latestVersion}（当前版本：v${currentVersion}）`;

        const toastElement = document.createElement('div');
        toastElement.className = 'update-notification-toast';
        toastElement.innerHTML = `
            <div class="update-toast-content">
                <div class="update-toast-header">
                    <div class="update-toast-icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.41,10.09L6,11.5L11,16.5Z"/>
                        </svg>
                    </div>
                    <div class="update-toast-text">
                        <div class="update-toast-title">发现新版本</div>
                        <div class="update-toast-message">${message}</div>
                    </div>
                    <button class="update-toast-close">
                        <svg viewBox="0 0 24 24">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
                <div class="update-toast-actions">
                    <button class="update-toast-btn update-toast-btn-primary">查看详情</button>
                    <button class="update-toast-btn update-toast-btn-secondary">稍后提醒</button>
                </div>
            </div>
        `;

        // 事件处理
        const closeBtn = toastElement.querySelector('.update-toast-close');
        const detailBtn = toastElement.querySelector('.update-toast-btn-primary');
        const laterBtn = toastElement.querySelector('.update-toast-btn-secondary');

        const removeToast = () => {
            if (toastElement.parentNode) {
                toastElement.classList.remove('show');
                setTimeout(() => {
                    if (toastElement.parentNode) {
                        toastElement.remove();
                    }
                }, 300);
            }
        };

        closeBtn?.addEventListener('click', removeToast);
        laterBtn?.addEventListener('click', removeToast);
        detailBtn?.addEventListener('click', () => {
            // 触发更新模态框（假设有 updateModal 对象）
            if ((window as any).updateModal) {
                (window as any).updateModal.show();
            } else {
                // 如果没有模态框，直接打开 GitHub 发布页
                if (releaseInfo) {
                    window.open(releaseInfo.html_url, '_blank');
                }
            }
            removeToast();
        });

        // 添加到页面
        document.body.appendChild(toastElement);

        // 显示动画
        requestAnimationFrame(() => {
            toastElement.classList.add('show');
        });

        // 8秒后自动隐藏
        setTimeout(() => {
            removeToast();
        }, 8000);
    }

    /**
     * 打开下载页面
     * @param url - 下载链接
     */
    openDownloadPage(url: string): void {
        window.open(url, '_blank');
    }

    /**
     * 打开 GitHub Release 页面
     */
    async openReleasePage(): Promise<void> {
        try {
            const releaseInfo = await this.getLatestRelease();
            this.openDownloadPage(releaseInfo.html_url);
        } catch (error) {
            this.logError('打开 Release 页面失败', error as Error);
            // 回退到仓库页面
            window.open(`https://github.com/${this.GITHUB_REPO}/releases`, '_blank');
        }
    }
}

export const updateAPI = new UpdateAPI();
