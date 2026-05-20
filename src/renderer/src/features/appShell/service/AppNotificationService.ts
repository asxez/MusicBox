import {appShellRuntimeHost} from "./AppShellRuntimeHost";

export class AppNotificationService {
    showInfo(message: string): void {
        appShellRuntimeHost.requireHost().showInfo(message);
    }

    showSuccess(message: string): void {
        appShellRuntimeHost.requireHost().showSuccess(message);
    }

    showError(message: string): void {
        appShellRuntimeHost.requireHost().showError(message);
    }
}

export const appNotificationService = new AppNotificationService();
