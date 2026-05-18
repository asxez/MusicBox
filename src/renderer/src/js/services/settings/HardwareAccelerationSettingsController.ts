import {showToast} from "@utils/index.js";
import {hardwareAccelerationSettingsService} from "@services/settings/HardwareAccelerationSettingsService";
import {appInteractionService} from "@js/features/appShell/service";

interface HardwareAccelerationChangeResult {
    checked: boolean;
}

class HardwareAccelerationSettingsController {
    async getInitialEnabled(): Promise<boolean> {
        try {
            return await hardwareAccelerationSettingsService.getEnabled();
        } catch (error) {
            console.error('❌ Settings: 初始化硬件加速设置失败:', error);
            return true;
        }
    }

    async handleChange(enabled: boolean): Promise<HardwareAccelerationChangeResult> {
        try {
            if (!enabled) {
                const shouldRestart = await this.confirmDisableAndRestart();
                if (!shouldRestart) {
                    return {checked: true};
                }
            }

            const result = await hardwareAccelerationSettingsService.updateEnabled(enabled);
            if (!result.success) {
                showToast('更新硬件加速设置失败', 'error');
                return {checked: !enabled};
            }

            if (!enabled) {
                await this.restartApplication();
            } else {
                this.showEnabledNotification();
            }

            return {checked: enabled};
        } catch (error) {
            showToast('处理硬件加速设置失败', 'error');
            return {checked: !enabled};
        }
    }

    async openUserDataFolder(): Promise<void> {
        const result = await hardwareAccelerationSettingsService.openUserDataFolder();
        if (result.success) {
            showToast('已打开应用数据文件夹', 'success');
            return;
        }

        showToast('打开文件夹失败', 'error');
        console.error('❌ Settings: 打开应用数据文件夹失败:', result.error);
    }

    async openDevTools(): Promise<void> {
        const result = await hardwareAccelerationSettingsService.openDevTools();
        if (result.success) {
            showToast('开发者工具已打开', 'success');
            return;
        }

        showToast('打开开发者工具失败', 'error');
        console.error('❌ Settings: 打开开发者工具失败:', result.error);
    }

    private async confirmDisableAndRestart(): Promise<boolean> {
        return await appInteractionService.confirm({
            title: '硬件加速设置',
            message: '关闭硬件加速可能会降低应用性能，但可以解决某些显卡兼容性问题。\n\n更改此设置需要重启应用才能生效。\n\n是否要关闭硬件加速并立即重启应用？',
            confirmText: '重启应用',
            type: 'warning'
        });
    }

    private async restartApplication(): Promise<void> {
        showToast('正在重启应用...', 'info');
        setTimeout(async () => {
            try {
                await hardwareAccelerationSettingsService.restartApplication();
            } catch (error) {
                showToast('重启应用失败，请手动重启', 'error');
            }
        }, 1000);
    }

    private showEnabledNotification(): void {
        showToast('硬件加速已启用，建议重启应用以获得最佳性能', 'success');
    }
}

export const hardwareAccelerationSettingsController = new HardwareAccelerationSettingsController();
