import {systemGateway} from "@js/infrastructure/electron/SystemGateway";

interface PackageInfo {
    version?: string;
}

class AppInfoSettingsService {
    private readonly repositoryUrl = 'https://github.com/asxez/MusicBox';

    async updateVersionInfo(versionElementId = 'app-version-info'): Promise<void> {
        const versionElement = document.getElementById(versionElementId);
        if (!versionElement) {
            return;
        }

        const response = await fetch('../../../package.json');
        const packageInfo = await response.json() as PackageInfo;
        versionElement.textContent = `MusicBox v${packageInfo.version || 'unknown'}`;
    }

    async openRepository(): Promise<{success: boolean; error?: string}> {
        return await systemGateway.openExternal(this.repositoryUrl);
    }
}

export const appInfoSettingsService = new AppInfoSettingsService();
