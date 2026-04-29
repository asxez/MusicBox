import {systemGateway} from "@js/infrastructure/electron/SystemGateway";
import {updateService} from "@services/update/UpdateService";

class AppInfoSettingsService {
    private readonly repositoryUrl = 'https://github.com/asxez/MusicBox';

    async updateVersionInfo(versionElementId = 'app-version-info'): Promise<void> {
        const versionElement = document.getElementById(versionElementId);
        if (!versionElement) {
            return;
        }

        const version = await updateService.getCurrentVersion();
        versionElement.textContent = `MusicBox v${version || 'unknown'}`;
    }

    async openRepository(): Promise<{success: boolean; error?: string}> {
        return await systemGateway.openExternal(this.repositoryUrl);
    }
}

export const appInfoSettingsService = new AppInfoSettingsService();
