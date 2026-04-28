import {app} from "@core/app";
import type {ConfirmOptions} from "@core/types/app";

class NavigationInteractionService {
    confirm(options: ConfirmOptions): Promise<boolean> {
        return app.confirm(options);
    }

    showInfo(message: string): void {
        app.showInfo(message);
    }

    showError(message: string): void {
        app.showError(message);
    }
}

export const navigationInteractionService = new NavigationInteractionService();
