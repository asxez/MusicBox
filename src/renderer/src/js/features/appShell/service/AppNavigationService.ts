import type {AppView} from "@js/shared/types/AppContracts";
import {appShellRuntimeHost} from "./AppShellRuntimeHost";

export class AppNavigationService {
    navigateToView(view: AppView): Promise<void> {
        return appShellRuntimeHost.requireHost().handleViewChange(view);
    }

    navigateToLibrary(): Promise<void> {
        return this.navigateToView('library');
    }
}

export const appNavigationService = new AppNavigationService();
