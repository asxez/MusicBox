import {showToast} from "@utils";

class CheckUpdate {

    // 自动检查更新
    async autoCheckForUpdates() {
        try {
            // 获取版本信息
            const currentVersion = await this.getCurrentVersion();
            const releaseInfo = await this.getLatestRelease();
            const latestVersion = releaseInfo.tag_name.replace(/^v/, ''); // 移除v前缀

            // 比较版本
            if (this.isNewerVersion(latestVersion, currentVersion)) {
                this.showUpdateNotification(currentVersion, latestVersion, releaseInfo);
            }
        } catch (error) {
            showToast('检查更新失败，请检查网络连接', 'error');
        }
    }

    // 获取当前版本
    async getCurrentVersion() {
        const response = await fetch('../../../package.json');
        const packageInfo = await response.json();
        return packageInfo.version;
    }

    // 获取最新版本
    async getLatestRelease() {
        const response = await fetch('https://api.github.com/repos/asxez/MusicBox/releases/latest');
        if (!response.ok) {
            throw new Error(`GitHub API请求失败: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }

    isNewerVersion(latest, current) {
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

    showUpdateNotification(currentVersion, latestVersion) {
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
                    <button class="update-toast-close" onclick="this.closest('.update-notification-toast').remove()">
                        <svg viewBox="0 0 24 24">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
                <div class="update-toast-actions">
                    <button class="update-toast-btn update-toast-btn-primary" onclick="updateModal.show(); this.closest('.update-notification-toast').remove();">查看详情</button>
                    <button class="update-toast-btn update-toast-btn-secondary" onclick="this.closest('.update-notification-toast').remove()">稍后提醒</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(toastElement);

        // 显示动画
        requestAnimationFrame(() => {
            toastElement.classList.add('show');
        });

        // 8秒后自动隐藏
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.classList.remove('show');
                setTimeout(() => {
                    if (toastElement.parentNode) {
                        toastElement.remove();
                    }
                }, 300);
            }
        }, 8000);
    }
}

let checkUpdate = new CheckUpdate();
export {checkUpdate};
