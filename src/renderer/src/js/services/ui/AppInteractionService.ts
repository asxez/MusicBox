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
}

export const appInteractionService = new AppInteractionService();
