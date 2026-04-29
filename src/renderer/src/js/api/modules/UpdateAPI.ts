/**
 * 更新 API
 * 提供应用更新检查、版本比较等功能
 */

import {showToast} from '@js/utils';
import {BaseAPI, Logger} from "@api/core";
import {type GitHubRelease, updateService} from "@services/update/UpdateService";

/**
 * 更新 API 类
 */
export class UpdateAPI extends BaseAPI {
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

            const {currentVersion, latestVersion, releaseInfo, hasUpdate} = await updateService.checkForUpdates();

            this.log(`当前版本: v${currentVersion}, 最新版本: v${latestVersion}`);

            // 比较版本
            if (hasUpdate) {
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
            return await updateService.getCurrentVersion();
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
            return await updateService.getLatestRelease();
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
        return updateService.isNewerVersion(latest, current);
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
                    updateService.openReleasePage(releaseInfo.html_url).catch(error => {
                        this.logError('打开 Release 页面失败', error as Error);
                    });
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
    async openDownloadPage(url: string): Promise<{success: boolean; error?: string}> {
        return await updateService.openReleasePage(url);
    }

    /**
     * 打开 GitHub Release 页面
     */
    async openReleasePage(): Promise<void> {
        try {
            const releaseInfo = await this.getLatestRelease();
            await this.openDownloadPage(releaseInfo.html_url || updateService.getFallbackReleaseUrl());
        } catch (error) {
            this.logError('打开 Release 页面失败', error as Error);
            // 回退到仓库页面
            await updateService.openReleasePage();
        }
    }
}

export const updateAPI = new UpdateAPI();
