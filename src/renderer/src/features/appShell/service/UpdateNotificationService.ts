import {showToast} from '@/utils';
import {type GitHubRelease, updateService} from './UpdateService';
import type {Result, Unsubscribe} from '@api/types/common';

type ShowUpdateDetailsHandler = () => void;

export class UpdateNotificationService {
    private readonly showUpdateDetailsHandlers = new Set<ShowUpdateDetailsHandler>();

    async autoCheckForUpdates(): Promise<void> {
        try {
            const {currentVersion, latestVersion, releaseInfo, hasUpdate} = await updateService.checkForUpdates();

            if (hasUpdate) {
                this.showUpdateNotification(currentVersion, latestVersion, releaseInfo);
            }
        } catch (error) {
            console.error('❌ UpdateNotificationService: 检查更新失败', error);
            showToast('检查更新失败，请检查网络连接', 'error');
        }
    }

    onShowUpdateDetails(handler: () => void): Unsubscribe {
        this.showUpdateDetailsHandlers.add(handler);
        return () => {
            this.showUpdateDetailsHandlers.delete(handler);
        };
    }

    async openReleasePage(): Promise<void> {
        try {
            const releaseInfo = await updateService.getLatestRelease();
            await this.openDownloadPage(releaseInfo.html_url || updateService.getFallbackReleaseUrl());
        } catch (error) {
            console.error('❌ UpdateNotificationService: 打开 Release 页面失败', error);
            await updateService.openReleasePage();
        }
    }

    async openDownloadPage(url: string): Promise<Result> {
        return await updateService.openReleasePage(url);
    }

    private showUpdateNotification(
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

        const removeToast = () => {
            if (!toastElement.parentNode) {
                return;
            }

            toastElement.classList.remove('show');
            setTimeout(() => {
                if (toastElement.parentNode) {
                    toastElement.remove();
                }
            }, 300);
        };

        toastElement.querySelector('.update-toast-close')?.addEventListener('click', removeToast);
        toastElement.querySelector('.update-toast-btn-secondary')?.addEventListener('click', removeToast);
        toastElement.querySelector('.update-toast-btn-primary')?.addEventListener('click', () => {
            if (this.showUpdateDetailsHandlers.size > 0) {
                this.showUpdateDetailsHandlers.forEach(handler => handler());
            } else if (releaseInfo) {
                updateService.openReleasePage(releaseInfo.html_url).catch(error => {
                    console.error('❌ UpdateNotificationService: 打开 Release 页面失败', error);
                });
            }
            removeToast();
        });

        document.body.appendChild(toastElement);
        requestAnimationFrame(() => {
            toastElement.classList.add('show');
        });
        setTimeout(removeToast, 8000);
    }
}

export const updateNotificationService = new UpdateNotificationService();
