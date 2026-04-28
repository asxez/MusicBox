import {app} from "@core/app";
import type {ConfirmOptions} from "@core/types/app";

class NetworkDriveDetailInteractionService {
    showInfo(message: string): void {
        app.showInfo(message);
    }

    showSuccess(message: string): void {
        app.showSuccess(message);
    }

    showError(message: string): void {
        app.showError(message);
    }

    confirm(options: ConfirmOptions): Promise<boolean> {
        return app.confirm(options);
    }

    navigateToLibrary(): Promise<void> {
        return app.handleViewChange('library');
    }
}

export const networkDriveDetailInteractionService = new NetworkDriveDetailInteractionService();
