import {app} from "@core/app";
import type {ConfirmOptions} from "@core/types/app";

class AppInteractionService {
    confirm(options: ConfirmOptions): Promise<boolean> {
        return app.confirm(options);
    }

    showInfo(message: string): void {
        app.showInfo(message);
    }

    showSuccess(message: string): void {
        app.showSuccess(message);
    }

    showError(message: string): void {
        app.showError(message);
    }

    navigateToLibrary(): Promise<void> {
        return app.handleViewChange('library');
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

export const appInteractionService = new AppInteractionService();
