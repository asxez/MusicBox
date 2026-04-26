import {app} from "@core/app";
import type {ConfirmOptions} from "@core/types/app";

class SettingsInteractionService {
    confirm(options: ConfirmOptions): Promise<boolean> {
        return app.confirm(options);
    }

    showNetworkDriveModal(): boolean {
        const modal = app.components.networkDiskModal;
        if (!modal) {
            return false;
        }

        modal.show();
        return true;
    }

    async showPluginManager(): Promise<boolean> {
        const modal = app.components.pluginManagerModal;
        if (!modal) {
            return false;
        }

        await modal.show();
        return true;
    }
}

export const settingsInteractionService = new SettingsInteractionService();
